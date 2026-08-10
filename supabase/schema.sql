-- Full database schema for the jewelry catalog.
-- Apply to a fresh Postgres/Supabase project: psql "$DB_URL" -f supabase/schema.sql
-- Generated from supabase/migrations/* (in order).

-- ===== supabase/migrations/20260721201913_40f6c636-8893-40f2-99a2-ab794f5d79ac.sql =====

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

-- ===== supabase/migrations/20260722001932_69984151-b510-4976-a1ba-1a03430b1ee2.sql =====
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
-- ===== supabase/migrations/20260724010817_9823dcf5-1fb3-49a0-81a3-94d9f7a480ea.sql =====

-- Add slug + sort_order to items
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill slugs from title (transliterate cyrillic loosely -> keep unicode lowercase kebab)
CREATE OR REPLACE FUNCTION public.slugify(input text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' from regexp_replace(
    regexp_replace(lower(coalesce(input,'')), '[^a-z0-9а-яё]+', '-', 'g'),
    '-+', '-', 'g'
  ));
$$;

UPDATE public.items SET slug = public.slugify(title) WHERE slug IS NULL OR slug = '';

-- Ensure uniqueness by appending short id suffix on collisions
WITH d AS (
  SELECT id, slug,
    row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM public.items
)
UPDATE public.items i
SET slug = i.slug || '-' || substr(i.id::text, 1, 6)
FROM d
WHERE d.id = i.id AND d.rn > 1;

ALTER TABLE public.items ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS items_slug_key ON public.items(slug);

-- Initial sort_order based on created_at desc
WITH d AS (
  SELECT id, row_number() OVER (ORDER BY created_at DESC) * 10 AS n FROM public.items
)
UPDATE public.items i SET sort_order = d.n FROM d WHERE d.id = i.id AND i.sort_order = 0;

-- Categories: show in catalog + catalog order
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS show_in_catalog boolean NOT NULL DEFAULT false;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS catalog_order integer NOT NULL DEFAULT 0;

-- Default: show all primary categories in catalog
UPDATE public.categories SET show_in_catalog = true WHERE kind = 'primary' AND show_in_catalog = false;
UPDATE public.categories SET catalog_order = sort_order WHERE catalog_order = 0;

-- ===== supabase/migrations/20260801014918_cfac223a-cb3f-4aa6-9fbe-5e1ca197606e.sql =====
-- Harden function
CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $function$
  SELECT trim(both '-' from regexp_replace(
    regexp_replace(lower(coalesce(input,'')), '[^a-z0-9а-яё]+', '-', 'g'),
    '-+', '-', 'g'
  ));
$function$;

-- Replace permissive open policies with public-read / authenticated-write
DROP POLICY IF EXISTS "Open access items" ON public.items;
DROP POLICY IF EXISTS "Open access categories" ON public.categories;
DROP POLICY IF EXISTS "Open access item_images" ON public.item_images;
DROP POLICY IF EXISTS "Open access item_sizes" ON public.item_sizes;
DROP POLICY IF EXISTS "Open access item_tags" ON public.item_tags;
DROP POLICY IF EXISTS "Open access item_recommendations" ON public.item_recommendations;

CREATE POLICY "Public read items" ON public.items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth write items" ON public.items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth write categories" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read item_images" ON public.item_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth write item_images" ON public.item_images FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read item_sizes" ON public.item_sizes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth write item_sizes" ON public.item_sizes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read item_tags" ON public.item_tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth write item_tags" ON public.item_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read item_recommendations" ON public.item_recommendations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth write item_recommendations" ON public.item_recommendations FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT ON public.items, public.categories, public.item_images, public.item_sizes, public.item_tags, public.item_recommendations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items, public.categories, public.item_images, public.item_sizes, public.item_tags, public.item_recommendations TO authenticated;
GRANT ALL ON public.items, public.categories, public.item_images, public.item_sizes, public.item_tags, public.item_recommendations TO service_role;
