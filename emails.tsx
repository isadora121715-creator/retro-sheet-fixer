import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Mail, RefreshCw, RotateCw, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  approveImport,
  importCounts,
  listImports,
  retryImport,
  setImportStatus,
  syncInbox,
} from "@/lib/gmail.functions";
import { brl, dash, shortDate } from "@/lib/format";
import { useSyncSettings } from "@/hooks/use-sync-settings";
import { GmailSearchSettingsDialog } from "@/components/gmail-search-settings-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/emails")({
  head: () => ({
    meta: [
      { title: "Caixa de cotações | Cotações HCI" },
      {
        name: "description",
        content: "E-mails de cotação lidos automaticamente, prontos para conferir e lançar no cadastro.",
      },
      { property: "og:title", content: "Caixa de cotações | Cotações HCI" },
      {
        property: "og:description",
        content: "E-mails de cotação lidos automaticamente, prontos para conferir e lançar no cadastro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <EmailsPage />
    </AppShell>
  ),
});

type ParsedItem = {
  product?: string | null;
  item_code?: string | null;
  description?: string | null;
  material?: string | null;
  class?: string | null;
  face?: string | null;
  sch_thk?: string | null;
  dn?: string | null;
  qty?: number | null;
  price?: number | null;
};

type ParsedPayload = {
  rfq_number?: string | null;
  client_name?: string | null;
  supplier_name?: string | null;
  quote_date?: string | null;
  confidence?: string;
  summary?: string;
  items?: ParsedItem[];
};

const CATEGORIES = [
  "FLANGES",
  "TUBULARES",
  "FORJADINHOS",
  "JUNTA ANEL",
  "JUNTA ESPIRAL",
  "PARAFUSO",
  "FIGURA 8/RAQ",
  "PETROBRAS",
  "GERAL",
];

const STATUS_LABEL: Record<string, string> = {
  pendente: "Aguardando conferência",
  aplicado: "Lançado",
  sem_dados: "Sem preços",
  erro: "Falha na leitura",
  ignorado: "Ignorado",
  todos: "Todos",
};

function EmailsPage() {
  const qc = useQueryClient();
  const runSync = useServerFn(syncInbox);
  const fetchImports = useServerFn(listImports);
  const fetchCounts = useServerFn(importCounts);
  const runApprove = useServerFn(approveImport);
  const runStatus = useServerFn(setImportStatus);
  const runRetry = useServerFn(retryImport);

  const [status, setStatus] = useState("pendente");
  const [openId, setOpenId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const syncSettings = useSyncSettings();
  const [draft, setDraft] = useState<{ rfq: string; supplier: string; client: string; category: string }>({
    rfq: "",
    supplier: "",
    client: "",
    category: "FLANGES",
  });

  const counts = useQuery({ queryKey: ["import-counts"], queryFn: () => fetchCounts({}) });
  const imports = useQuery({
    queryKey: ["imports", status],
    queryFn: () => fetchImports({ data: { status } }),
  });

  const sync = useMutation({
    mutationFn: () =>
      runSync({
        data: {
          days: syncSettings.parsed.days,
          subjectTerms: syncSettings.parsed.subjectTerms,
          bodyTerms: syncSettings.parsed.bodyTerms,
          fromAddresses: syncSettings.parsed.fromAddresses,
          excludeSubjectTerms: syncSettings.parsed.excludeSubjectTerms,
        },
      }),
    onSuccess: (res) => {
      const message =
        `${res.imported} e-mail(s) lido(s)` +
        (res.skipped ? `, ${res.skipped} ignorado(s) por serem pedidos já fechados` : "") +
        (res.failed ? `, ${res.failed} com problema` : "");
      if (res.paused) {
        toast.warning(`${message}. Sincronização pausada: ${res.pausedReason ?? "limite atingido"}`);
      } else {
        toast.success(message);
      }
      qc.invalidateQueries({ queryKey: ["imports"] });
      qc.invalidateQueries({ queryKey: ["import-counts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retry = useMutation({
    mutationFn: (importId: string) => runRetry({ data: { importId } }),
    onSuccess: (res) => {
      toast.success(res.status === "erro" ? "Ainda não deu para ler esse e-mail." : "E-mail relido com sucesso.");
      qc.invalidateQueries({ queryKey: ["imports"] });
      qc.invalidateQueries({ queryKey: ["import-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: (vars: Parameters<typeof approveImport>[0]) => runApprove(vars),
    onSuccess: (res) => {
      toast.success(`Lançado: ${res.matched} item(ns) atualizados, ${res.created} novos`);
      setOpenId(null);
      qc.invalidateQueries({ queryKey: ["imports"] });
      qc.invalidateQueries({ queryKey: ["import-counts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ignore = useMutation({
    mutationFn: (id: string) => runStatus({ data: { importId: id, status: "ignorado" as const } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["imports"] });
      qc.invalidateQueries({ queryKey: ["import-counts"] });
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Caixa de cotações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Os e-mails de cotação do seu Gmail são lidos e preparados para você só conferir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[210px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["pendente", "aplicado", "sem_dados", "erro", "ignorado", "todos"].map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                  {counts.data?.[s] !== undefined ? ` (${counts.data[s]})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setSettingsOpen(true)} title="Filtros de busca">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </Button>
          <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
            {sync.isPending ? "Lendo e-mails…" : "Buscar e-mails"}
          </Button>
        </div>
      </header>

      <GmailSearchSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        form={syncSettings.form}
        onFormChange={syncSettings.setForm}
        onSave={syncSettings.save}
      />

      {imports.isLoading ? (
        <Skeleton className="h-72 rounded-lg" />
      ) : (imports.data ?? []).length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 p-12 text-center">
          <Mail className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Nada por aqui</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Clique em “Buscar e-mails” para ler as cotações recebidas nos últimos 30 dias.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(imports.data ?? []).map((row) => {
            const payload = (row.parsed_payload ?? {}) as ParsedPayload;
            const items = payload.items ?? [];
            const open = openId === row.id;
            return (
              <li key={row.id} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{dash(row.subject)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {dash(row.from_name)} · {shortDate(row.received_at)}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {payload.summary || row.snippet}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant={row.status === "pendente" ? "default" : "secondary"}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                    {payload.confidence ? (
                      <span className="text-xs text-muted-foreground">confiança {payload.confidence}</span>
                    ) : null}
                  </div>
                </div>

                {row.error_message ? (
                  <p className="mt-3 text-sm text-destructive">{row.error_message}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>RFQ: {dash(payload.rfq_number ?? row.detected_rfq)}</span>
                  <span>Fornecedor: {dash(payload.supplier_name ?? row.detected_supplier)}</span>
                  <span>{items.length} item(ns)</span>
                </div>

                {row.status === "pendente" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={open ? "secondary" : "default"}
                      onClick={() => {
                        setOpenId(open ? null : row.id);
                        setDraft({
                          rfq: payload.rfq_number ?? row.detected_rfq ?? "",
                          supplier: payload.supplier_name ?? row.detected_supplier ?? "",
                          client: payload.client_name ?? "",
                          category: "FLANGES",
                        });
                      }}
                    >
                      {open ? "Fechar" : "Conferir e lançar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => ignore.mutate(row.id)}>
                      <X className="mr-1 h-3.5 w-3.5" />
                      Ignorar
                    </Button>
                  </div>
                ) : null}

                {row.status === "erro" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={retry.isPending && retry.variables === row.id}
                      onClick={() => retry.mutate(row.id)}
                    >
                      <RotateCw
                        className={`mr-1 h-3.5 w-3.5 ${
                          retry.isPending && retry.variables === row.id ? "animate-spin" : ""
                        }`}
                      />
                      Tentar novamente
                    </Button>
                  </div>
                ) : null}

                {open ? (
                  <div className="mt-5 space-y-4 rounded-md bg-secondary/40 p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Input
                        placeholder="N° RFQ"
                        value={draft.rfq}
                        onChange={(e) => setDraft({ ...draft, rfq: e.target.value })}
                      />
                      <Input
                        placeholder="Fornecedor"
                        value={draft.supplier}
                        onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}
                      />
                      <Input
                        placeholder="Cliente"
                        value={draft.client}
                        onChange={(e) => setDraft({ ...draft, client: e.target.value })}
                      />
                      <Select
                        value={draft.category}
                        onValueChange={(v) => setDraft({ ...draft, category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-sm">
                        <thead className="text-left text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="py-2">Produto</th>
                            <th className="py-2">Especificação</th>
                            <th className="py-2 text-right">Qtd</th>
                            <th className="py-2 text-right">Preço</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {items.map((item, i) => (
                            <tr key={i}>
                              <td className="py-2">{dash(item.product)}</td>
                              <td className="py-2 text-xs text-muted-foreground">
                                {[item.material, item.dn ? `DN ${item.dn}` : null, item.class, item.sch_thk]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </td>
                              <td className="tabular py-2 text-right">{item.qty ?? "—"}</td>
                              <td className="tabular py-2 text-right">{brl(item.price ?? null)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <Button
                      size="sm"
                      disabled={approve.isPending || !draft.rfq || !draft.supplier}
                      onClick={() =>
                        approve.mutate({
                          data: {
                            importId: row.id,
                            rfqNumber: draft.rfq,
                            supplierName: draft.supplier,
                            clientName: draft.client,
                            category: draft.category,
                            quoteDate: payload.quote_date ?? null,
                            items,
                          },
                        })
                      }
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {approve.isPending ? "Lançando…" : "Lançar no cadastro"}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
