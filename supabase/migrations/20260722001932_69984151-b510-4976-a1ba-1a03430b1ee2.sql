CREATE TABLE public.item_sizes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  size text,
  size_unit text,
  stock integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_sizes TO anon, authenticated;
GRANT ALL ON public.item_sizes TO service_role;
ALTER TABLE public.item_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access item_sizes" ON public.item_sizes FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX item_sizes_item_id_idx ON public.item_sizes(item_id);