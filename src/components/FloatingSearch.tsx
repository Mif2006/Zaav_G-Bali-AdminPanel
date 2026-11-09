
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { listItems, type Item } from "@/lib/db";
import { useI18n, formatPrice, type Lang } from "@/lib/i18n";

const translations = {
  en: {
    search: "Search products...",
    noResults: "No results found",
    loading: "Loading...",
    error: "Unable to load products",
    close: "Close search",
    clear: "Clear search",
  },
  ru: {
    search: "Поиск изделий...",
    noResults: "Ничего не найдено",
    loading: "Загрузка...",
    error: "Не удалось загрузить изделия",
    close: "Закрыть поиск",
    clear: "Очистить поиск",
  },
  id: {
    search: "Cari produk...",
    noResults: "Tidak ada hasil",
    loading: "Memuat...",
    error: "Gagal memuat produk",
    close: "Tutup pencarian",
    clear: "Hapus pencarian",
  },
} as const;

export function AdminFloatingToolbar() {
  const { lang } = useI18n();
  const t = translations[lang as Lang] || translations.en;

  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Check whether another admin component has already loaded products.
  const cachedItems = queryClient.getQueryData<Item[]>(["items"]);

  // Only fetch when the search is opened and no cached data exists.
  // The result is stored under the same query key used by AdminItemsGrid.
  const itemsQuery = useQuery({
    queryKey: ["items"],
    queryFn: listItems,
    enabled: searchOpen && cachedItems === undefined,
    staleTime: Infinity,
  });

  const items = itemsQuery.data ?? cachedItems ?? [];

  // Lock background scrolling while the search is open.
  useEffect(() => {
    if (!searchOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [searchOpen]);

  // Focus the search field when opened.
  useEffect(() => {
    if (!searchOpen) {
      setQuery("");
      return;
    }

    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [searchOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!searchOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [searchOpen]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return [];

    return items.filter((item) =>
      item.title.toLowerCase().includes(normalizedQuery)
    );
  }, [items, query]);

  const isLoading = itemsQuery.isFetching && items.length === 0;
  const hasError = itemsQuery.isError && items.length === 0;

  return (
    <>
      {/* FLOATING SEARCH BUTTON */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label="Search products"
        className="fixed top-32 right-8 z-40 flex h-12 w-12 items-center justify-center rounded-full border bg-background shadow-lg transition hover:scale-105 hover:bg-muted"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* SEARCH OVERLAY */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t.search}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSearchOpen(false);
            }
          }}
        >
          <div className="mx-auto mt-[10vh] w-full max-w-2xl">
            <div className="overflow-hidden rounded-2xl border bg-background shadow-2xl">
              {/* SEARCH INPUT */}
              <div className="flex items-center gap-3 border-b px-4">
                <Search className="h-5 w-5 shrink-0 text-muted-foreground" />

                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.search}
                  autoComplete="off"
                  aria-label={t.search}
                  className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />

                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={t.clear}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t.close}
                >
                  Esc
                </button>
              </div>

              {/* SEARCH RESULTS */}
              {query.trim() && (
                <div className="max-h-[60vh] overflow-y-auto">
                  {isLoading ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      {t.loading}
                    </div>
                  ) : hasError ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      {t.error}
                    </div>
                  ) : filteredItems.length > 0 ? (
                    <div className="divide-y">
                      {filteredItems.map((item) => (
                        <Link
                          key={item.id}
                          to="/admin/items/$id"
                          params={{ id: item.id }}
                          className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50"
                          onClick={() => setSearchOpen(false)}
                        >
                          {item.main_image_url ? (
                            <img
                              src={item.main_image_url}
                              alt={item.title}
                              className="h-12 w-12 shrink-0 rounded-xl bg-muted object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 shrink-0 rounded-xl bg-muted" />
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">
                              {item.title}
                            </div>

                            <div className="mt-0.5 text-sm text-muted-foreground">
                              {formatPrice(item.price, lang)}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      {t.noResults}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
