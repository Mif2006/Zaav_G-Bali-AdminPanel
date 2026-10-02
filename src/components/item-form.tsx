import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listCategories, listItems, getItemFull, slugify, type Item } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { RichTextEditor } from "@/components/rich-text-editor";
import { SingleImageUploader, MultiImageUploader } from "@/components/image-uploader";
import { useI18n, catName } from "@/lib/i18n";
import { ArrowLeft, X, Loader2, Trash2, Plus } from "lucide-react";

type SizeRow = {
  size: string;
  size_unit: "" | "ru" | "cm" | "mm";
  stock: string;
};

type FormState = {
  title: string;
  slug: string;
  price: string;
  material: string;
  description: string;
  primary_category_id: string;
  main_image_url: string | null;
  tagIds: string[];
  detailImages: string[];
  recommendedIds: string[];
  sizes: SizeRow[];
  stock: string; // used when the category has no size (earrings)
};

const empty: FormState = {
  title: "",
  slug: "",
  price: "0",
  material: "",
  description: "",
  primary_category_id: "",
  main_image_url: null,
  tagIds: [],
  detailImages: [],
  recommendedIds: [],
  sizes: [],
  stock: "0",
};


export function ItemForm({ itemId }: { itemId?: string }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const cats = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const allItems = useQuery({ queryKey: ["items"], queryFn: listItems });
  const existing = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => (itemId ? getItemFull(itemId) : null),
    enabled: !!itemId,
  });

  const [f, setF] = useState<FormState>(empty);
  const [loaded, setLoaded] = useState(!itemId);

  useEffect(() => {
    if (!itemId || !existing.data) return;
    const { item, images, tagIds, recommendedIds, sizes } = existing.data;
    // Split existing size rows: those with a `size` value are size rows;
    // one row with null size represents stock-only (for earrings).
    const sized = sizes.filter((s) => s.size);
    const stockOnly = sizes.find((s) => !s.size);
    setF({
      title: item.title,
      slug: item.slug,
      price: String(item.price),
      material: item.material ?? "",
      description: item.description ?? "",
      primary_category_id: item.primary_category_id,
      main_image_url: item.main_image_url,
      tagIds,
      detailImages: images.map((i) => i.url),
      recommendedIds,
      sizes: sized.map((s) => ({
        size: s.size ?? "",
        size_unit: (s.size_unit ?? "") as SizeRow["size_unit"],
        stock: String(s.stock),
      })),
      stock: String(stockOnly?.stock ?? 0),
    });
    setLoaded(true);
  }, [itemId, existing.data]);


  const primary = useMemo(
    () => (cats.data ?? []).filter((c) => c.kind === "primary"),
    [cats.data],
  );
  const tagCats = useMemo(() => (cats.data ?? []).filter((c) => c.kind === "tag"), [cats.data]);

  const primaryCat = primary.find((c) => c.id === f.primary_category_id);
  const isEarring = primaryCat?.slug === "earrings";
  const isRing =
    primaryCat?.slug === "rings" || primaryCat?.slug === "phalange-rings";
  const defaultUnit: SizeRow["size_unit"] = isRing ? "ru" : "cm";

  const formatPrice = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits ? Number(digits).toLocaleString("de-DE") : "";
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!f.title.trim()) throw new Error("Title required");
      if (!f.primary_category_id) throw new Error("Category required");

      const payload = {
        title: f.title.trim(),
        slug: (f.slug.trim() || slugify(f.title)) || slugify(f.title),
        price: Number(f.price) || 0,
        material: f.material || null,
        description: f.description || null,
        primary_category_id: f.primary_category_id,
        size: isEarring ? null : f.sizes[0]?.size || null,
        size_unit: isEarring ? null : (f.sizes[0]?.size_unit || null),
        main_image_url: f.main_image_url,
      };


      let id = itemId;
      if (id) {
        const { error } = await supabase.from("items").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("items").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id as string;
      }

      // tags: replace all
      await supabase.from("item_tags").delete().eq("item_id", id);
      if (f.tagIds.length) {
        const { error } = await supabase
          .from("item_tags")
          .insert(f.tagIds.map((cid) => ({ item_id: id!, category_id: cid })));
        if (error) throw error;
      }

      // detail images: replace all
      await supabase.from("item_images").delete().eq("item_id", id);
      if (f.detailImages.length) {
        const { error } = await supabase.from("item_images").insert(
          f.detailImages.map((url, i) => ({ item_id: id!, url, sort_order: i })),
        );
        if (error) throw error;
      }

      // recommendations
      await supabase.from("item_recommendations").delete().eq("item_id", id);
      if (f.recommendedIds.length) {
        const { error } = await supabase.from("item_recommendations").insert(
          f.recommendedIds.map((rid, i) => ({
            item_id: id!,
            recommended_item_id: rid,
            sort_order: i,
          })),
        );
        if (error) throw error;
      }

      // sizes / stock: replace all
      await supabase.from("item_sizes").delete().eq("item_id", id);
      const sizeRows: Array<{
        item_id: string;
        size: string | null;
        size_unit: string | null;
        stock: number;
        sort_order: number;
      }> = [];
      if (isEarring) {
        sizeRows.push({
          item_id: id!,
          size: null,
          size_unit: null,
          stock: Math.max(0, Number(f.stock) || 0),
          sort_order: 0,
        });
      } else {
        f.sizes.forEach((s, i) => {
          if (!s.size.trim()) return;
          sizeRows.push({
            item_id: id!,
            size: s.size.trim(),
            size_unit: s.size_unit || defaultUnit,
            stock: Math.max(0, Number(s.stock) || 0),
            sort_order: i,
          });
        });
      }
      if (sizeRows.length) {
        const { error } = await supabase.from("item_sizes").insert(sizeRows);
        if (error) throw error;
      }

      return id!;
    },
    onSuccess: (id) => {
      toast.success(t("admin.saved"));
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["item", id] });
      qc.invalidateQueries({ queryKey: ["item_tags"] });
      if (!itemId) navigate({ to: "/admin/items/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!itemId) return;
      const { error } = await supabase.from("items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.deleted"));
      qc.invalidateQueries({ queryKey: ["items"] });
      navigate({ to: "/admin" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!loaded) return <div className="text-muted-foreground">{t("loading")}</div>;

  const otherItems = (allItems.data ?? []).filter((i: Item) => i.id !== itemId);
  const recItems = f.recommendedIds
    .map((id) => otherItems.find((i) => i.id === id))
    .filter((i): i is Item => !!i);

  const addSize = () =>
    setF({
      ...f,
      sizes: [...f.sizes, { size: "", size_unit: defaultUnit, stock: "0" }],
    });
  const updateSize = (idx: number, patch: Partial<SizeRow>) =>
    setF({
      ...f,
      sizes: f.sizes.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    });
  const removeSize = (idx: number) =>
    setF({ ...f, sizes: f.sizes.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/admin" })}
            aria-label="Back to admin"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold">
          {itemId ? t("admin.editItem") : t("admin.newItem")}
          </h1>
        </div>
        <div className="flex gap-2">
          {itemId && (
            <Button
              variant="destructive"
              onClick={() => {
                if (window.confirm(t("admin.confirmDelete"))) del.mutate();
              }}
              disabled={del.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("admin.deleteItem")}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/admin/items/new" })}
          >
            {t("admin.newItem")}
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {save.isPending ? t("admin.saving") : t("admin.save")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label>{t("field.title")}</Label>
                <Input
                  value={f.title}
                  onChange={(e) => {
                    const next = e.target.value;
                    setF((prev) => ({
                      ...prev,
                      title: next,
                      slug: prev.slug === "" || prev.slug === slugify(prev.title) ? slugify(next) : prev.slug,
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("field.slug")}</Label>
                <Input
                  value={f.slug}
                  placeholder={slugify(f.title)}
                  onChange={(e) => setF({ ...f, slug: e.target.value })}
                />
                <div className="text-xs text-muted-foreground">/collections/{f.slug || slugify(f.title) || "…"}</div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("field.price")} (IDR)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatPrice(f.price)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setF({ ...f, price: raw });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("field.material")}</Label>
                  <Input
                    value={f.material}
                    onChange={(e) => setF({ ...f, material: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("field.description")}</Label>
                <RichTextEditor
                  value={f.description}
                  onChange={(html) => setF({ ...f, description: html })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <Label>{t("field.mainImage")}</Label>
              <SingleImageUploader
                value={f.main_image_url}
                onChange={(url) => setF({ ...f, main_image_url: url })}
              />
              <div className="pt-2">
                <Label>{t("field.detailImages")}</Label>
                <div className="pt-2">
                  <MultiImageUploader
                    value={f.detailImages}
                    onChange={(urls) => setF({ ...f, detailImages: urls })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <Label>{t("field.recommendations")}</Label>
              <div className="flex flex-wrap gap-2">
                {recItems.map((it) => (
                  <span
                    key={it.id}
                    className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm"
                  >
                    {it.title}
                    <button
                      type="button"
                      onClick={() =>
                        setF({
                          ...f,
                          recommendedIds: f.recommendedIds.filter((x) => x !== it.id),
                        })
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <Select
                value=""
                onValueChange={(id) => {
                  if (!f.recommendedIds.includes(id))
                    setF({ ...f, recommendedIds: [...f.recommendedIds, id] });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("select.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {otherItems
                    .filter((i) => !f.recommendedIds.includes(i.id))
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label>{t("field.category")}</Label>
                <Select
                  value={f.primary_category_id}
                  onValueChange={(v) => setF({ ...f, primary_category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("select.placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {primary.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {catName(c, lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <Label>{t("field.tags")}</Label>
              <div className="space-y-2">
                {tagCats.map((tag) => {
                  const checked = f.tagIds.includes(tag.id);
                  return (
                    <label
                      key={tag.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setF({
                            ...f,
                            tagIds: v
                              ? [...f.tagIds, tag.id]
                              : f.tagIds.filter((x) => x !== tag.id),
                          });
                        }}
                      />
                      <span className="text-sm">{catName(tag, lang)}</span>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sizes / stock — full width at the bottom */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <Label className="text-base">
              {isEarring ? t("field.stockOnly") : t("field.sizes")}
            </Label>
            {!isEarring && (
              <Button type="button" variant="outline" size="sm" onClick={addSize}>
                <Plus className="mr-1 h-4 w-4" />
                {t("sizes.add")}
              </Button>
            )}
          </div>

          {isEarring ? (
            <div className="max-w-xs space-y-2">
              <Label>{t("field.stock")}</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={f.stock}
                onChange={(e) => setF({ ...f, stock: e.target.value })}
              />
            </div>
          ) : f.sizes.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t("sizes.add")}
            </div>
          ) : (
            <div className="space-y-2">
              {f.sizes.map((s, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_140px_140px_auto] items-end gap-3 rounded-md border p-3"
                >
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {t("field.size")}
                    </Label>
                    <Input
                      value={s.size}
                      onChange={(e) => updateSize(i, { size: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {t("field.sizeUnit")}
                    </Label>
                    <Select
                      value={s.size_unit || defaultUnit}
                      onValueChange={(v) =>
                        updateSize(i, { size_unit: v as SizeRow["size_unit"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ru">{t("unit.ru")}</SelectItem>
                        <SelectItem value="cm">{t("unit.cm")}</SelectItem>
                        <SelectItem value="mm">{t("unit.mm")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {t("field.stock")}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={s.stock}
                      onChange={(e) => updateSize(i, { stock: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSize(i)}
                    aria-label={t("sizes.remove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// re-export for consumers
export type { Item };
