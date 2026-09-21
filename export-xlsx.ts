import * as XLSX from "xlsx";

type ExportPrice = { supplier_name: string; price: number | null; received_at: string | null };
export type ExportRow = {
  category: string;
  item_code: string | null;
  product: string | null;
  description: string | null;
  material: string | null;
  material_type: string | null;
  class: string | null;
  face: string | null;
  pipe_end: string | null;
  sch_thk: string | null;
  dn: string | null;
  qty: number | null;
  unit_weight: number | null;
  notes: string | null;
  rfq: {
    rfq_number: string;
    client_name: string | null;
    pi: string | null;
    op: string | null;
    quote_date: string | null;
  } | null;
  prices: ExportPrice[];
};

export function downloadQuotesXlsx(rows: ExportRow[], filename = "cotacoes.xlsx") {
  const sheetRows = rows.map((row) => {
    const validPrices = row.prices.filter((p) => p.price !== null && p.price !== undefined);
    const best = validPrices
      .slice()
      .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0];

    return {
      RFQ: row.rfq?.rfq_number ?? "",
      Cliente: row.rfq?.client_name ?? "",
      PI: row.rfq?.pi ?? "",
      OP: row.rfq?.op ?? "",
      Data: row.rfq?.quote_date ?? "",
      Categoria: row.category,
      Código: row.item_code ?? "",
      Produto: row.product ?? "",
      Descrição: row.description ?? "",
      Material: row.material ?? "",
      "Tipo de material": row.material_type ?? "",
      Classe: row.class ?? "",
      Face: row.face ?? "",
      "Ponta do tubo": row.pipe_end ?? "",
      "Sch/Esp": row.sch_thk ?? "",
      DN: row.dn ?? "",
      Qtd: row.qty ?? "",
      "Peso unit.": row.unit_weight ?? "",
      "Melhor fornecedor": best?.supplier_name ?? "",
      "Melhor preço": best?.price ?? "",
      Fornecedores: validPrices.map((p) => `${p.supplier_name}: ${p.price}`).join(" | "),
      Observações: row.notes ?? "",
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cotações");

  const arrayBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
