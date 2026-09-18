import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SupplierPrice = {
  id: string;
  supplier_name: string;
  price: number | null;
  received_at: string | null;
  source: string;
};

export type QuoteRow = {
  id: string;
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
  notes: string | null;
  rfq: {
    id: string;
    rfq_number: string;
    client_name: string | null;
    pi: string | null;
    op: string | null;
    quote_date: string | null;
    status: string;
  } | null;
  prices: SupplierPrice[];
};

const listInput = z.object({
  search: z.string().optional().default(""),
  category: z.string().optional().default("all"),
  client: z.string().optional().default("all"),
  supplier: z.string().optional().default("all"),
  page: z.number().int().min(0).optional().default(0),
  pageSize: z.number().int().min(10).max(500).optional().default(50),
});

export const listQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    let itemIdFilter: string[] | null = null;

    if (data.supplier !== "all") {
      const { data: rows } = await supabase
        .from("supplier_prices")
        .select("quote_item_id")
        .eq("supplier_name", data.supplier)
        .limit(5000);
      itemIdFilter = (rows ?? []).map((r) => r.quote_item_id);
      if (itemIdFilter.length === 0) return { rows: [] as QuoteRow[], total: 0 };
    }

    let rfqIds: string[] | null = null;
    if (data.client !== "all") {
      const { data: rfqs } = await supabase
        .from("rfqs")
        .select("id")
        .eq("client_name", data.client)
        .limit(5000);
      rfqIds = (rfqs ?? []).map((r) => r.id);
      if (rfqIds.length === 0) return { rows: [] as QuoteRow[], total: 0 };
    }

    let query = supabase
      .from("quote_items")
      .select(
        "id,category,item_code,product,description,material,material_type,class,face,pipe_end,sch_thk,dn,qty,notes," +
          "rfq:rfqs(id,rfq_number,client_name,pi,op,quote_date,status)," +
          "prices:supplier_prices(id,supplier_name,price,received_at,source)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (data.category !== "all") query = query.eq("category", data.category);
    if (itemIdFilter) query = query.in("id", itemIdFilter);
    if (rfqIds) query = query.in("rfq_id", rfqIds);
    if (data.search.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(
        `product.ilike.${term},item_code.ilike.${term},material.ilike.${term},description.ilike.${term},dn.ilike.${term}`,
      );
    }

    const from = data.page * data.pageSize;
    const { data: rows, count, error } = await query.range(from, from + data.pageSize - 1);
    if (error) throw new Error(error.message);

    return { rows: (rows ?? []) as unknown as QuoteRow[], total: count ?? 0 };
  });

export const getFilterOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const [cats, clients, suppliers] = await Promise.all([
      supabase.from("quote_items").select("category").limit(5000),
      supabase.from("clients").select("name").order("name"),
      supabase.from("suppliers").select("name").order("name"),
    ]);
    const categories = Array.from(new Set((cats.data ?? []).map((c) => c.category))).sort();
    return {
      categories,
      clients: (clients.data ?? []).map((c) => c.name),
      suppliers: (suppliers.data ?? []).map((s) => s.name),
    };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const [items, rfqs, prices, pending, recent] = await Promise.all([
      supabase.from("quote_items").select("id", { count: "exact", head: true }),
      supabase.from("rfqs").select("id", { count: "exact", head: true }),
      supabase.from("supplier_prices").select("id", { count: "exact", head: true }),
      supabase.from("email_imports").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      supabase
        .from("rfqs")
        .select("id,rfq_number,client_name,quote_date,status")
        .order("quote_date", { ascending: false, nullsFirst: false })
        .limit(8),
    ]);

    const { data: byCat } = await supabase.from("quote_items").select("category").limit(6000);
    const counts: Record<string, number> = {};
    for (const row of byCat ?? []) counts[row.category] = (counts[row.category] ?? 0) + 1;

    return {
      totals: {
        items: items.count ?? 0,
        rfqs: rfqs.count ?? 0,
        prices: prices.count ?? 0,
        pending: pending.count ?? 0,
      },
      byCategory: Object.entries(counts)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
      recentRfqs: recent.data ?? [],
    };
  });

export const exportRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ category: z.string().default("all") }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("quote_items")
      .select(
        "id,category,item_code,product,description,material,material_type,class,face,pipe_end,sch_thk,dn,qty,unit_weight,notes," +
          "rfq:rfqs(rfq_number,client_name,pi,op,quote_date)," +
          "prices:supplier_prices(supplier_name,price,received_at)",
      )
      .limit(6000);
    if (data.category !== "all") query = query.eq("category", data.category);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
