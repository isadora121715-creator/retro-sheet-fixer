import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { exportRows, getFilterOptions, listQuotes, type QuoteRow } from "@/lib/quotes.functions";
import { brl, dash, shortDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/cotacoes")({
  head: () => ({
    meta: [
      { title: "Cotações | Cotações HCI" },
      {
        name: "description",
        content: "Consulte todos os itens cotados, preços por fornecedor e o menor preço de cada item.",
      },
      { property: "og:title", content: "Cotações | Cotações HCI" },
      {
        property: "og:description",
        content: "Consulte todos os itens cotados, preços por fornecedor e o menor preço de cada item.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <QuotesPage />
    </AppShell>
  ),
});

const PAGE_SIZE = 50;

function best(row: QuoteRow) {
  const valid = row.prices.filter((p) => typeof p.price === "number" && p.price! > 0);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a.price! <= b.price! ? a : b));
}

function QuotesPage() {
  const fetchQuotes = useServerFn(listQuotes);
  const fetchOptions = useServerFn(getFilterOptions);
  const fetchExport = useServerFn(exportRows);

  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("all");
  const [client, setClient] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  const options = useQuery({ queryKey: ["filters"], queryFn: () => fetchOptions({}) });
  const quotes = useQuery({
    queryKey: ["quotes", term, category, client, supplier, page],
    queryFn: () =>
      fetchQuotes({ data: { search: term, category, client, supplier, page, pageSize: PAGE_SIZE } }),
  });

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((quotes.data?.total ?? 0) / PAGE_SIZE)),
    [quotes.data?.total],
  );

  async function handleExport() {
    setExporting(true);
    try {
      const rows = (await fetchExport({ data: { category } })) as Array<Record<string, unknown>>;
      const XLSX = await import("xlsx");
      const flat = rows.map((r) => {
        const rfq = (r["rfq"] ?? {}) as Record<string, unknown>;
        const prices = (r["prices"] ?? []) as Array<{ supplier_name: string; price: number | null }>;
        const valid = prices.filter((p) => typeof p.price === "number" && p.price > 0);
        const cheapest = valid.length ? valid.reduce((a, b) => (a.price! <= b.price! ? a : b)) : null;
        const base: Record<string, unknown> = {
          "N° RFQ": rfq["rfq_number"] ?? "",
          CLIENTE: rfq["client_name"] ?? "",
          PI: rfq["pi"] ?? "",
          OP: rfq["op"] ?? "",
          "DATA COTAÇÃO": rfq["quote_date"] ?? "",
          TIPO: r["category"] ?? "",
          ITEM: r["item_code"] ?? "",
          PRODUTO: r["product"] ?? "",
          DESCRIÇÃO: r["description"] ?? "",
          MATERIAL: r["material"] ?? "",
          CLASSE: r["class"] ?? "",
          FACE: r["face"] ?? "",
          "SCH/ESP": r["sch_thk"] ?? "",
          DN: r["dn"] ?? "",
          QTD: r["qty"] ?? "",
        };
        prices.forEach((p, i) => {
          base[`FORNECEDOR ${i + 1}`] = p.supplier_name;
          base[`PREÇO ${i + 1}`] = p.price ?? "";
        });
        base["MENOR PREÇO"] = cheapest?.price ?? "";
        base["FORNECEDOR VENCEDOR"] = cheapest?.supplier_name ?? "";
        return base;
      });
      const sheet = XLSX.utils.json_to_sheet(flat);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, category === "all" ? "Cotações" : category.slice(0, 28));
      XLSX.writeFile(book, `cotacoes-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não consegui gerar a planilha.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Cotações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {(quotes.data?.total ?? 0).toLocaleString("pt-BR")} itens encontrados
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Gerando…" : "Baixar planilha"}
        </Button>
      </header>

      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setTerm(search);
          }}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por produto, material, DN ou item"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        {(
          [
            ["Tipo", category, setCategory, options.data?.categories ?? []],
            ["Cliente", client, setClient, options.data?.clients ?? []],
            ["Fornecedor", supplier, setSupplier, options.data?.suppliers ?? []],
          ] as const
        ).map(([label, value, setValue, list]) => (
          <Select
            key={label}
            value={value}
            onValueChange={(v) => {
              setPage(0);
              (setValue as (v: string) => void)(v);
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder={label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{label}: todos</SelectItem>
              {list.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      {quotes.isLoading ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">RFQ / Cliente</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Especificação</th>
                <th className="px-4 py-3 text-right">Qtd</th>
                <th className="px-4 py-3">Preços</th>
                <th className="px-4 py-3 text-right">Menor preço</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(quotes.data?.rows ?? []).map((row) => {
                const cheapest = best(row);
                return (
                  <tr key={row.id} className="align-top hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <p className="font-medium">{dash(row.rfq?.rfq_number)}</p>
                      <p className="text-xs text-muted-foreground">{dash(row.rfq?.client_name)}</p>
                      <p className="tabular text-xs text-muted-foreground">{shortDate(row.rfq?.quote_date)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{dash(row.product)}</p>
                      <Badge variant="secondary" className="mt-1 text-[11px]">
                        {row.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <p>{dash(row.material)}</p>
                      <p>
                        DN {dash(row.dn)} · {dash(row.class)} {row.face ? `· ${row.face}` : ""}
                        {row.sch_thk ? ` · ${row.sch_thk}` : ""}
                      </p>
                    </td>
                    <td className="tabular px-4 py-3 text-right">{row.qty ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.prices.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sem preço</span>
                      ) : (
                        <ul className="space-y-1">
                          {row.prices.map((p) => (
                            <li key={p.id} className="flex justify-between gap-4 text-xs">
                              <span className="text-muted-foreground">{p.supplier_name}</span>
                              <span className="tabular">{brl(p.price)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {cheapest ? (
                        <>
                          <p className="tabular font-semibold text-primary">{brl(cheapest.price)}</p>
                          <p className="text-xs text-muted-foreground">{cheapest.supplier_name}</p>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Página {page + 1} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
