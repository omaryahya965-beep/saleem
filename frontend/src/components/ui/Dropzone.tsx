import { FileImage, FileVideo, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { formatClock, useI18n } from "@/i18n";
import {
  ACCEPT,
  inspectMedia,
  type InspectedMedia,
  type MediaError,
  type MediaKind,
} from "@/lib/media";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Spinner } from "./Spinner";

interface DropzoneProps {
  kind: MediaKind;
  value: InspectedMedia | null;
  onChange: (media: InspectedMedia | null) => void;
  className?: string;
}

/**
 * Dropzone — drag-and-drop or click/keyboard file picker with inline validation
 * (format, ≤ 25 MB, video ≤ 90 s) and a preview card (thumbnail, duration, size).
 */
export function Dropzone({ kind, value, onChange, className }: DropzoneProps) {
  const { t, formatBytes } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MediaError | null>(null);
  const id = useId();

  useEffect(
    () => () => {
      if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    },
    [value],
  );

  useEffect(() => setError(null), [kind]);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const res = await inspectMedia(file, kind);
    setBusy(false);
    if (res.ok) onChange(res.media);
    else {
      setError(res.error);
      onChange(null);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handle(e.dataTransfer.files[0]);
  };

  const errorText = error
    ? error.code === "type"
      ? t("dropzone.errorType")
      : error.code === "size"
        ? t("dropzone.errorSize", { size: formatBytes(error.bytes) })
        : error.code === "duration"
          ? t("dropzone.errorDuration", { duration: formatClock(error.seconds) })
          : t("dropzone.errorRead")
    : null;

  const Icon = kind === "video" ? FileVideo : FileImage;
  const input = (
    <input
      ref={inputRef}
      id={id}
      type="file"
      className="sr-only"
      accept={ACCEPT[kind].join(",")}
      aria-describedby={`${id}-hint${errorText ? ` ${id}-err` : ""}`}
      onChange={(e) => {
        void handle(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  if (value) {
    return (
      <div
        className={cn(
          "flex items-center gap-4 rounded-md border border-border bg-surface p-3",
          className,
        )}
      >
        {input}
        <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-sm bg-ink text-mint">
          {value.previewUrl ? (
            <img src={value.previewUrl} alt="" className="size-full object-cover" />
          ) : (
            <Icon aria-hidden="true" />
          )}
          {value.duration != null && (
            <span className="tabular absolute bottom-1 end-1 rounded-[4px] bg-ink/80 px-1 text-[11px] text-white">
              {formatClock(value.duration)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p dir="auto" className="truncate font-medium text-fg">
            {value.file.name}
          </p>
          <p className="tabular text-sm text-fg-muted">
            {value.duration != null && (
              <>
                {t("dropzone.duration")}: {formatClock(value.duration)} ·{" "}
              </>
            )}
            {t("dropzone.size")}: {formatBytes(value.bytes)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
              {t("dropzone.replace")}
            </Button>
            <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => onChange(null)}>
              {t("dropzone.remove")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-md border-2 border-dashed px-6 py-8 text-center transition-colors duration-150",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
          dragging
            ? "border-green bg-green-bg"
            : "border-border-strong/70 bg-sunken hover:border-green",
          errorText && "border-red/60",
        )}
      >
        {input}
        <span className="grid size-12 place-items-center rounded-full bg-green-bg text-green">
          {busy ? <Spinner /> : <UploadCloud aria-hidden="true" className="size-6" />}
        </span>
        <span className="font-medium text-fg">{t("dropzone.title")}</span>
        <span id={`${id}-hint`} className="text-sm text-fg-muted">
          {kind === "video" ? t("dropzone.hintVideo") : t("dropzone.hintImage")}
        </span>
        <span className="mt-1 inline-flex h-9 items-center rounded-full border border-border-strong bg-surface px-4 text-sm font-medium text-fg">
          {t("dropzone.choose")}
        </span>
      </label>
      {errorText && (
        <p id={`${id}-err`} role="alert" className="mt-2 text-sm font-medium text-red">
          {errorText}
        </p>
      )}
    </div>
  );
}
