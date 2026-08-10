import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getItemBySlug, listItems } from "@/lib/db";
import { PublicShell } from "@/components/public-shell";
import { useI18n, formatPrice } from "@/lib/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/collections/$slug")({
  component: ItemPage,
  notFoundComponent: () => (
    <div className="bg-white text-black">
      <PublicShell variant="light">
        <div className="py-24 text-center text-black/60">Not found</div>
      </PublicShell>
    </div>
  ),
});

function ItemPage() {
  const { slug } = Route.useParams();
  const { t, lang } = useI18n();
  const [heroIdx, setHeroIdx] = useState(0);

  const full = useQuery({
    queryKey: ["item-slug", slug],
    queryFn: async () => {
      const r = await getItemBySlug(slug);
      if (!r) throw notFound();
      return r;
    },
  });
  const allItems = useQuery({ queryKey: ["items"], queryFn: listItems });

  if (full.isLoading || !full.data) {
    return (
      <div className="bg-white text-black">
        <PublicShell variant="light">
          <div className="py-24 text-center text-black/60">{t("loading")}</div>
        </PublicShell>
      </div>
    );
  }

  const { item, images, recommendedIds, sizes } = full.data;
  const gallery = [item.main_image_url, ...images.map((i) => i.url)].filter(
    (u): u is string => !!u,
  );
  const hero = gallery[heroIdx] ?? gallery[0];
  const recs = (allItems.data ?? []).filter((i) => recommendedIds.includes(i.id));

  const prev = () => setHeroIdx((i) => (i - 1 + gallery.length) % gallery.length);
  const next = () => setHeroIdx((i) => (i + 1) % gallery.length);

  const stockRows = sizes.filter((s) => s.size);
  const stockOnly = sizes.find((s) => !s.size);

  return (
    <div className="bg-white text-black">
      <PublicShell variant="light">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          {/* Gallery */}
          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
              {hero ? (
                <img src={hero} alt={item.title} className="h-full w-full object-cover" />
              ) : null}
              {gallery.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    aria-label="prev"
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/70 p-2 backdrop-blur transition hover:bg-white"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={next}
                    aria-label="next"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/70 p-2 backdrop-blur transition hover:bg-white"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                    {heroIdx + 1} / {gallery.length}
                  </div>
                </>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {gallery.map((u, i) => (
                  <button
                    key={u + i}
                    onClick={() => setHeroIdx(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden border ${
                      heroIdx === i ? "border-black" : "border-transparent opacity-60"
                    }`}
                  >
                    <img src={u} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <h1 className="text-3xl font-bold md:text-4xl">{item.title}</h1>
            <div className="text-lg tabular-nums">
              {formatPrice(item.price, lang)}
            </div>

            <div className="h-px w-full bg-black/10" />

            <div className="space-y-1.5 text-sm">
              {item.material && (
                <div>
                  <span className="font-semibold">{t("field.material")}:</span> {item.material}
                </div>
              )}
              {stockRows.length > 0 && (
                <div>
                  <span className="font-semibold">{t("field.size")}:</span>{" "}
                  {stockRows
                    .map((s) =>
                      s.size_unit && s.size_unit !== "ru"
                        ? `${s.size} ${s.size_unit}`
                        : s.size,
                    )
                    .join(", ")}
                </div>
              )}
              {stockOnly && (
                <div>
                  <span className="font-semibold">{t("field.stock")}:</span> {stockOnly.stock}
                </div>
              )}
            </div>

            {item.description && (
              <div
                className="prose prose-sm max-w-none text-black"
                dangerouslySetInnerHTML={{ __html: item.description }}
              />
            )}
          </div>
        </div>

        {recs.length > 0 && (
          <section className="mt-24">
            <h2 className="mb-6 text-2xl font-bold">
              {t("catalog.alsoLike")}
            </h2>
            <div className="grid grid-cols-2 gap-x-2 gap-y-8 sm:grid-cols-4 md:gap-x-4">
              {recs.map((r) => (
                <Link
                  to="/collections/$slug"
                  params={{ slug: r.slug }}
                  key={r.id}
                  className="group block"
                >
                  <div className="aspect-square overflow-hidden bg-neutral-100">
                    {r.main_image_url && (
                      <img
                        src={r.main_image_url}
                        alt=""
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <div className="pt-3">
                    <div className="text-sm font-medium">{r.title}</div>
                    <div className="mt-0.5 text-sm text-black/70 tabular-nums">
                      {formatPrice(r.price, lang)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </PublicShell>
    </div>
  );
}
