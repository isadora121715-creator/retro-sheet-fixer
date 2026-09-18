-- Perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Clientes
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_code TEXT,
  display_label TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX clients_name_key ON public.clients (lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_all_auth" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fornecedores
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email_domains TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX suppliers_name_key ON public.suppliers (lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_all_auth" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RFQs
CREATE TABLE public.rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_number TEXT NOT NULL,
  client_name TEXT,
  pi TEXT,
  op TEXT,
  lote TEXT,
  quote_date DATE,
  status TEXT NOT NULL DEFAULT 'aberta',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rfqs_number_idx ON public.rfqs (rfq_number);
CREATE INDEX rfqs_client_idx ON public.rfqs (client_name);
CREATE INDEX rfqs_date_idx ON public.rfqs (quote_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfqs TO authenticated;
GRANT ALL ON public.rfqs TO service_role;
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfqs_all_auth" ON public.rfqs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Itens cotados
CREATE TABLE public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  item_code TEXT,
  product TEXT,
  description TEXT,
  material_type TEXT,
  material TEXT,
  class TEXT,
  face TEXT,
  pipe_end TEXT,
  sch_thk TEXT,
  dn TEXT,
  constructive TEXT,
  qty NUMERIC,
  unit_weight NUMERIC,
  specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'planilha',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX quote_items_rfq_idx ON public.quote_items (rfq_id);
CREATE INDEX quote_items_category_idx ON public.quote_items (category);
CREATE INDEX quote_items_product_idx ON public.quote_items (product);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_items_all_auth" ON public.quote_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Preços por fornecedor (sem limite de 4)
CREATE TABLE public.supplier_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_item_id UUID NOT NULL REFERENCES public.quote_items(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  price NUMERIC,
  currency TEXT NOT NULL DEFAULT 'BRL',
  received_at DATE,
  source TEXT NOT NULL DEFAULT 'planilha',
  email_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX supplier_prices_item_idx ON public.supplier_prices (quote_item_id);
CREATE INDEX supplier_prices_supplier_idx ON public.supplier_prices (supplier_name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_prices TO authenticated;
GRANT ALL ON public.supplier_prices TO service_role;
ALTER TABLE public.supplier_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_prices_all_auth" ON public.supplier_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- E-mails lidos do Gmail
CREATE TABLE public.email_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id TEXT NOT NULL UNIQUE,
  gmail_thread_id TEXT,
  subject TEXT,
  from_address TEXT,
  from_name TEXT,
  received_at TIMESTAMPTZ,
  snippet TEXT,
  detected_rfq TEXT,
  detected_supplier TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  parsed_payload JSONB,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_imports_status_idx ON public.email_imports (status);
CREATE INDEX email_imports_received_idx ON public.email_imports (received_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_imports TO authenticated;
GRANT ALL ON public.email_imports TO service_role;
ALTER TABLE public.email_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_imports_all_auth" ON public.email_imports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Menor preço por item
CREATE VIEW public.quote_items_best AS
SELECT qi.id AS quote_item_id,
       sp.supplier_name AS best_supplier,
       sp.price AS best_price,
       sp.received_at AS best_price_date,
       (SELECT count(*) FROM public.supplier_prices s2 WHERE s2.quote_item_id = qi.id AND s2.price IS NOT NULL) AS quotes_count
FROM public.quote_items qi
LEFT JOIN LATERAL (
  SELECT s.supplier_name, s.price, s.received_at
  FROM public.supplier_prices s
  WHERE s.quote_item_id = qi.id AND s.price IS NOT NULL AND s.price > 0
  ORDER BY s.price ASC, s.received_at DESC NULLS LAST
  LIMIT 1
) sp ON true;
GRANT SELECT ON public.quote_items_best TO authenticated;
GRANT ALL ON public.quote_items_best TO service_role;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER rfqs_touch BEFORE UPDATE ON public.rfqs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER quote_items_touch BEFORE UPDATE ON public.quote_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();