import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listCategories, type Category } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, catName, type Lang } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/admin/catalog")({
  component: CatalogTabsPage,
});

function CatalogTabsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const [selected, setSelected] = useState<Category[]>([]);

  useEffect(() => {
    if (cats.data)
      setSelected(
        cats.data
          .filter((c) => c.show_in_catalog)
          .sort((a, b) => a.catalog_order - b.catalog_order),
      );
  }, [cats.data]);

  const available = (cats.data ?? []).filter((c) => !c.show_in_catalog);

  const toggle = useMutation({
    mutationFn: async ({ id, on, order }: { id: string; on: boolean; order: number }) => {
      const { error } = await supabase
        .from("categories")
        .update({ show_in_catalog: on, catalog_order: order })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveOrder = useMutation({
    mutationFn: async (next: Category[]) => {
      const results = await Promise.all(
        next.map((c, i) =>
          supabase
            .from("categories")
            .update({ catalog_order: (i + 1) * 10 })
            .eq("id", c.id),
        ),
      );
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => {
      toast.success(t("admin.saved"));
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oi = selected.findIndex((c) => c.id === active.id);
    const ni = selected.findIndex((c) => c.id === over.id);
    const next = arrayMove(selected, oi, ni);
    setSelected(next);
    saveOrder.mutate(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("admin.catalogTabs")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.tabsHint")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {t("admin.order")}
          </h2>
          {selected.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              —
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={selected.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="divide-y rounded-md border bg-card">
                  {selected.map((c) => (
                    <SortableRow
                      key={c.id}
                      c={c}
                      lang={lang}
                      onRemove={() =>
                        toggle.mutate({ id: c.id, on: false, order: c.catalog_order })
                      }
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {t("admin.available")}
          </h2>
          <ul className="divide-y rounded-md border bg-card">
            {available.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <label className="flex flex-1 cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={false}
                    onCheckedChange={() =>
                      toggle.mutate({
                        id: c.id,
                        on: true,
                        order: (selected.length + 1) * 10,
                      })
                    }
                  />
                  <div>
                    <div className="text-sm font-medium">{catName(c, lang)}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.kind === "primary" ? t("cat.kindPrimary") : t("cat.kindTag")} · {c.slug}
                    </div>
                  </div>
                </label>
              </li>
            ))}
            {available.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">—</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SortableRow({
  c,
  lang,
  onRemove,
}: {
  c: Category;
  lang: Lang;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const { t } = useI18n();
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-3 bg-card px-3 py-2"
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground active:cursor-grabbing"
          aria-label="drag"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div>
          <div className="text-sm font-medium">{catName(c, lang)}</div>
          <div className="text-xs text-muted-foreground">
            {c.kind === "primary" ? t("cat.kindPrimary") : t("cat.kindTag")}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {t("sizes.remove")}
      </button>
    </li>
  );
}
