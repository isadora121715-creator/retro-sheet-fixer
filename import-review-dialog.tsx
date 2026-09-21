import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { approveImport } from "@/lib/gmail.functions";
import type { EmailImportRow } from "@/lib/email-imports.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DraftItem = {
  include: boolean;
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
};

export function ImportReviewDialog({
  importRow,
  open,
  onOpenChange,
  categories,
}: {
  importRow: EmailImportRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
}) {
  const queryClient = useQueryClient();
  const [rfqNumber, setRfqNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [category, setCategory] = useState("");
  const [quoteDate, setQuoteDate] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  useEffect(() => {
    if (!importRow || !open) return;
    const parsed = importRow.parsed_payload;
    setRfqNumber(parsed?.rfq_number ?? importRow.detected_rfq ?? "");
    setClientName(parsed?.client_name ?? "");
    setSupplierName(parsed?.supplier_name ?? importRow.detected_supplier ?? "");
    setCategory(categories[0] ?? "");
    setQuoteDate(parsed?.quote_date ?? "");
    setItems(
      (parsed?.items ?? []).map((item) => ({
        include: item.price !== null && item.price !== undefined,
        product: item.product,
        item_code: item.item_code,
        description: item.description,
        material: item.material,
        class: item.class,
        face: item.face,
        sch_thk: item.sch_thk,
        dn: item.dn,
        qty: item.qty,
        price: item.price,
      })),
    );
    // Re-seed the draft only when a different email is opened for review, not
    // on every re-render — importRow/categories references change on refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importRow?.id, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!importRow) return;
      const selected = items.filter((i) => i.include && i.price !== null);
      return approveImport({
        data: {
          importId: importRow.id,
          rfqNumber: rfqNumber.trim(),
          clientName,
          supplierName: supplierName.trim(),
          category: category.trim(),
          quoteDate: quoteDate || null,
          items: selected.map(({ include: _include, ...rest }) => rest),
        },
      });
    },
    onSuccess: (result) => {
      toast.success(
        result
          ? `Aplicado: ${result.created} novo(s), ${result.matched} atualizado(s).`
          : "Aplicado.",
      );
      queryClient.invalidateQueries({ queryKey: ["email-imports"] });
      queryClient.invalidateQueries({ queryKey: ["import-counts"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["filter-options"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Falha ao aplicar o e-mail.");
    },
  });

  const selectedCount = items.filter((i) => i.include).length;
  const canSubmit =
    rfqNumber.trim().length > 0 &&
    supplierName.trim().length > 0 &&
    category.trim().length > 0 &&
    selectedCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisar cotação</DialogTitle>
          <DialogDescription className="truncate">{importRow?.subject}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="RFQ" required>
            <Input value={rfqNumber} onChange={(e) => setRfqNumber(e.target.value)} />
          </Field>
          <Field label="Fornecedor" required>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          </Field>
          <Field label="Cliente">
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </Field>
          <Field label="Categoria" required>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="category-options"
              placeholder="ex.: Flanges"
            />
            <datalist id="category-options">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Data da cotação">
            <Input
              type="date"
              value={quoteDate ?? ""}
              onChange={(e) => setQuoteDate(e.target.value)}
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            Itens ({selectedCount} de {items.length} selecionados)
          </p>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum item com preço foi identificado automaticamente neste e-mail.
            </p>
          ) : (
            <div className="panel overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Produto</TableHead>
                    <TableHead>DN</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Preço</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Checkbox
                          checked={item.include}
                          onCheckedChange={(checked) =>
                            setItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, include: checked === true } : it,
                              ),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm">
                        {item.product || item.description || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{item.dn || "—"}</TableCell>
                      <TableCell className="w-20">
                        <Input
                          type="number"
                          value={item.qty ?? ""}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      qty: e.target.value === "" ? null : Number(e.target.value),
                                    }
                                  : it,
                              ),
                            )
                          }
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell className="w-28">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.price ?? ""}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      price: e.target.value === "" ? null : Number(e.target.value),
                                    }
                                  : it,
                              ),
                            )
                          }
                          className="h-8"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Aplicar à planilha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}
