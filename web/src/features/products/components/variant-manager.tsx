// ============================================================================
// variant-manager.tsx — "Edit your variant" dialog + variant list
// ============================================================================
// Screenshot wala modal: Variant Title, Variant Color (full-width bar), Tags,
// image gallery (Choose files / drag-drop), Delete Variant / Update Variant.
// shadcn Dialog + motion. Variants form array me store hote hain.
// ============================================================================

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Palette, Boxes } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { TagListInput } from "./product-form-bits";
import { ProductImagesUploader } from "./media-uploader";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { deleteMediaBulk } from "@/lib/upload-media";
import type { ProductVariant } from "../types";

const EMPTY: ProductVariant = {
  title: "",
  color: "#34d399",
  tags: [],
  stock: 0,
  images: [],
  position: 0,
};

// ============================================================================
// VariantsField — list of variants + add/edit/remove
// ============================================================================
export function VariantsField({
  value,
  onChange,
  disabled,
}: {
  value: ProductVariant[];
  onChange: (next: ProductVariant[]) => void;
  disabled?: boolean;
}) {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  // confirm-modal target (poora variant delete) — index ya null
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  const openNew = () => {
    setEditIndex(null);
    setOpen(true);
  };
  const openEdit = (i: number) => {
    setEditIndex(i);
    setOpen(true);
  };

  const save = (variant: ProductVariant) => {
    if (editIndex === null) {
      onChange([...value, { ...variant, position: value.length }]);
    } else {
      onChange(value.map((v, i) => (i === editIndex ? variant : v)));
    }
    setOpen(false);
  };

  // Confirm pe: pehle variant ki images R2 se delete (toast.promise), fir form
  // array se variant hatao. DB cleanup product save (replaceVariants) se hota.
  const confirmDelete = async () => {
    if (deleteIdx === null) return;
    const variant = value[deleteIdx];
    const keys = (variant?.images ?? [])
      .map((im) => im.key)
      .filter((k): k is string => !!k);

    await toast
      .promise(keys.length ? deleteMediaBulk(keys) : Promise.resolve(), {
        loading: "Deleting variant…",
        success: "Variant deleted",
        error: "Couldn't remove some images (variant removed)",
      })
      .unwrap();

    onChange(
      value
        .filter((_, idx) => idx !== deleteIdx)
        .map((v, idx) => ({ ...v, position: idx })),
    );
    setOpen(false); // agar edit dialog khula tha to band karo
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {value.map((v, i) => (
              <motion.div
                key={v.id ?? `${v.title}-${i}`}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3"
              >
                <span
                  className="size-8 shrink-0 rounded-full border border-border"
                  style={{ background: v.color ?? "var(--muted)" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {v.title || "Untitled variant"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {v.images.length} image(s) · {v.stock} in stock
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    onClick={() => openEdit(i)}
                    className="size-8"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    onClick={() => setDeleteIdx(i)}
                    className="size-8 text-muted-foreground hover:text-rose-500"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openNew}
        disabled={disabled}
        className="gap-1.5"
      >
        <Plus className="size-3.5" />
        Add variant
      </Button>

      <VariantDialog
        open={open}
        onOpenChange={setOpen}
        initial={editIndex === null ? null : value[editIndex]}
        onSave={save}
        onDelete={editIndex === null ? undefined : () => setDeleteIdx(editIndex)}
      />

      {/* Whole-variant delete confirm (R2 images cleanup + toast) */}
      <ConfirmDeleteDialog
        open={deleteIdx !== null}
        onOpenChange={(o) => !o && setDeleteIdx(null)}
        title="Delete this variant?"
        description="The variant and its uploaded images will be removed from storage. This can't be undone."
        confirmLabel="Delete variant"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// ============================================================================
// VariantDialog — the "Edit your variant" modal
// ============================================================================
function VariantDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: ProductVariant | null;
  onSave: (v: ProductVariant) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<ProductVariant>(initial ?? EMPTY);

  // dialog open hone par draft reset (add vs edit)
  // key prop trick se bhi ho sakta, par yahan effect-free sync via open change
  const patch = (p: Partial<ProductVariant>) =>
    setDraft((d) => ({ ...d, ...p }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(initial ?? EMPTY);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="size-4 text-primary" />
            {initial ? "Edit your variant" : "Add a variant"}
          </DialogTitle>
          <DialogDescription>
            Manage your product variants here. Add tags, images, and more.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field>
            <FieldLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Variant title
            </FieldLabel>
            <Input
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="e.g. Green Notebook"
            />
          </Field>

          <Field>
            <FieldLabel className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Palette className="size-3" /> Variant color
            </FieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draft.color ?? "#000000"}
                onChange={(e) => patch({ color: e.target.value })}
                className="h-9 w-16 cursor-pointer rounded border border-border bg-transparent"
              />
              {/* full-width color bar preview (screenshot jaisa) */}
              <div
                className="h-9 flex-1 rounded-md border border-border"
                style={{ background: draft.color ?? "transparent" }}
              />
            </div>
          </Field>

          <Field>
            <FieldLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tags
            </FieldLabel>
            <TagListInput
              value={draft.tags}
              onChange={(tags) => patch({ tags })}
              placeholder="Add tags"
              lowercase={false}
            />
          </Field>

          <Field>
            <FieldLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Variant images
            </FieldLabel>
            <ProductImagesUploader
              value={draft.images}
              onChange={(images) => patch({ images })}
              kind="product-variant"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Stock
              </FieldLabel>
              <Input
                type="number"
                min={0}
                value={draft.stock}
                onChange={(e) => patch({ stock: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field>
              <FieldLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                SKU (optional)
              </FieldLabel>
              <Input
                value={draft.sku ?? ""}
                onChange={(e) => patch({ sku: e.target.value })}
                placeholder="SKU-001"
              />
            </Field>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              className="gap-1.5"
            >
              <Trash2 className="size-4" /> Delete variant
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            disabled={!draft.title.trim()}
            onClick={() => onSave(draft)}
          >
            {initial ? "Update variant" : "Add variant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
