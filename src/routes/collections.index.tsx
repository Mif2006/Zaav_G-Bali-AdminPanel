import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listCategories, listItems, listItemTags, type Category, type Item } from "@/lib/db";
import { PublicShell } from "@/components/public-shell";
import { useI18n, catName, formatPrice } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/collections/")({
  head: () => ({
    meta: [
      { title: "Collections — Find Your Piece" },
      {
        name: "description",
        content: "Browse all jewelry: rings, earrings, bracelets, pendants, chains.",
      },
      { property: "og:title", content: "Collections — Find Your Piece" },
      { property: "og:description", content: "Browse all jewelry pieces." },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const { t, lang } = useI18n();
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const cats = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const items = useQuery({ queryKey: ["items"], queryFn: listItems });
  const tags = useQuery({ queryKey: ["item_tags"], queryFn: listItemTags });

  const tabCats = useMemo(
    () =>
      (cats.data ?? [])
        .filter((c) => c.show_in_catalog)
        .sort((a, b) => a.catalog_order - b.catalog_order),
    [cats.data],
  );

  const tagIdsByItem = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const tt of tags.data ?? []) {
      if (!m.has(tt.item_id)) m.set(tt.item_id, new Set());
      m.get(tt.item_id)!.add(tt.category_id);
    }
    return m;
  }, [tags.data]);

  const matchesCategory = (it: Item, c: Category) =>
    c.kind === "primary"
      ? it.primary_category_id === c.id
      : tagIdsByItem.get(it.id)?.has(c.id) ?? false;

  const filtered = (items.data ?? []).filter((i) => {
    if (!activeCat) return true;
    const c = tabCats.find((tc) => tc.id === activeCat);
    return c ? matchesCategory(i, c) : true;
  });

  return (
    <div className="bg-white text-black">
      <PublicShell variant="light">
        <section className="pt-4 pb-10 text-center md:pt-10 md:pb-16">
          <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
            {t("catalog.heading")}
          </h1>
        </section>

        <div className="mb-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-b border-black/10 pb-4 text-sm uppercase tracking-[0.15em]">
          <button
            onClick={() => setActiveCat(null)}
            className={cn(
              "relative pb-3 transition",
              !activeCat
                ? "font-semibold text-black after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-black"
                : "text-black/60 hover:text-black",
            )}
          >
            {t("catalog.all")}
          </button>
          {tabCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={cn(
                "relative pb-3 transition",
                activeCat === c.id
                  ? "font-semibold text-black after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-black"
                  : "text-black/60 hover:text-black",
              )}
            >
              {catName(c, lang)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="py-24 text-center text-black/50">{t("catalog.empty")}</div>
        ) : (
          <div className="grid grid-cols-2 gap-x-2 gap-y-10 sm:grid-cols-3 md:gap-x-4 lg:grid-cols-5">
            {filtered.map((it) => (
              <Link
                to="/collections/$slug"
                params={{ slug: it.slug }}
                key={it.id}
                className="group block"
              >
                <div className="aspect-square overflow-hidden bg-neutral-100">
                  {it.main_image_url ? (
                    <img
                      src={it.main_image_url}
                      alt={it.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-black/40">
                      no image
                    </div>
                  )}
                </div>
                <div className="pt-3">
                  <div className="text-sm font-medium">{it.title}</div>
                  <div className="mt-0.5 text-sm text-black/70 tabular-nums">
                    {formatPrice(it.price, lang)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PublicShell>
    </div>
  );
}
