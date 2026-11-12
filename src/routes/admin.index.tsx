import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listCategories, listItems, listItemTags, type Category, type Item } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, GripVertical, Search, X } from "lucide-react";
import { useI18n, catName, formatPrice, type Lang } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AdminFloatingToolbar } from "@/components/FloatingSearch";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminItemsGrid,
});

function AdminItemsGrid() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const items = useQuery({ queryKey: ["items"], queryFn: listItems });
  const tags = useQuery({ queryKey: ["item_tags"], queryFn: listItemTags });

  const [activeCat, setActiveCat] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem("admin-items-active-category");
  });

  // Keep the selected category when navigating to an item and back.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeCat) {
      window.sessionStorage.setItem("admin-items-active-category", activeCat);
    } else {
      window.sessionStorage.removeItem("admin-items-active-category");
    }
  }, [activeCat]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Items carrying the special `hidden` tag are inactive on the public website.
  const hiddenCategoryIds = useMemo(
    () =>
      new Set(
        (cats.data ?? [])
          .filter((c) => {
            const name = (c.name || "").trim().toLowerCase();
            const slug = (c.slug || "").trim().toLowerCase();
            return name === "hidden" || slug === "hidden";
          })
          .map((c) => c.id),
      ),
    [cats.data],
  );

  const isHiddenItem = (item: Item) =>
    [...(tagIdsByItem.get(item.id) ?? [])].some((id) => hiddenCategoryIds.has(id));

  const matchesCategory = (it: Item, c: Category) =>
    c.kind === "primary"
      ? it.primary_category_id === c.id
      : tagIdsByItem.get(it.id)?.has(c.id) ?? false;

  const [order, setOrder] = useState<Item[]>([]);
  useEffect(() => {
    if (items.data) setOrder(items.data);
  }, [items.data]);

  useEffect(() => {
    if (!searchOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) setSearchQuery("");
  }, [searchOpen]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const saveOrder = useMutation({
    mutationFn: async (next: Item[]) => {
      const updates = next.map((it, i) =>
        supabase.from("items").update({ sort_order: (i + 1) * 10 }).eq("id", it.id),
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => {
      toast.success(t("admin.saved"));
      qc.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredOrder = useMemo(() => {
    const activeCategory = activeCat ? tabCats.find((c) => c.id === activeCat) : null;

    return activeCategory
      ? order.filter((item) => matchesCategory(item, activeCategory))
      : order;
  }, [activeCat, order, tabCats, tagIdsByItem]);

  const searchResults = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) return [];

    return order.filter((item) => item.title.toLowerCase().includes(normalizedQuery));
  }, [order, searchQuery]);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.findIndex((i) => i.id === active.id);
    const newIdx = order.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(order, oldIdx, newIdx);
    setOrder(next);
    saveOrder.mutate(next);
  };

  return (
    <div className="space-y-6">
     
     <AdminFloatingToolbar />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("admin.items")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.orderHint")}</p>
        </div>
        <Button asChild>
          <Link to="/admin/items/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.newItem")}
          </Link>
        </Button>
      </div>


      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border pb-3 text-sm">
        <button
          type="button"
          onClick={() => setActiveCat(null)}
          className={`relative pb-2 transition ${
            !activeCat
              ? "font-semibold text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("catalog.all")}
        </button>
        {tabCats.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCat(c.id)}
            className={`relative pb-2 transition ${
              activeCat === c.id
                ? "font-semibold text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {catName(c, lang)}
          </button>
        ))}
      </div>

      {items.isLoading ? (
        <div className="text-muted-foreground">{t("loading")}</div>
      ) : order.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          {t("catalog.empty")}
        </div>
      ) : filteredOrder.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          No results found
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={filteredOrder.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredOrder.map((it) => (
                <SortableCard
                  key={it.id}
                  item={it}
                  lang={lang}
                  isHidden={isHiddenItem(it)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSearchOpen(false);
          }}
        >
          <div className="mx-auto mt-[10vh] w-full max-w-2xl">
            <div className="overflow-hidden rounded-2xl border bg-background shadow-2xl">
              <div className="flex items-center gap-3 border-b px-4">
                <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  autoComplete="off"
                  className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Esc
                </button>
              </div>

              {searchQuery.trim() && (
                <div className="max-h-[60vh] overflow-y-auto">
                  {searchResults.length > 0 ? (
                    <div className="divide-y">
                      {searchResults.map((item) => (
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
                              className="h-12 w-12 shrink-0 rounded-xl object-cover bg-muted"
                            />
                          ) : (
                            <div className="h-12 w-12 shrink-0 rounded-xl bg-muted" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{item.title}</div>
                            <div className="mt-0.5 text-sm text-muted-foreground">
                              {formatPrice(item.price, lang)}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      No results found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableCard({
  item,
  lang,
  isHidden,
}: {
  item: Item;
  lang: Lang;
  isHidden: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative overflow-hidden rounded-lg border bg-card ${
        isHidden ? "border-dashed border-muted-foreground/40 bg-muted/40" : ""
      }`}
    >
      {isHidden && (
        <div className="absolute right-2 top-2 z-10 rounded-md border border-border bg-background/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shadow-sm">
          Inactive
        </div>
      )}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 z-10 rounded-md bg-background/90 p-1.5 shadow-sm opacity-0 transition group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        aria-label="drag"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className={`aspect-square overflow-hidden bg-muted ${isHidden ? "bg-muted/70" : ""}`}>
        {item.main_image_url ? (
          <img
            src={item.main_image_url}
            alt=""
            className={`h-full w-full object-cover ${
              isHidden ? "grayscale opacity-55" : ""
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            no image
          </div>
        )}
      </div>
      <div className={`flex items-start justify-between gap-2 p-3 ${isHidden ? "text-muted-foreground" : ""}`}>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm font-medium ${isHidden ? "text-muted-foreground" : ""}`}>
            {item.title}
          </div>
          <div className="text-xs tabular-nums text-muted-foreground">
            {formatPrice(item.price, lang)}
          </div>
        </div>
        <Button asChild size="icon" variant="ghost" className="shrink-0">
          <Link to="/admin/items/$id" params={{ id: item.id }} aria-label="edit">
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div> 
  );
}
