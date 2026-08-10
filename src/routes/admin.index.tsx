import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listItems, type Item } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, GripVertical } from "lucide-react";
import { useI18n, formatPrice, type Lang } from "@/lib/i18n";
import { useEffect, useState } from "react";
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
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminItemsGrid,
});

function AdminItemsGrid() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["items"], queryFn: listItems });

  const [order, setOrder] = useState<Item[]>([]);
  useEffect(() => {
    if (items.data) setOrder(items.data);
  }, [items.data]);

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

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.findIndex((i) => i.id === active.id);
    const newIdx = order.findIndex((i) => i.id === over.id);
    const next = arrayMove(order, oldIdx, newIdx);
    setOrder(next);
    saveOrder.mutate(next);
  };

  return (
    <div className="space-y-6">
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

      {items.isLoading ? (
        <div className="text-muted-foreground">{t("loading")}</div>
      ) : order.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          {t("catalog.empty")}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {order.map((it) => (
                <SortableCard key={it.id} item={it} lang={lang} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableCard({ item, lang }: { item: Item; lang: Lang }) {
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
      className="group relative overflow-hidden rounded-lg border bg-card"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 z-10 rounded-md bg-background/90 p-1.5 shadow-sm opacity-0 transition group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        aria-label="drag"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="aspect-square overflow-hidden bg-muted">
        {item.main_image_url ? (
          <img src={item.main_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            no image
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{item.title}</div>
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
