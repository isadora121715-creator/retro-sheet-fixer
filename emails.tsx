import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getFilterOptions } from "@/lib/quotes.functions";
import { importCounts, listImports, setImportStatus, syncInbox } from "@/lib/gmail.functions";
import type { EmailImportRow, EmailImportStatus } from "@/lib/email-imports.types";
import { ImportReviewDialog } from "@/components/import-review-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/emails")({
  component: Emails,
});

const STATUS_TABS: { value: EmailImportStatus | "todos"; label: string }[] = [
  { value: "pendente", label: "Pendentes" },
  { value: "aplicado", label: "Aplicados" },
  { value: "sem_dados", label: "Sem dados" },
  { value: "erro", label: "Erro" },
  { value: "ignorado", label: "Ignorados" },
  { value: "todos", label: "Todos" },
];

function Emails() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<EmailImportStatus | "todos">("pendente");
  const [reviewing, setReviewing] = useState<EmailImportRow | null>(null);

  const counts = useQuery({ queryKey: ["import-counts"], queryFn: () => importCounts() });
  const filterOptions = useQuery({
    queryKey: ["filter-options"],
    queryFn: () => getFilterOptions(),
  });
  const imports = useQuery({
    queryKey: ["email-imports", status],
    queryFn: () => listImports({ data: { status } }) as Promise<EmailImportRow[]>,
  });

  const sync = useMutation({
    mutationFn: () => syncInbox({ data: {} }),
    onSuccess: (result) => {
      toast.success(
        `${result.imported} e-mail(s) novo(s) lido(s)` +
          (result.failed ? `, ${result.failed} com falha` : "") +
          ".",
      );
      queryClient.invalidateQueries({ queryKey: ["email-imports"] });
      queryClient.invalidateQueries({ queryKey: ["import-counts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Falha ao sincronizar o Gmail.");
    },
  });

  const ignore = useMutation({
    mutationFn: (importId: string) => setImportStatus({ data: { importId, status: "ignorado" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-imports"] });
      queryClient.invalidateQueries({ queryKey: ["import-counts"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Falha ao ignorar o e-mail.");
    },
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">E-mails</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cotações recebidas por e-mail, lidas automaticamente e prontas para revisar.
          </p>
        </div>
        <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
          {sync.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Sincronizar Gmail
        </Button>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as EmailImportStatus | "todos")}>
        <TabsList className="flex-wrap">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
              {tab.label}
              {tab.value !== "todos" ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {counts.data?.[tab.value] ?? 0}
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-3">
        {imports.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : imports.data && imports.data.length > 0 ? (
          imports.data.map((row) => (
            <ImportCard
              key={row.id}
              row={row}
              onReview={() => setReviewing(row)}
              onIgnore={() => ignore.mutate(row.id)}
              ignoring={ignore.isPending && ignore.variables === row.id}
            />
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Mail className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum e-mail nessa categoria. Clique em "Sincronizar Gmail" para buscar novas
                cotações.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <ImportReviewDialog
        importRow={reviewing}
        open={reviewing !== null}
        onOpenChange={(open) => !open && setReviewing(null)}
        categories={filterOptions.data?.categories ?? []}
      />
    </div>
  );
}

const STATUS_BADGE: Record<
  EmailImportStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pendente: { label: "Pendente", variant: "outline" },
  aplicado: { label: "Aplicado", variant: "default" },
  sem_dados: { label: "Sem dados", variant: "secondary" },
  erro: { label: "Erro", variant: "destructive" },
  ignorado: { label: "Ignorado", variant: "secondary" },
};

function ImportCard({
  row,
  onReview,
  onIgnore,
  ignoring,
}: {
  row: EmailImportRow;
  onReview: () => void;
  onIgnore: () => void;
  ignoring: boolean;
}) {
  const badge = STATUS_BADGE[row.status];
  const itemsCount = row.parsed_payload?.items?.length ?? 0;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-foreground">{row.subject || "(sem assunto)"}</p>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.from_name || row.from_address} · {shortDate(row.received_at)}
          </p>
          {row.detected_rfq || row.detected_supplier ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {row.detected_rfq ? <>RFQ: {row.detected_rfq}</> : null}
              {row.detected_rfq && row.detected_supplier ? " · " : ""}
              {row.detected_supplier ? <>Fornecedor: {row.detected_supplier}</> : null}
              {itemsCount ? ` · ${itemsCount} item(ns) identificado(s)` : ""}
            </p>
          ) : null}
          {row.status === "erro" && row.error_message ? (
            <p className="mt-1.5 text-xs text-destructive">{row.error_message}</p>
          ) : row.snippet ? (
            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{row.snippet}</p>
          ) : null}
        </div>
        {row.status === "pendente" ? (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={onIgnore} disabled={ignoring}>
              {ignoring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              Ignorar
            </Button>
            <Button size="sm" onClick={onReview}>
              <CheckCircle2 className="h-4 w-4" />
              Revisar
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
