// ============================================================================
// edit-product-view.tsx — /seller/products/[id]/edit (4-export composition)
// ============================================================================
// CreateProductView mirror: fetch → map → reset → dirty-only PATCH. Sections
// INLINE (course EditCourseView pattern); inputs + SectionCard + resolver +
// defaults CreateProductView se import. form.handleSubmit(onSubmit).
// ============================================================================

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArchiveRestore,
  ArrowLeft,
  Boxes,
  CalendarClock,
  FileText,
  Globe2,
  IndianRupee,
  Image as ImageIcon,
  Info,
  Layers,
  Loader2,
  MoreVertical,
  Palette,
  Ruler,
  RotateCcw,
  Rocket,
  Save,
  Sparkles,
  TicketPercent,
  Trash2,
  Video as VideoIcon,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmTypeDeleteDialog } from "../components/confirm-type-delete-dialog";
import { SIZE_OPTIONS } from "@/config/constants";
import {
  createProductSchema,
  type CreateProductFormInput,
  type CreateProductInput,
} from "../validators/product-validator";
import type { ProductDetail, ProductImage, ProductVariant } from "../types";
import {
  useProduct,
  useUpdateProduct,
  useArchiveProduct,
  useRestoreProduct,
  useDeleteProduct,
} from "../hooks/use-product-mutations";
import {
  detailToFormValues,
  formToUpdatePayload,
} from "../lib/product-mappers";
import { PRODUCT_STATUS_META } from "../types";
import { ProductDescriptionEditor } from "../components/editor/product-description-editor";
import {
  ProductImagesUploader,
  SingleImageUploader,
  VideoUploader,
} from "../components/media-uploader";
import {
  TagListInput,
  SizeSelector,
  ColorPicker,
  SpecificationsInput,
} from "../components/product-form-bits";
import { VariantsField } from "../components/variant-manager";
import { CategorySelects } from "../components/category-selects";
import { DiscountSelector } from "../components/discount-selector";
import {
  SectionCard,
  TextInput,
  NumberInput,
  PriceInput,
  TextareaInput,
  SwitchInput,
  DateTimeInput,
} from "./create-product-view";

const LABEL =
  "mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground";

// ─── Container ───
export function EditProductContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full space-y-6 p-4 lg:p-6">
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="-ml-2 text-muted-foreground"
      >
        <Link href="/seller/products" className="gap-2">
          <ArrowLeft className="size-4" /> Back to products
        </Link>
      </Button>
      {children}
    </div>
  );
}

// ─── Loading ───
export function EditProductLoading() {
  return (
    <div className="w-full space-y-6 p-4 lg:p-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-7 w-64" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ─── Error ───
export function EditProductError({
  error,
  resetErrorBoundary,
}: {
  error?: Error;
  resetErrorBoundary?: () => void;
}) {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <Card className="max-w-md border-destructive/30">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-destructive/15">
            <AlertCircle className="size-7 text-destructive" />
          </span>
          <div>
            <h3 className="text-lg font-semibold">
              Couldn&apos;t load this product
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message ??
                "It may have been deleted or you don't have access."}
            </p>
          </div>
          <div className="flex gap-2">
            {resetErrorBoundary && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetErrorBoundary}
                className="gap-2"
              >
                <RotateCcw className="size-3.5" /> Retry
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/seller/products" className="gap-2">
                <ArrowLeft className="size-3.5" /> Back
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Content ───
export function EditProductContent({ id }: { id: string }) {
  const { data: product, isLoading, error } = useProduct(id);

  if (isLoading && !product) return <EditProductLoading />;
  if (error || !product) {
    return (
      <EditProductError error={error instanceof Error ? error : undefined} />
    );
  }

  // key={product.id} — product change pe form clean remount (correct defaults).
  // Form ko alag component me isliye nikala taaki wah product load hone ke BAAD
  // hi mount ho.
  return <EditProductForm key={product.id} product={product} />;
}

// ============================================================================
// EditProductForm — sirf product LOAD hone ke baad mount hota hai
// ============================================================================
// defaultValues seedha product se → form pehli hi render me sahi values rakhta
// hai. Isse category/subcategory ke Radix <Select> turant apni value dikhate
// hain. (Pehle form khaali defaults se mount hota tha aur baad me useEffect ke
// reset() se value aati thi — Radix Select async-loaded options ke saath us
// "mount-ke-baad value change" ko reliably reflect nahi karta tha, isiliye
// category by-default blank dikhti thi. Ab woh bug fix hai.)
// ============================================================================
function EditProductForm({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const { mutate: update, isPending } = useUpdateProduct(product.id);
  const archive = useArchiveProduct();
  const restore = useRestoreProduct();
  const del = useDeleteProduct();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const form = useForm<CreateProductFormInput, unknown, CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: detailToFormValues(product),
  });
  const { control, setValue, reset } = form;

  // product prop badle (save / publish / unpublish ke baad) → form re-sync
  useEffect(() => {
    reset(detailToFormValues(product));
  }, [product, reset]);

  // watched array/media values
  const images = (useWatch({ control, name: "images" }) ??
    []) as ProductImage[];
  const variants = (useWatch({ control, name: "variants" }) ??
    []) as ProductVariant[];
  const tags = useWatch({ control, name: "tags" }) ?? [];
  const colors = useWatch({ control, name: "colors" }) ?? [];
  const sizes = useWatch({ control, name: "sizes" }) ?? [];
  const specifications = useWatch({ control, name: "specifications" }) ?? [];
  const discountCodeIds = useWatch({ control, name: "discountCodeIds" }) ?? [];
  const bannerUrl = useWatch({ control, name: "bannerUrl" }) ?? "";
  const videoUrl = useWatch({ control, name: "videoUrl" }) ?? "";

  const set = <K extends keyof CreateProductFormInput>(
    name: K,
    value: CreateProductFormInput[K],
  ) => setValue(name, value as never, { shouldDirty: true });

  // Submit — dirty fields ka PATCH. Hook khud toast karta hai.
  const onSubmit = (data: CreateProductInput) => {
    const dirty = form.formState.dirtyFields as Partial<
      Record<keyof CreateProductFormInput, unknown>
    >;
    const payload = formToUpdatePayload(data, dirty);
    if (Object.keys(payload).length === 0) {
      toast.info("No changes to save");
      return;
    }
    update(payload, {
      onSuccess: (updated) => reset(detailToFormValues(updated)),
    });
  };

  // Publish (DRAFT → ACTIVE) / Unpublish (ACTIVE → DRAFT) — direct status PATCH
  const setStatus = (status: "ACTIVE" | "DRAFT") => {
    if (status === "ACTIVE" && (product.images?.length ?? 0) === 0) {
      toast.error("Add at least one image before publishing");
      return;
    }
    update({ status });
  };

  const statusMeta = PRODUCT_STATUS_META[product.status];
  const isArchived = product.status === "ARCHIVED";
  const isDeleted = product.status === "DELETED";
  // Restore ARCHIVED ya DELETED dono se → DRAFT
  const canRestore = isArchived || isDeleted;
  const busy =
    isPending || archive.isPending || restore.isPending || del.isPending;

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-6 w-1 rounded-full bg-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Edit product</h1>
            <Badge variant="outline" className={statusMeta.tone}>
              {statusMeta.label}
            </Badge>
          </div>
          <p className="mt-1 ml-3 truncate text-sm text-muted-foreground">
            {product.title}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Publish — DRAFT/PENDING/OUT_OF_STOCK pe public karo (deleted/archived nahi) */}
          {!canRestore && product.status !== "ACTIVE" && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => setStatus("ACTIVE")}
              className="gap-1.5"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Rocket className="size-4" />
              )}
              Publish
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" disabled={busy}>
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {/* Unpublish — ACTIVE → DRAFT */}
              {!canRestore && product.status === "ACTIVE" && (
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() => setStatus("DRAFT")}
                >
                  <RotateCcw className="size-3.5" /> Unpublish (to draft)
                </DropdownMenuItem>
              )}
              {canRestore ? (
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() =>
                    toast.promise(restore.mutateAsync(product.id), {
                      loading: "Restoring…",
                      success: "Restored to draft",
                      error: "Failed",
                    })
                  }
                >
                  <ArchiveRestore className="size-3.5" /> Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() =>
                    toast.promise(archive.mutateAsync(product.id), {
                      loading: "Archiving…",
                      success: "Product archived",
                      error: "Failed",
                    })
                  }
                >
                  <ArchiveRestore className="size-3.5" /> Archive
                </DropdownMenuItem>
              )}
              {/* Delete sirf jab DELETED na ho */}
              {!isDeleted && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    className="gap-2"
                    onSelect={(e) => {
                      e.preventDefault();
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
          <FieldGroup className="gap-6">
            {/* Media */}
            <SectionCard
              icon={ImageIcon}
              title="Product images"
              description="First image is the primary (765 × 850 recommended)."
            >
              <Controller
                name="images"
                control={control}
                render={({ fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <ProductImagesUploader
                      value={images}
                      onChange={(n) => set("images", n)}
                      disabled={busy}
                    />
                    {fieldState.invalid && (
                      <p className="text-xs text-destructive">
                        {fieldState.error?.message}
                      </p>
                    )}
                  </Field>
                )}
              />
              <div>
                <FieldLabel className={LABEL}>Banner (optional)</FieldLabel>
                <SingleImageUploader
                  value={bannerUrl}
                  onChange={(url) => set("bannerUrl", url)}
                  disabled={busy}
                />
              </div>
            </SectionCard>

            {/* Basic */}
            <SectionCard icon={Sparkles} title="Basic information">
              <TextInput
                name="title"
                label="Product title *"
                placeholder="e.g. Apple iPhone 15 Pro"
                control={control}
                disabled={busy}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  name="slug"
                  label="Slug"
                  placeholder="auto-generated-from-title"
                  control={control}
                  disabled={busy}
                />
                <TextInput
                  name="brand"
                  label="Brand"
                  placeholder="e.g. Apple"
                  control={control}
                  disabled={busy}
                />
              </div>
              <TextareaInput
                name="shortDescription"
                label="Short description (quick view)"
                rows={3}
                maxLength={2000}
                placeholder="Enter product description for quick view"
                control={control}
                disabled={busy}
              />
              <CategorySelects
                control={control}
                setValue={setValue}
                disabled={busy}
              />
              <TextInput
                name="warranty"
                label="Warranty"
                placeholder="1 Year / No Warranty"
                control={control}
                disabled={busy}
              />
            </SectionCard>

            {/* Detailed description (TipTap) */}
            <SectionCard
              icon={FileText}
              title="Detailed description"
              description="Min 100 words recommended. Type / for commands."
            >
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <ProductDescriptionEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={busy}
                  />
                )}
              />
            </SectionCard>

            {/* Pricing */}
            <SectionCard icon={IndianRupee} title="Pricing">
              <div className="grid gap-4 sm:grid-cols-3">
                <PriceInput
                  name="regularPrice"
                  label="Regular price (MRP)"
                  control={control}
                  disabled={busy}
                />
                <PriceInput
                  name="salePrice"
                  label="Sale price *"
                  control={control}
                  disabled={busy}
                  hint="Must be ≤ MRP"
                />
                <TextInput
                  name="currency"
                  label="Currency"
                  placeholder="INR"
                  control={control}
                  disabled={busy}
                />
              </div>
            </SectionCard>

            {/* Inventory */}
            <SectionCard icon={Warehouse} title="Inventory & delivery">
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberInput
                  name="stock"
                  label="Stock *"
                  placeholder="100"
                  control={control}
                  disabled={busy}
                />
              </div>
              <div>
                <FieldLabel className={LABEL}>
                  <span className="inline-flex items-center gap-1.5">
                    <Ruler className="size-3" /> Sizes
                  </span>
                </FieldLabel>
                <SizeSelector
                  options={SIZE_OPTIONS}
                  value={sizes}
                  onChange={(n) => set("sizes", n)}
                  disabled={busy}
                />
              </div>
              <SwitchInput
                name="cashOnDelivery"
                label="Cash on Delivery"
                description="Allow buyers to pay on delivery"
                control={control}
                disabled={busy}
              />
            </SectionCard>

            {/* Tags + colors */}
            <SectionCard icon={Layers} title="Tags & colors">
              <div>
                <FieldLabel className={LABEL}>Tags</FieldLabel>
                <TagListInput
                  value={tags}
                  onChange={(n) => set("tags", n)}
                  placeholder="apple, flagship"
                  disabled={busy}
                />
              </div>
              <div>
                <FieldLabel className={LABEL}>
                  <span className="inline-flex items-center gap-1.5">
                    <Palette className="size-3" /> Colors
                  </span>
                </FieldLabel>
                <ColorPicker
                  value={colors}
                  onChange={(n) => set("colors", n)}
                  disabled={busy}
                />
              </div>
            </SectionCard>

            {/* Variants */}
            <SectionCard
              icon={Boxes}
              title="Variants"
              description="Different colors/styles, each with its own images."
            >
              <VariantsField
                value={variants}
                onChange={(n) => set("variants", n)}
                disabled={busy}
              />
            </SectionCard>

            {/* Specs */}
            <SectionCard
              icon={Info}
              title="Custom specifications"
              description="Material, dimensions, etc."
            >
              <SpecificationsInput
                value={specifications}
                onChange={(n) => set("specifications", n)}
                disabled={busy}
              />
            </SectionCard>

            {/* Video */}
            <SectionCard icon={VideoIcon} title="Product video (optional)">
              <VideoUploader
                value={videoUrl}
                onChange={(url) => set("videoUrl", url)}
                disabled={busy}
              />
            </SectionCard>

            {/* Discounts */}
            <SectionCard icon={TicketPercent} title="Discount codes (optional)">
              <DiscountSelector
                value={discountCodeIds}
                onChange={(n) => set("discountCodeIds", n)}
                disabled={busy}
              />
            </SectionCard>

            {/* Event sale (limited-time deal window) */}
            <SectionCard
              icon={CalendarClock}
              title="Event sale (optional)"
              description="Limited-time deal window (Flipkart/Amazon style). Leave empty for a normal product."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <DateTimeInput
                  name="eventStartsAt"
                  label="Event starts"
                  control={control}
                  disabled={busy}
                />
                <DateTimeInput
                  name="eventEndsAt"
                  label="Event ends"
                  control={control}
                  disabled={busy}
                  hint="Must be after start"
                />
              </div>
            </SectionCard>

            {/* SEO */}
            <SectionCard icon={Globe2} title="SEO (optional)">
              <TextInput
                name="metaTitle"
                label="Meta title"
                placeholder="Shown in search results"
                control={control}
                disabled={busy}
              />
              <TextareaInput
                name="metaDescription"
                label="Meta description"
                rows={2}
                maxLength={320}
                placeholder="Shown below the title in search results"
                control={control}
                disabled={busy}
              />
            </SectionCard>

            {/* Sticky action bar */}
            <motion.div
              initial={false}
              className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/90 px-4 py-3 backdrop-blur"
            >
              <p className="text-xs text-muted-foreground">
                {form.formState.isDirty
                  ? `Unsaved changes (${Object.keys(form.formState.dirtyFields).length})`
                  : "All changes saved"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || !form.formState.isDirty}
                  onClick={() => reset(detailToFormValues(product))}
                >
                  Discard
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy || !form.formState.isDirty}
                  className="gap-1.5"
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}{" "}
                  Save changes
                </Button>
              </div>
            </motion.div>
          </FieldGroup>
        </form>
      </Form>

      {/* Delete confirm — "type delete to confirm". Soft-delete: 24h recovery */}
      <ConfirmTypeDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this product?"
        description={
          <>
            <span className="font-medium text-foreground">{product.title}</span>{" "}
            will be moved to a <span className="font-medium">delete state</span> and
            permanently removed from storage &amp; the database{" "}
            <span className="font-medium">after 24 hours</span>. You can restore it
            within this time.
          </>
        }
        onConfirm={async () => {
          const p = del.mutateAsync(product.id);
          toast.promise(p, {
            loading: "Deleting…",
            success: "Moved to delete state — recover within 24h",
            error: (err) => (err instanceof Error ? err.message : "Failed"),
          });
          await p;
          router.push("/seller/products");
        }}
      />
    </>
  );
}
