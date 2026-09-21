import * as XLSX from "xlsx";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
};

export type GmailMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
};

function gatewayHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovableKey || !connKey) {
    throw new Error("A conexão com o Gmail não está disponível no momento.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
  };
}

async function gmailGet<T>(path: string): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, { headers: gatewayHeaders() });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Gmail request failed [${res.status}]: ${body}`);
    throw new Error(`Falha ao ler o Gmail [${res.status}]: ${body}`);
  }
  return (await res.json()) as T;
}

export async function listMessageIds(query: string, maxResults: number) {
  const data = await gmailGet<{ messages?: { id: string }[] }>(
    `/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`,
  );
  return (data.messages ?? []).map((m) => m.id);
}

export async function getMessage(id: string) {
  return gmailGet<GmailMessage>(`/users/me/messages/${id}?format=full`);
}

async function getAttachment(messageId: string, attachmentId: string) {
  const data = await gmailGet<{ data?: string }>(
    `/users/me/messages/${messageId}/attachments/${attachmentId}`,
  );
  return data.data ?? "";
}

function b64urlToBytes(data: string) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeText(data: string) {
  try {
    return new TextDecoder("utf-8").decode(b64urlToBytes(data));
  } catch {
    return "";
  }
}

export function headerValue(msg: GmailMessage, name: string) {
  const find = (part?: GmailPart): string | undefined => {
    const hit = part?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
    return hit?.value;
  };
  return find(msg.payload) ?? "";
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(tr|div|p|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function walk(part: GmailPart | undefined, out: GmailPart[]) {
  if (!part) return;
  out.push(part);
  for (const child of part.parts ?? []) walk(child, out);
}

const SHEET_TYPES = [".xlsx", ".xls", ".csv", ".xlsm"];

export async function extractMessageText(msg: GmailMessage) {
  const parts: GmailPart[] = [];
  walk(msg.payload, parts);

  let text = "";
  let html = "";
  const attachmentNames: string[] = [];
  let attachmentText = "";

  for (const part of parts) {
    const filename = part.filename ?? "";
    if (filename) {
      attachmentNames.push(filename);
      const lower = filename.toLowerCase();
      if (part.body?.attachmentId && SHEET_TYPES.some((ext) => lower.endsWith(ext))) {
        try {
          const raw = await getAttachment(msg.id, part.body.attachmentId);
          const book = XLSX.read(b64urlToBytes(raw), { type: "array" });
          for (const sheetName of book.SheetNames.slice(0, 4)) {
            const csv = XLSX.utils.sheet_to_csv(book.Sheets[sheetName]!);
            attachmentText += `\n\n### Anexo ${filename} / aba ${sheetName}\n${csv.slice(0, 20000)}`;
          }
        } catch (error) {
          console.error("Falha ao ler anexo", filename, error);
        }
      }
      continue;
    }
    if (part.mimeType === "text/plain" && part.body?.data) text += `${decodeText(part.body.data)}\n`;
    if (part.mimeType === "text/html" && part.body?.data) html += `${decodeText(part.body.data)}\n`;
  }

  const body = (text.trim() || stripHtml(html)).slice(0, 20000);
  return { body, attachmentNames, attachmentText: attachmentText.slice(0, 40000) };
}

export type ParsedQuote = {
  rfq_number: string | null;
  client_name: string | null;
  supplier_name: string | null;
  currency: string;
  quote_date: string | null;
  items: {
    product: string | null;
    item_code: string | null;
    description: string | null;
    material: string | null;
    class: string | null;
    face: string | null;
    sch_thk: string | null;
    dn: string | null;
    qty: number | null;
    price: number | null;
  }[];
  confidence: "alta" | "media" | "baixa";
  summary: string;
};

const SYSTEM_PROMPT = `Você extrai cotações de fornecedores de itens industriais (flanges, tubulares, forjados, juntas, parafusos) a partir de e-mails em português e inglês.
Regras:
- "rfq_number" é o número da RFQ citado no assunto ou corpo (ex.: "05 - RFQ", "RFQ-PB-7004123", "RFQ-477329"). Copie exatamente como aparece.
- "supplier_name" é a empresa que enviou o e-mail (use o domínio/assinatura, não o destinatário).
- "price" é o preço unitário do item. Use ponto como separador decimal e número puro.
- Se um dado não existir, use null. Nunca invente valores.
- Retorne apenas JSON válido.`;

export async function parseQuoteWithAI(input: {
  subject: string;
  from: string;
  body: string;
  attachmentText: string;
}): Promise<ParsedQuote | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Serviço de leitura automática indisponível.");

  const itemSchema = {
    type: "object",
    properties: {
      product: { type: ["string", "null"] },
      item_code: { type: ["string", "null"] },
      description: { type: ["string", "null"] },
      material: { type: ["string", "null"] },
      class: { type: ["string", "null"] },
      face: { type: ["string", "null"] },
      sch_thk: { type: ["string", "null"] },
      dn: { type: ["string", "null"] },
      qty: { type: ["number", "null"] },
      price: { type: ["number", "null"] },
    },
    required: [
      "product",
      "item_code",
      "description",
      "material",
      "class",
      "face",
      "sch_thk",
      "dn",
      "qty",
      "price",
    ],
    additionalProperties: false,
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      reasoning: { effort: "low" },
      store: false,
      instructions: SYSTEM_PROMPT,
      input: [
        {
          role: "user",
          content: `Assunto: ${input.subject}\nDe: ${input.from}\n\nCorpo:\n${input.body}\n\nAnexos:\n${input.attachmentText}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "cotacao",
          strict: true,
          schema: {
            type: "object",
            properties: {
              rfq_number: { type: ["string", "null"] },
              client_name: { type: ["string", "null"] },
              supplier_name: { type: ["string", "null"] },
              currency: { type: "string" },
              quote_date: { type: ["string", "null"], description: "AAAA-MM-DD" },
              confidence: { type: "string", enum: ["alta", "media", "baixa"] },
              summary: { type: "string" },
              items: { type: "array", items: itemSchema },
            },
            required: [
              "rfq_number",
              "client_name",
              "supplier_name",
              "currency",
              "quote_date",
              "confidence",
              "summary",
              "items",
            ],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`AI parse failed [${res.status}]: ${body}`);
    if (res.status === 429)
      throw new Error("Limite de leituras automáticas atingido. Tente de novo em alguns minutos.");
    if (res.status === 402) throw new Error("Créditos de IA insuficientes para ler os e-mails.");
    throw new Error("Não consegui interpretar o e-mail automaticamente.");
  }

  const json = (await res.json()) as {
    output_text?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };

  let text = json.output_text ?? "";
  if (!text) {
    for (const item of json.output ?? []) {
      for (const part of item.content ?? []) {
        if (part.type === "output_text" && part.text) text += part.text;
      }
    }
  }
  if (!text.trim()) return null;

  try {
    const parsed = JSON.parse(text) as ParsedQuote;
    return { ...parsed, items: parsed.items ?? [] };
  } catch {
    return null;
  }
}
