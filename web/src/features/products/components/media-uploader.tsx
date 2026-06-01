// ============================================================================
// media-uploader.tsx — Image gallery / banner / video uploaders
// ============================================================================
// Backend /uploads/image (sharp optimize → webp/avif) + /uploads/presign
// (video). Screenshot wala pattern: drag-drop zone + uploaded files table
// (order / name / size / thumbnail / delete) + set-primary star.
//
// Sab theme-aware (shadcn tokens) + motion. Upload pe sonner promise toast.
// ============================================================================

"use client";

import { useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  UploadCloud,
  Loader2,
  Trash2,
  Star,
  ImageIcon,
  Film,
  GripVertical,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  uploadImage,
  uploadVideo,
  deleteMedia,
  type UploadKind,
} from "@/lib/upload-media";
import { CATALOG } from "@/config/constants";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { MediaPreviewDialog, type PreviewItem } from "./media-preview-dialog";
import type { ProductImage } from "../types";

// ─── pretty file size ───
function fmtSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ============================================================================
// ProductImagesUploader — multi-image gallery (max N)
// ============================================================================
export function ProductImagesUploader({
  value,
  onChange,
  disabled,
  max = CATALOG.MAX_IMAGES_PER_PRODUCT,
  kind = "product-images",
}: {
  value: ProductImage[];
  onChange: (next: ProductImage[]) => void;
  disabled?: boolean;
  max?: number;
  /** R2 folder — gallery=product-images, variant dialog=product-variant */
  kind?: UploadKind;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  // row drag-reorder
  const [rowDragIndex, setRowDragIndex] = useState<number | null>(null);
  // per-image delete confirm target
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  // preview lightbox index (-1 = closed)
  const [previewIdx, setPreviewIdx] = useState(-1);

  // ── Resilient multi-upload (Amazon/Flipkart pattern) ──────────────────────
  // Har image SWATANTRA upload hoti hai (parallel, allSettled). Kuch fail bhi
  // ho jaayein to jo SUCCESS hui woh gallery me add ho jaati hain (kabhi lost
  // nahi hoti) + failures ka count toast me. Pehle sequential loop tha → ek
  // fail pe poora reject → R2 pe chadi images UI me dikhti hi nahi thi.
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = max - value.length;
    if (remaining <= 0) {
      toast.error(`Max ${max} images allowed`);
      return;
    }
    const picked = Array.from(files).slice(0, remaining);
    if (picked.length < files.length) {
      toast.warning(`Only ${remaining} more allowed — extra files skipped`);
    }
    setUploading(true);

    const toastId = toast.loading(
      `Optimizing & uploading ${picked.length} image(s)…`,
    );

    // Parallel + independent: ek ka fail doosron ko nahi rokta
    const settled = await Promise.allSettled(
      picked.map((f) => uploadImage(f, { kind })),
    );

    const uploaded: ProductImage[] = [];
    const failures: string[] = [];
    settled.forEach((res, i) => {
      if (res.status === "fulfilled") {
        const r = res.value;
        uploaded.push({
          url: r.url,
          key: r.key,
          alt: picked[i].name,
          width: r.width,
          height: r.height,
          sizeBytes: r.sizeBytes,
          isPrimary: false,
          position: 0,
        });
      } else {
        failures.push(picked[i].name);
      }
    });

    // SUCCESS hui images ko hamesha merge karo (partial failure pe bhi)
    if (uploaded.length > 0) {
      const merged = [...value, ...uploaded].map((img, i) => ({
        ...img,
        position: i,
        isPrimary: i === 0 ? true : !!img.isPrimary, // pehli = primary
      }));
      onChange(merged);
    }

    // Result toast — success / partial / all-failed
    if (failures.length === 0) {
      toast.success(`${uploaded.length} image(s) uploaded`, { id: toastId });
    } else if (uploaded.length > 0) {
      toast.warning(
        `${uploaded.length} uploaded · ${failures.length} failed (${failures.join(", ")}). Retry the failed ones.`,
        { id: toastId, duration: 6000 },
      );
    } else {
      toast.error(
        `Upload failed for all ${failures.length} image(s). Check connection and retry.`,
        { id: toastId },
      );
    }

    setUploading(false);
  };

  // ── Delete (confirm modal ke baad) — R2 cleanup + toast ──
  // Pehle storage se delete (modal me pending spinner), success pe form array
  // se hatao. Modal ConfirmDeleteDialog se aata hai (setConfirmIdx).
  const confirmRemove = async () => {
    if (confirmIdx === null) return;
    const img = value[confirmIdx];

    await toast
      .promise(img.key ? deleteMedia(img.key) : Promise.resolve(), {
        loading: "Removing image…",
        success: "Image removed",
        error: "Couldn't remove from storage",
      })
      .unwrap();

    // success → UI se hatao + position/primary recompute
    const next = value
      .filter((_, idx) => idx !== confirmIdx)
      .map((im, idx) => ({ ...im, position: idx }));
    if (img.isPrimary && next.length && !next.some((n) => n.isPrimary)) {
      next[0].isPrimary = true;
    }
    onChange(next);
  };

  const setPrimary = (i: number) =>
    onChange(value.map((im, idx) => ({ ...im, isPrimary: idx === i })));

  // ── Drag-reorder — toast.promise (loading → success) ──
  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const arr = [...value];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onChange(arr.map((im, idx) => ({ ...im, position: idx })));

    // reorder local hai → chhota delay-promise taaki loading→success dikhe
    toast.promise(new Promise<void>((res) => setTimeout(res, 350)), {
      loading: "Reordering…",
      success: "Image order updated",
      error: "Failed to reorder",
    });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!disabled) void handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-card/40 hover:border-primary/40",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <UploadCloud className="size-5" />
          )}
        </span>
        <p className="text-sm font-medium text-primary">
          Choose files or drag and drop
        </p>
        <p className="text-[11px] text-muted-foreground">
          Auto-optimized to WebP · up to 4MB each · max {max}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || uploading || value.length >= max}
          onClick={() => inputRef.current?.click()}
          className="mt-1"
        >
          Choose File(s)
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Uploaded files table */}
      {value.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[3.5rem_1fr_5rem_3.5rem_4rem] items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>Order</span>
            <span>Name</span>
            <span>Size</span>
            <span>Image</span>
            <span className="text-right">Actions</span>
          </div>
          <AnimatePresence initial={false}>
            {value.map((img, i) => (
              <motion.div
                key={img.key ?? img.url}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                // ── HTML5 drag-reorder ──
                draggable={!disabled}
                onDragStart={(e) => {
                  // motion types onDragStart as a gesture event → cast to DOM DnD
                  setRowDragIndex(i);
                  (e as unknown as React.DragEvent).dataTransfer.effectAllowed =
                    "move";
                }}
                onDragOver={(e) => {
                  if (rowDragIndex !== null) e.preventDefault(); // allow drop
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (rowDragIndex !== null) reorder(rowDragIndex, i);
                  setRowDragIndex(null);
                }}
                onDragEnd={() => setRowDragIndex(null)}
                className={cn(
                  "grid grid-cols-[3.5rem_1fr_5rem_3.5rem_4rem] items-center gap-2 border-b border-border px-3 py-2 last:border-0",
                  rowDragIndex === i && "opacity-50",
                  rowDragIndex !== null &&
                    rowDragIndex !== i &&
                    "hover:border-t-2 hover:border-t-primary",
                )}
              >
                <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                  <GripVertical
                    className={cn(
                      "size-3.5 shrink-0 text-muted-foreground/50",
                      !disabled && "cursor-grab active:cursor-grabbing",
                    )}
                  />
                  {i}
                </span>
                <span className="flex items-center gap-1.5 truncate text-xs text-foreground">
                  {img.isPrimary && (
                    <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
                  )}
                  <span className="truncate">{img.alt || "image"}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {fmtSize(img.sizeBytes)}
                </span>
                <button
                  type="button"
                  title="Preview"
                  onClick={() => setPreviewIdx(i)}
                  className="relative size-9 overflow-hidden rounded-md border border-border bg-muted transition hover:ring-2 hover:ring-primary/40"
                >
                  <Image
                    src={img.url}
                    alt={img.alt ?? ""}
                    fill
                    sizes="36px"
                    draggable={false}
                    className="pointer-events-none object-cover"
                  />
                </button>
                <span className="flex items-center justify-end gap-0.5">
                  <button
                    type="button"
                    title="Set as primary"
                    disabled={disabled || img.isPrimary}
                    onClick={() => setPrimary(i)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-amber-500 disabled:opacity-40"
                  >
                    <Star
                      className={cn(
                        "size-3.5",
                        img.isPrimary && "fill-amber-400 text-amber-400",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    title="Remove"
                    disabled={disabled}
                    onClick={() => setConfirmIdx(i)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-rose-500"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Per-image delete confirm (R2 cleanup + toast) */}
      <ConfirmDeleteDialog
        open={confirmIdx !== null}
        onOpenChange={(o) => !o && setConfirmIdx(null)}
        title="Remove this image?"
        description="The image will be permanently deleted from storage."
        confirmLabel="Remove"
        onConfirm={confirmRemove}
      />

      {/* Preview lightbox (multi-image nav + filters) */}
      <MediaPreviewDialog
        open={previewIdx >= 0}
        onOpenChange={(o) => !o && setPreviewIdx(-1)}
        index={previewIdx < 0 ? 0 : previewIdx}
        onIndexChange={setPreviewIdx}
        items={value.map<PreviewItem>((img) => ({
          url: img.url,
          type: "image",
          alt: img.alt ?? undefined,
        }))}
      />
    </div>
  );
}

// ============================================================================
// SingleImageUploader — banner / single image (preview + replace + remove)
// ============================================================================
export function SingleImageUploader({
  value,
  onChange,
  disabled,
  aspect = "aspect-[16/4]",
  hint = "Banner image · auto-optimized to WebP",
  kind = "product-banner",
}: {
  value: string;
  onChange: (url: string, key?: string) => void;
  disabled?: boolean;
  aspect?: string;
  hint?: string;
  kind?: UploadKind;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handle = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await toast
        .promise(uploadImage(file, { kind }), {
          loading: "Optimizing & uploading…",
          success: "Image uploaded",
          error: (e) => (e instanceof Error ? e.message : "Upload failed"),
        })
        .unwrap();
      onChange(r.url, r.key);
    } catch {
      /* toast shown */
    } finally {
      setUploading(false);
    }
  };

  // Remove → R2 se delete (URL se key resolve) + toast, fir form clear
  const confirmRemove = async () => {
    if (!value) return;
    await toast
      .promise(deleteMedia(value), {
        loading: "Removing image…",
        success: "Image removed",
        error: "Couldn't remove from storage",
      })
      .unwrap();
    onChange("");
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div
          className={cn(
            "group relative overflow-hidden rounded-xl border border-border",
            aspect,
          )}
        >
          <Image
            src={value}
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/60 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPreviewOpen(true)}
            >
              Preview
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={disabled}
              onClick={() => setConfirmOpen(true)}
            >
              <X className="size-4" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card/40 text-center transition-colors hover:border-primary/40",
            aspect,
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImageIcon className="size-5" />
            )}
          </span>
          <p className="text-sm font-medium text-primary">Upload image</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove this image?"
        description="The image will be permanently deleted from storage."
        confirmLabel="Remove"
        onConfirm={confirmRemove}
      />

      {value && (
        <MediaPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          index={0}
          onIndexChange={() => {}}
          items={[{ url: value, type: "image" }]}
        />
      )}
    </div>
  );
}

// ============================================================================
// VideoUploader — single video (presign → R2). Or paste YouTube URL.
// ============================================================================
export function VideoUploader({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handle = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await toast
        .promise(uploadVideo(file), {
          loading: "Uploading video…",
          success: "Video uploaded",
          error: (e) => (e instanceof Error ? e.message : "Upload failed"),
        })
        .unwrap();
      onChange(r.url);
    } catch {
      /* toast shown */
    } finally {
      setUploading(false);
    }
  };

  const confirmRemove = async () => {
    if (!value) return;
    await toast
      .promise(deleteMedia(value), {
        loading: "Removing video…",
        success: "Video removed",
        error: "Couldn't remove from storage",
      })
      .unwrap();
    onChange("");
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-xs text-foreground">
            <Film className="size-4 shrink-0 text-primary" />
            <span className="truncate">{value}</span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPreviewOpen(true)}
              className="h-8 text-xs"
            >
              Preview
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={() => setConfirmOpen(true)}
              className="text-muted-foreground hover:text-rose-500"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Film className="size-4" />
          )}
          Upload video (MP4/WebM · up to 200MB)
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          void handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove this video?"
        description="The video will be permanently deleted from storage."
        confirmLabel="Remove"
        onConfirm={confirmRemove}
      />

      {value && (
        <MediaPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          index={0}
          onIndexChange={() => {}}
          items={[{ url: value, type: "video" }]}
        />
      )}
    </div>
  );
}
