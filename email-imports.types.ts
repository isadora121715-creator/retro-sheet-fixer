import type { ParsedQuote } from "@/lib/gmail.server";

export type EmailImportStatus = "pendente" | "aplicado" | "sem_dados" | "erro" | "ignorado";

export type EmailImportRow = {
  id: string;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  subject: string | null;
  from_address: string | null;
  from_name: string | null;
  received_at: string | null;
  snippet: string | null;
  detected_rfq: string | null;
  detected_supplier: string | null;
  status: EmailImportStatus;
  parsed_payload: (ParsedQuote & { attachments?: string[] }) | null;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
};
