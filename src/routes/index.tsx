import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, FileSpreadsheet, Inbox, Layers, Tag } from "lucide-react";
import { getDashboard } from "@/lib/quotes.functions";
import { shortDate, dash } from "@/lib/format";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel de cotações | Cotações HCI" },
      {
        name: "description",
        content: "Acompanhe RFQs, preços de fornecedores e cotações lidas automaticamente do e-mail.",
      },
      { property: "og:title", content: "Painel de cotações | Cotações HCI" },
      {
        property: "og:description",
        content: "Acompanhe RFQs, preços de fornecedores e cotações lidas automaticamente do e-mail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

function Stat({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: typeof Layers;
  hint?: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="tabular mt-3 font-display text-3xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Dashboard() {
  const fetchDashboard = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard({}) });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold">Painel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todo o histórico da planilha, agora consultável e atualizado pelos e-mails.
        </p>
      </header>

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Itens cotados" value={data.totals.items.toLocaleString("pt-BR")} icon={Layers} />
            <Stat label="RFQs" value={data.totals.rfqs.toLocaleString("pt-BR")} icon={FileSpreadsheet} />
            <Stat label="Preços recebidos" value={data.totals.prices.toLocaleString("pt-BR")} icon={Tag} />
            <Stat
              label="E-mails aguardando"
              value={data.totals.pending.toLocaleString("pt-BR")}
              icon={Inbox}
              hint="Cotações lidas esperando aprovação"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="panel p-6 lg:col-span-3">
              <h2 className="font-display text-base font-semibold">Itens por tipo de material</h2>
              <ul className="mt-5 space-y-3">
                {data.byCategory.map((row) => {
                  const max = data.byCategory[0]?.total || 1;
                  return (
                    <li key={row.category}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">{row.category}</span>
                        <span className="tabular text-muted-foreground">{row.total.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-secondary">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${Math.max(3, (row.total / max) * 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="panel p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">RFQs recentes</h2>
                <Link to="/cotacoes" className="flex items-center gap-1 text-sm text-primary hover:underline">
                  Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ul className="mt-4 divide-y divide-border">
                {data.recentRfqs.map((rfq) => (
                  <li key={rfq.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{dash(rfq.rfq_number)}</p>
                      <p className="truncate text-xs text-muted-foreground">{dash(rfq.client_name)}</p>
                    </div>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">
                      {shortDate(rfq.quote_date)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
