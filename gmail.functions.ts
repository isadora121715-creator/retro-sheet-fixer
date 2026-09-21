import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  extractMessageText,
  getMessage,
  headerValue,
  listMessageIds,
  parseQuoteWithAI,
  type ParsedQuote,
} from "./gmail.server";

const DEFAULT_QUERY =
  '(subject:RFQ OR subject:cotação OR subject:cotacao OR subject:quotation OR subject:"quote") -in:chats';

function senderName(from: string) {
  const match = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (match) return match[1]!.trim();
  const domain = from.match(/@([\w.-]+)/);
  return domain ? domain[1]!.split(".")[0]!.toUpperCase() : from;
}

export const syncInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ days: z.number().int().min(1).max(365).default(30), limit: z.number().int().min(1).max(40).default(15) })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const ids = await listMessageIds(`${DEFAULT_QUERY} newer_than:${data.days}d`, 100);

    const { data: known } = await supabase
      .from("email_imports")
      .select("gmail_message_id")
      .in("gmail_message_id", ids.slice(0, 500));
    const seen = new Set((known ?? []).map((k) => k.gmail_message_id));
    const fresh = ids.filter((id) => !seen.has(id)).slice(0, data.limit);

    let imported = 0;
    let failed = 0;

    for (const id of fresh) {
      try {
        const msg = await getMessage(id);
        const subject = headerValue(msg, "Subject");
        const from = headerValue(msg, "From");
        const dateHeader = headerValue(msg, "Date");
        const { body, attachmentNames, attachmentText } = await extractMessageText(msg);

        let parsed: ParsedQuote | null = null;
        let errorMessage: string | null = null;
        try {
          parsed = await parseQuoteWithAI({ subject, from, body, attachmentText });
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : "Falha na leitura automática";
        }

        const hasItems = (parsed?.items ?? []).some((i) => i.price !== null && i.price !== undefined);
        const receivedAt = msg.internalDate
          ? new Date(Number(msg.internalDate)).toISOString()
          : dateHeader
            ? new Date(dateHeader).toISOString()
            : new Date().toISOString();

        await supabase.from("email_imports").insert({
          gmail_message_id: id,
          gmail_thread_id: msg.threadId,
          subject,
          from_address: from,
          from_name: senderName(from),
          received_at: receivedAt,
          snippet: msg.snippet ?? body.slice(0, 300),
          detected_rfq: parsed?.rfq_number ?? null,
          detected_supplier: parsed?.supplier_name ?? senderName(from),
          status: errorMessage ? "erro" : hasItems ? "pendente" : "sem_dados",
          parsed_payload: parsed ? { ...parsed, attachments: attachmentNames } : null,
          error_message: errorMessage,
        });

        if (errorMessage) failed += 1;
        else imported += 1;
      } catch (error) {
        console.error("Falha ao processar mensagem", id, error);
        failed += 1;
      }
    }

    return { scanned: ids.length, imported, failed, remaining: Math.max(0, ids.length - seen.size - fresh.length) };
  });

export const listImports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ status: z.string().default("pendente") }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("email_imports")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(100);
    if (data.status !== "todos") query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const importCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("email_imports").select("status").limit(2000);
    const counts: Record<string, number> = { pendente: 0, aplicado: 0, sem_dados: 0, erro: 0, ignorado: 0 };
    for (const row of data ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  });

const approveInput = z.object({
  importId: z.string().uuid(),
  rfqNumber: z.string().min(1),
  clientName: z.string().optional().default(""),
  supplierName: z.string().min(1),
  category: z.string().min(1),
  quoteDate: z.string().optional().nullable(),
  items: z.array(
    z.object({
      product: z.string().optional().nullable(),
      item_code: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      material: z.string().optional().nullable(),
      class: z.string().optional().nullable(),
      face: z.string().optional().nullable(),
      sch_thk: z.string().optional().nullable(),
      dn: z.string().optional().nullable(),
      qty: z.number().nullable().optional(),
      price: z.number().nullable().optional(),
    }),
  ),
});

export const approveImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => approveInput.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: existingRfq } = await supabase
      .from("rfqs")
      .select("id")
      .eq("rfq_number", data.rfqNumber)
      .limit(1)
      .maybeSingle();

    let rfqId = existingRfq?.id;
    if (!rfqId) {
      const { data: created, error } = await supabase
        .from("rfqs")
        .insert({
          rfq_number: data.rfqNumber,
          client_name: data.clientName || null,
          quote_date: data.quoteDate || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      rfqId = created.id;
    }

    const { data: existingItems } = await supabase
      .from("quote_items")
      .select("id,product,dn,class,material,item_code")
      .eq("rfq_id", rfqId);

    let matched = 0;
    let created = 0;

    for (const item of data.items) {
      if (item.price === null || item.price === undefined) continue;
      const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();
      const hit = (existingItems ?? []).find(
        (e) =>
          (item.item_code && norm(e.item_code) === norm(item.item_code)) ||
          (norm(e.product) === norm(item.product) &&
            norm(e.dn) === norm(item.dn) &&
            norm(e.class) === norm(item.class)),
      );

      let itemId = hit?.id;
      if (itemId) matched += 1;
      else {
        const { data: newItem, error } = await supabase
          .from("quote_items")
          .insert({
            rfq_id: rfqId,
            category: data.category,
            product: item.product ?? null,
            item_code: item.item_code ?? null,
            description: item.description ?? null,
            material: item.material ?? null,
            class: item.class ?? null,
            face: item.face ?? null,
            sch_thk: item.sch_thk ?? null,
            dn: item.dn ?? null,
            qty: item.qty ?? null,
            source: "email",
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        itemId = newItem.id;
        created += 1;
      }

      await supabase.from("supplier_prices").insert({
        quote_item_id: itemId,
        supplier_name: data.supplierName,
        price: item.price,
        received_at: data.quoteDate || new Date().toISOString().slice(0, 10),
        source: "email",
      });
    }

    await supabase.from("suppliers").upsert({ name: data.supplierName }, { onConflict: "name", ignoreDuplicates: true });
    await supabase
      .from("email_imports")
      .update({ status: "aplicado", processed_at: new Date().toISOString() })
      .eq("id", data.importId);

    return { matched, created };
  });

export const setImportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ importId: z.string().uuid(), status: z.enum(["pendente", "ignorado"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("email_imports")
      .update({ status: data.status })
      .eq("id", data.importId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
