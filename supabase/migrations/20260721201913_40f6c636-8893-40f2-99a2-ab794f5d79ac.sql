
-- Timestamp trigger fn
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Categories (primary + tags)
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_ru TEXT NOT NULL,
  name_en TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('primary','tag')),
  sort_order INT NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);

-- Items
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  material TEXT,
  description TEXT,
  primary_category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  size TEXT,
  size_unit TEXT CHECK (size_unit IN ('ru','cm','mm') OR size_unit IS NULL),
  main_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO anon, authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access items" ON public.items FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX items_primary_category_idx ON public.items(primary_category_id);

-- Item tags
CREATE TABLE public.item_tags (
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_tags TO anon, authenticated;
GRANT ALL ON public.item_tags TO service_role;
ALTER TABLE public.item_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access item_tags" ON public.item_tags FOR ALL USING (true) WITH CHECK (true);

-- Item detail images
CREATE TABLE public.item_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_images TO anon, authenticated;
GRANT ALL ON public.item_images TO service_role;
ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access item_images" ON public.item_images FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX item_images_item_idx ON public.item_images(item_id);

-- Recommendations
CREATE TABLE public.item_recommendations (
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  recommended_item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, recommended_item_id),
  CHECK (item_id <> recommended_item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_recommendations TO anon, authenticated;
GRANT ALL ON public.item_recommendations TO service_role;
ALTER TABLE public.item_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access item_recommendations" ON public.item_recommendations FOR ALL USING (true) WITH CHECK (true);

-- Seed primary categories and default tags
INSERT INTO public.categories (slug, name_ru, name_en, kind, sort_order, is_system) VALUES
  ('rings',          'Кольца',           'Rings',          'primary', 10, true),
  ('earrings',       'Серьги',           'Earrings',       'primary', 20, true),
  ('bracelets',      'Браслеты',         'Bracelets',      'primary', 30, true),
  ('pendants',       'Подвески',         'Pendants',       'primary', 40, true),
  ('phalange-rings', 'Фаланговые кольца','Phalange rings', 'primary', 50, true),
  ('chains',         'Цепи',             'Chains',         'primary', 60, true),
  ('mens',       'Мужские украшения', 'Men''s jewelry', 'tag', 10, true),
  ('new',        'Новинка',           'New',            'tag', 20, true),
  ('bestseller', 'Хит продаж',        'Bestseller',     'tag', 30, true),
  ('main-page',  'Главная страница',  'Main page',      'tag', 40, true);
