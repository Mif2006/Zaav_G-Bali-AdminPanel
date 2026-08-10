import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listCategories, type Category } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/admin/categories")({
  component: CategoriesPage,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-я\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function CategoriesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const primary = (cats.data ?? []).filter((c) => c.kind === "primary");
  const tags = (cats.data ?? []).filter((c) => c.kind === "tag");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("admin.categories")}</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title={t("cat.primary")}
          kind="primary"
          items={primary}
          onChanged={() => qc.invalidateQueries({ queryKey: ["categories"] })}
        />
        <Section
          title={t("cat.tags")}
          kind="tag"
          items={tags}
          onChanged={() => qc.invalidateQueries({ queryKey: ["categories"] })}
        />
      </div>
    </div>
  );
}

function Section({
  title,
  kind,
  items,
  onChanged,
}: {
  title: string;
  kind: "primary" | "tag";
  items: Category[];
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [nameRu, setNameRu] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [slug, setSlug] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const s = slug || slugify(nameEn || nameRu);
      if (!s || !nameRu || !nameEn) throw new Error("Fill all fields");
      const { error } = await supabase.from("categories").insert({
        slug: s,
        name_ru: nameRu,
        name_en: nameEn,
        kind,
        sort_order: items.length * 10 + 100,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNameRu("");
      setNameEn("");
      setSlug("");
      onChanged();
      toast.success(t("admin.saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      onChanged();
      toast.success(t("admin.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-md border">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div>
                <div className="text-sm font-medium">
                  {c.name_ru} <span className="text-muted-foreground">/ {c.name_en}</span>
                </div>
                <div className="text-xs text-muted-foreground">{c.slug}</div>
              </div>
              <div className="flex items-center gap-2">
                {c.is_system && (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {t("cat.system")}
                  </span>
                )}
                {!c.is_system && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm("Delete?")) del.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <div className="text-sm font-medium">
            {kind === "primary" ? t("cat.new") : t("cat.newTag")}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <Label className="text-xs">{t("cat.name_ru")}</Label>
              <Input value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("cat.name_en")}</Label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("cat.slug")}</Label>
              <Input
                value={slug}
                placeholder={slugify(nameEn || nameRu)}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
          </div>
          <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>
            <Plus className="mr-1 h-4 w-4" />
            {t("cat.add")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
