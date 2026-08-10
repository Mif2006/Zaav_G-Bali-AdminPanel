import { supabase } from "@/integrations/supabase/client";

export type Category = {
  id: string;
  slug: string;
  name_ru: string;
  name_en: string;
  kind: "primary" | "tag";
  sort_order: number;
  is_system: boolean;
  show_in_catalog: boolean;
  catalog_order: number;
};

export type Item = {
  id: string;
  slug: string;
  title: string;
  price: number;
  material: string | null;
  description: string | null;
  primary_category_id: string;
  size: string | null;
  size_unit: "ru" | "cm" | "mm" | null;
  main_image_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ItemImage = { id: string; item_id: string; url: string; sort_order: number };

export type ItemSize = {
  id: string;
  item_id: string;
  size: string | null;
  size_unit: "ru" | "cm" | "mm" | null;
  stock: number;
  sort_order: number;
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("kind")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function listItems() {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Item[];
}

export async function listItemTags() {
  const { data, error } = await supabase.from("item_tags").select("*");
  if (error) throw error;
  return (data ?? []) as { item_id: string; category_id: string }[];
}

async function getItemFullByRow(itemRow: Item) {
  const id = itemRow.id;
  const [imgsRes, tagsRes, recRes, sizesRes] = await Promise.all([
    supabase.from("item_images").select("*").eq("item_id", id).order("sort_order"),
    supabase.from("item_tags").select("category_id").eq("item_id", id),
    supabase
      .from("item_recommendations")
      .select("recommended_item_id, sort_order")
      .eq("item_id", id)
      .order("sort_order"),
    supabase.from("item_sizes").select("*").eq("item_id", id).order("sort_order"),
  ]);
  return {
    item: itemRow,
    images: (imgsRes.data ?? []) as ItemImage[],
    tagIds: (tagsRes.data ?? []).map((r) => r.category_id as string),
    recommendedIds: (recRes.data ?? []).map((r) => r.recommended_item_id as string),
    sizes: (sizesRes.data ?? []) as ItemSize[],
  };
}

export async function getItemFull(id: string) {
  const { data, error } = await supabase.from("items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getItemFullByRow(data as Item);
}

export async function getItemBySlug(slug: string) {
  const { data, error } = await supabase.from("items").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getItemFullByRow(data as Item);
}
