import { createFileRoute } from "@tanstack/react-router";
import { ItemForm } from "@/components/item-form";

export const Route = createFileRoute("/admin/items/new")({
  component: () => <ItemForm />,
});
