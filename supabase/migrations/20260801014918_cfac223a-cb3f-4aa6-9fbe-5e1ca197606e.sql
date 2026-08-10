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