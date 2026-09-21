import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, FileStack, Inbox, Loader2, Tags } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getDashboard } from "@/lib/quotes.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { shortDate } from "@/lib/format";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  enviada: "Enviada",
  fechada: "Fechada",
  cancelada: "Cancelada",
};

function Index() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral das cotações registradas e do que ainda falta revisar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Itens cotados"
          value={data?.totals.items}
          loading={isLoading}
        />
        <StatCard icon={FileStack} label="RFQs" value={data?.totals.rfqs} loading={isLoading} />
        <StatCard
          icon={Tags}
          label="Preços registrados"
          value={data?.totals.prices}
          loading={isLoading}
        />
        <StatCard
          icon={Inbox}
          label="E-mails pendentes"
          value={data?.totals.pending}
          loading={isLoading}
          href="/emails"
          highlight={!!data?.totals.pending}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Itens por categoria</CardTitle>
            <CardDescription>Distribuição dos itens cotados registrados no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : data && data.byCategory.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.byCategory}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={110}
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        color: "var(--color-popover-foreground)",
                        fontSize: 12,
                      }}
                      cursor={{ fill: "var(--color-muted)" }}
                    />
                    <Bar dataKey="total" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>RFQs recentes</CardTitle>
            <CardDescription>Últimas cotações por data</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : data && data.recentRfqs.length > 0 ? (
              data.recentRfqs.map((rfq) => (
                <Link
                  key={rfq.id}
                  to="/cotacoes"
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{rfq.rfq_number}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {rfq.client_name ?? "Cliente não informado"} · {shortDate(rfq.quote_date)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {STATUS_LABEL[rfq.status] ?? rfq.status}
                  </Badge>
                </Link>
              ))
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  href,
  highlight,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: number | undefined;
  loading: boolean;
  href?: string;
  highlight?: boolean;
}) {
  const body = (
    <Card className={highlight ? "border-warning/50 bg-warning/5" : undefined}>
      <CardContent className="flex items-center gap-3 p-5">
        <div
          className={
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg " +
            (highlight ? "bg-warning/20 text-warning-foreground" : "bg-primary/10 text-primary")
          }
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="tabular text-xl font-semibold text-foreground">
            {loading ? "—" : (value ?? 0)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link to={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function EmptyState() {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <p>Ainda não há dados suficientes.</p>
      <Link to="/emails" className="text-primary hover:underline">
        Sincronize seus e-mails para começar
      </Link>
    </div>
  );
}
