
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
