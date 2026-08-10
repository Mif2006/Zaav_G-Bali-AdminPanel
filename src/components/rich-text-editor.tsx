import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import { Bold, Italic, Heading2, List, Link as LinkIcon, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

const COLORS = ["#000000", "#6b7280", "#b45309", "#b91c1c", "#15803d", "#1d4ed8", "#7c3aed"];

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const { t } = useI18n();
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[180px] rounded-md border border-input bg-background px-3 py-2 focus:outline-none",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-muted/40 p-1">
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("bold") ? "default" : "ghost"}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title={t("editor.bold")}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("italic") ? "default" : "ghost"}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title={t("editor.italic")}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("heading", { level: 2 }) ? "default" : "ghost"}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title={t("editor.h2")}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("bulletList") ? "default" : "ghost"}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title={t("editor.bullet")}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const prev = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("URL", prev ?? "https://");
            if (url === null) return;
            if (url === "") editor.chain().focus().unsetLink().run();
            else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
          title={t("editor.link")}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <div className="mx-1 flex items-center gap-1 border-l pl-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="h-5 w-5 rounded-full border border-border"
              style={{ backgroundColor: c }}
              onClick={() => editor.chain().focus().setColor(c).run()}
              aria-label={`color ${c}`}
            />
          ))}
          <button
            type="button"
            className="text-xs text-muted-foreground underline ml-1"
            onClick={() => editor.chain().focus().unsetColor().run()}
          >
            reset
          </button>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
