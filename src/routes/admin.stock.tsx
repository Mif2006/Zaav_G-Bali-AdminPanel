import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  listCategories,
  listItems,
  listItemTags,
  getItemBySlug,
  type Category,
  type Item,
} from "@/lib/db";
import { useI18n, catName, type Lang } from "@/lib/i18n";
import { AdminFloatingToolbar } from "@/components/FloatingSearch";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/stock")({
  component: AdminStockPage,
});

function AdminStockPage() {
  const { t, lang } = useI18n();

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });
  const tags = useQuery({
    queryKey: ["item_tags"],
    queryFn: listItemTags,
  });

  // The public item detail loader already provides each item's size/stock rows.
  // Reuse it here so this page does not need to duplicate the database schema.
  const stockItems = useQuery({
    queryKey: ["admin-stock-items"],
    queryFn: async () => {
      const items = await listItems();
      return Promise.all(
        items.map(async (item) => {
          const full = await getItemBySlug(item.slug);
          return {
            item,
            sizes: full?.sizes ?? [],
          };
        }),
      );
    },
  });

  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const visibleCategories = useMemo(
    () =>
      (categories.data ?? [])
        .filter((category) => category.show_in_catalog)
        .sort((a, b) => a.catalog_order - b.catalog_order),
    [categories.data],
  );

  const tagIdsByItem = useMemo(() => {
    const result = new Map<string, Set<string>>();
    for (const tag of tags.data ?? []) {
      if (!result.has(tag.item_id)) result.set(tag.item_id, new Set());
      result.get(tag.item_id)!.add(tag.category_id);
    }
    return result;
  }, [tags.data]);

  const hiddenCategoryIds = useMemo(
    () =>
      new Set(
        (categories.data ?? [])
          .filter((category) => {
            const name = (category.name || "").trim().toLowerCase();
            const slug = (category.slug || "").trim().toLowerCase();
            return name === "hidden" || slug === "hidden";
          })
          .map((category) => category.id),
      ),
    [categories.data],
  );

  const isHidden = (item: Item) =>
    [...(tagIdsByItem.get(item.id) ?? [])].some((id) =>
      hiddenCategoryIds.has(id),
    );

  const matchesCategory = (item: Item, category: Category) =>
    category.kind === "primary"
      ? item.primary_category_id === category.id
      : (tagIdsByItem.get(item.id)?.has(category.id) ?? false);

  const filteredItems = useMemo(() => {
    const rows = stockItems.data ?? [];
    if (!activeCategory) return rows;

    const category = visibleCategories.find((entry) => entry.id === activeCategory);
    return category
      ? rows.filter(({ item }) => matchesCategory(item, category))
      : rows;
  }, [activeCategory, stockItems.data, visibleCategories, tagIdsByItem]);

  const loading = categories.isLoading || tags.isLoading || stockItems.isLoading;
  const error = categories.error || tags.error || stockItems.error;

  return (
    <div className="space-y-6">
      <AdminFloatingToolbar />

      <div>
        <h1 className="text-2xl font-semibold">Stock overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A read-only overview of item stock, with quantities split by size.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border pb-3 text-sm">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`relative pb-2 transition ${
            !activeCategory
              ? "font-semibold text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("catalog.all")}
        </button>

        {visibleCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategory(category.id)}
            className={`relative pb-2 transition ${
              activeCategory === category.id
                ? "font-semibold text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {catName(category, lang as Lang)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading stock…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load stock data: {(error as Error).message}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          No items found in this category.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-12 px-3 py-3 font-medium"> </th>
                  <th className="px-3 py-3 font-medium">Item</th>
                  <th className="w-36 px-3 py-3 text-right font-medium">
                    Total stock
                  </th>
                  <th className="w-12 px-3 py-3"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map(({ item, sizes }) => {
                  const hidden = isHidden(item);
                  const totalStock = sizes.reduce(
                    (total, size) => total + (Number(size.stock) || 0),
                    0,
                  );

                  return (
                    <StockTableRow
                      key={item.id}
                      item={item}
                      sizes={sizes}
                      totalStock={totalStock}
                      hidden={hidden}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
          </div>
        </div>
      )}
    </div>
  );
}

type StockSize = NonNullable<Awaited<ReturnType<typeof getItemBySlug>>>["sizes"] extends (infer S)[]
  ? S
  : never;

function StockTableRow({
  item,
  sizes,
  totalStock,
  hidden,
}: {
  item: Item;
  sizes: StockSize[];
  totalStock: number;
  hidden: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className={`transition-colors ${
          hidden
            ? "bg-muted/50 text-muted-foreground"
            : "bg-background hover:bg-muted/30"
        }`}
      >
        <td className="px-3 py-3">
          {item.main_image_url ? (
            <img
              src={item.main_image_url}
              alt=""
              className={`h-10 w-10 rounded-md bg-muted object-cover ${
                hidden ? "grayscale opacity-50" : ""
              }`}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </td>
        <td className="px-3 py-3">
          <div className={`font-medium ${hidden ? "text-muted-foreground" : ""}`}>
            {item.title}
          </div>
          {hidden && (
            <span className="mt-1 inline-flex rounded border border-dashed border-muted-foreground/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Inactive
            </span>
          )}
        </td>
        <td className="px-3 py-3 text-right">
          <span
            className={`inline-flex min-w-10 justify-center rounded-md px-2 py-1 font-semibold tabular-nums ${
              totalStock > 0
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {totalStock}
          </span>
        </td>
        <td className="px-3 py-3 text-right">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} size stock for ${item.title}`}
            className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className={hidden ? "bg-muted/30" : "bg-muted/20"}>
          <td colSpan={4} className="px-4 py-3">
            <div className="ml-10 max-w-xl overflow-hidden rounded-md border bg-background">
              <div className="grid grid-cols-[1fr_auto] gap-4 border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Size</span>
                <span className="text-right">Stock</span>
              </div>
              {sizes.length > 0 ? (
                <div className="divide-y">
                  {sizes.map((size, index) => {
                    const sizeLabel = size.size
                      ? `${size.size}${size.size_unit && size.size_unit !== "ru" ? ` ${size.size_unit}` : ""}`
                      : "One size";

                    return (
                      <div
                        key={`${size.size ?? "one-size"}-${index}`}
                        className="grid grid-cols-[1fr_auto] gap-4 px-3 py-2 text-sm"
                      >
                        <span className="text-muted-foreground">{sizeLabel}</span>
                        <span className="min-w-8 text-right font-medium tabular-nums">
                          {Number(size.stock) || 0}
                        </span>
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-[1fr_auto] gap-4 border-t bg-muted/30 px-3 py-2 text-sm font-semibold">
                    <span>Total</span>
                    <span className="min-w-8 text-right tabular-nums">
                      {totalStock}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  No size stock records.
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
