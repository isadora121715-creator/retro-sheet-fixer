import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { exportRows, getFilterOptions, listQuotes } from "@/lib/quotes.functions";
import { downloadQuotesXlsx, type ExportRow } from "@/lib/export-xlsx";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, dash, shortDate } from "@/lib/format";

export const Route = createFileRoute("/cotacoes")({
  component: Cotacoes,
});

const PAGE_SIZE = 50;
const ALL = "all";

function Cotacoes() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [client, setClient] = useState(ALL);
  const [supplier, setSupplier] = useState(ALL);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [search, category, client, supplier]);

  const filterOptions = useQuery({
    queryKey: ["filter-options"],
    queryFn: () => getFilterOptions(),
    staleTime: 60_000,
  });

  const quotes = useQuery({
    queryKey: ["quotes", { search, category, client, supplier, page }],
    queryFn: () =>
      listQuotes({
        data: { search, category, client, supplier, page, pageSize: PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  });

  const total = quotes.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleExport() {
    setExporting(true);
    try {
      const rows = (await exportRows({ data: { category } })) as unknown as ExportRow[];
      if (rows.length === 0) {
        toast.info("Não há cotações para exportar com esse filtro.");
        return;
      }
      downloadQuotesXlsx(rows, `cotacoes-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${rows.length} itens exportados.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Cotações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} item{total === 1 ? "" : "s"} cotado{total === 1 ? "" : "s"}
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exportar Excel
        </Button>
      </div>

      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar produto, código, material..."
            className="pl-8"
          />
        </div>
        <FilterSelect
          label="Categoria"
          value={category}
          onChange={setCategory}
          options={filterOptions.data?.categories ?? []}
        />
        <FilterSelect
          label="Cliente"
          value={client}
          onChange={setClient}
          options={filterOptions.data?.clients ?? []}
        />
        <FilterSelect
          label="Fornecedor"
          value={supplier}
          onChange={setSupplier}
          options={filterOptions.data?.suppliers ?? []}
        />
      </div>

      <div className="panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RFQ</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>DN</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Fornecedores</TableHead>
              <TableHead className="text-right">Melhor preço</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-40 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : quotes.data && quotes.data.rows.length > 0 ? (
              quotes.data.rows.map((row) => {
                const priced = row.prices.filter((p) => p.price !== null && p.price !== undefined);
                const best = priced
                  .slice()
                  .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0];
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{dash(row.rfq?.rfq_number)}</TableCell>
                    <TableCell>{dash(row.rfq?.client_name)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.category}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate" title={row.product ?? undefined}>
                      {dash(row.product)}
                    </TableCell>
                    <TableCell>{dash(row.dn)}</TableCell>
                    <TableCell>{dash(row.material)}</TableCell>
                    <TableCell>
                      {row.prices.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="text-muted-foreground">{row.prices.length} cotado(s)</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {best ? brl(best.price) : "—"}
                    </TableCell>
                    <TableCell>{shortDate(row.rfq?.quote_date)}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-40 text-center text-sm text-muted-foreground">
                  Nenhuma cotação encontrada com esses filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Página {page + 1} de {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || quotes.isFetching}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page + 1 >= totalPages || quotes.isFetching}
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[170px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Todos ({label.toLowerCase()})</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
