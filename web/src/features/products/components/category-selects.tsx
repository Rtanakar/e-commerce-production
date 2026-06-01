// ============================================================================
// category-selects.tsx — Category + Subcategory dropdowns (+ inline create)
// ============================================================================
// useCategories tree se. Category change pe subcategory reset. "+ New" se
// inline category/subcategory create (dialog) → auto-select. Backend seller jar.
// ============================================================================

"use client";

import { useState } from "react";
import {
  Controller,
  useWatch,
  type Control,
  type UseFormSetValue,
} from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, useCreateCategory } from "../hooks/use-categories";
import type { CreateProductFormInput } from "../validators/product-validator";

const labelCls = "text-xs font-medium uppercase tracking-wider text-muted-foreground";

export function CategorySelects({
  control,
  setValue,
  disabled,
}: {
  control: Control<CreateProductFormInput>;
  setValue: UseFormSetValue<CreateProductFormInput>;
  disabled?: boolean;
}) {
  const { data: categories, isLoading } = useCategories();
  const categoryId = useWatch({ control, name: "categoryId" });

  const selected = categories?.find((c) => c.id === categoryId);
  const subcategories = selected?.children ?? [];

  // create dialog state — { parentId | null } when open
  const [dialog, setDialog] = useState<{ parentId: string | null } | null>(null);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Category */}
        <Controller
          name="categoryId"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-center justify-between">
                <FieldLabel className={labelCls}>Category *</FieldLabel>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setDialog({ parentId: null })}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
                >
                  <Plus className="size-3" /> New
                </button>
              </div>
              <Select
                value={field.value || undefined}
                onValueChange={(v) => {
                  field.onChange(v);
                  setValue("subcategoryId", "", { shouldDirty: true });
                }}
                disabled={disabled}
              >
                <SelectTrigger aria-invalid={fieldState.invalid} className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {(categories ?? []).length === 0 ? (
                    <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                      No categories — click “New”
                    </div>
                  ) : (
                    (categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Subcategory */}
        <Controller
          name="subcategoryId"
          control={control}
          render={({ field }) => (
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel className={labelCls}>Subcategory</FieldLabel>
                <button
                  type="button"
                  disabled={disabled || !categoryId}
                  onClick={() => setDialog({ parentId: categoryId })}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
                  title={!categoryId ? "Select a category first" : "Add subcategory"}
                >
                  <Plus className="size-3" /> New
                </button>
              </div>
              <Select
                value={field.value || undefined}
                onValueChange={field.onChange}
                disabled={disabled || subcategories.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={subcategories.length ? "Select subcategory" : "No subcategories"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
      </div>

      <CategoryCreateDialog
        open={dialog !== null}
        parentId={dialog?.parentId ?? null}
        onOpenChange={(o) => !o && setDialog(null)}
        onCreated={(cat) => {
          if (dialog?.parentId) {
            // subcategory created → ensure parent selected + pick sub
            setValue("categoryId", dialog.parentId, { shouldDirty: true });
            setValue("subcategoryId", cat.id, { shouldDirty: true });
          } else {
            // top-level category created → select it, reset sub
            setValue("categoryId", cat.id, { shouldDirty: true });
            setValue("subcategoryId", "", { shouldDirty: true });
          }
          setDialog(null);
        }}
      />
    </>
  );
}

// ============================================================================
// CategoryCreateDialog — inline create (category OR subcategory)
// ============================================================================
function CategoryCreateDialog({
  open,
  parentId,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  parentId: string | null;
  onOpenChange: (o: boolean) => void;
  onCreated: (cat: { id: string; name: string }) => void;
}) {
  const [name, setName] = useState("");
  const { mutateAsync, isPending } = useCreateCategory();
  const isSub = parentId !== null;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const cat = await mutateAsync({ name: trimmed, parentId });
      toast.success(`${isSub ? "Subcategory" : "Category"} “${cat.name}” created`);
      setName("");
      onCreated(cat);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setName("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isSub ? "New subcategory" : "New category"}</DialogTitle>
          <DialogDescription>
            {isSub
              ? "Add a subcategory under the selected category."
              : "Add a top-level category for your catalogue."}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <FieldLabel className={labelCls}>Name</FieldLabel>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={isSub ? "e.g. Mobiles" : "e.g. Electronics"}
            maxLength={60}
            className="mt-1.5"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={isPending || !name.trim()} className="gap-1.5">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
