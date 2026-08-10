import { useRef, useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, GripVertical } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export function SingleImageUploader({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const { startUpload, isUploading } = useUploadThing("itemImage", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.serverData?.url ?? res?.[0]?.ufsUrl ?? res?.[0]?.url;
      if (url) onChange(url);
    },
    onUploadError: (e) => { toast.error(e.message); },
  });

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative w-40">
          <img src={value} alt="" className="h-40 w-40 rounded-md border object-cover" />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute -right-2 -top-2 h-6 w-6"
            onClick={() => onChange(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-input text-sm text-muted-foreground hover:bg-muted/50"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("upload.uploading")}
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              {t("upload.dropOrClick")}
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) startUpload(Array.from(files));
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function MultiImageUploader({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const { startUpload, isUploading } = useUploadThing("itemImage", {
    onClientUploadComplete: (res) => {
      const urls = (res ?? [])
        .map((r) => r?.serverData?.url ?? r?.ufsUrl ?? r?.url)
        .filter((u): u is string => !!u);
      if (urls.length) onChange([...value, ...urls]);
    },
    onUploadError: (e) => { toast.error(e.message); },
  });

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {value.map((url, i) => (
          <div
            key={url + i}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null) move(dragIdx, i);
              setDragIdx(null);
            }}
            className="group relative"
          >
            <img src={url} alt="" className="h-28 w-28 rounded-md border object-cover" />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1 opacity-0 group-hover:opacity-100">
              <GripVertical className="h-4 w-4 text-white drop-shadow" />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="h-5 w-5"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-input text-xs text-muted-foreground hover:bg-muted/50"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("upload.uploading")}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {t("upload.dropOrClick")}
            </>
          )}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) startUpload(Array.from(files));
          e.target.value = "";
        }}
      />
    </div>
  );
}
