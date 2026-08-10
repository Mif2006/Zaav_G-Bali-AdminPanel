import { createFileRoute } from "@tanstack/react-router";
import { ItemForm } from "@/components/item-form";

export const Route = createFileRoute("/admin/items/$id")({
  component: Editor,
});

function Editor() {
  const { id } = Route.useParams();
  return <ItemForm itemId={id} />;
}
