// ============================================================================
// create-product-view.tsx — /seller/products/new (4-export composition)
// ============================================================================
//   <CreateProductContainer>           ← chrome (back link + title)
//     <ErrorBoundary FallbackComponent={CreateProductError}>
//       <CreateProductContent />        ← form (RHF + Zod + TipTap + uploads)
//
// Course CreateCourseView pattern: sections form me INLINE, reusable inputs
// (SectionCard/TextInput/NumberInput/PriceInput/TextareaInput/SwitchInput) isi
// file me defined + exported — edit view inhe import karta. Form submit =
// form.handleSubmit(onSubmit). Heavy widgets (editor, uploaders, variant dialog,
// tag/size/color/spec, category/discount) feature components hain (imported).
// ============================================================================

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  CalendarClock,
  CalendarIcon,
  Clock,
  FileText,
  Globe2,
  IndianRupee,
  Image as ImageIcon,
  Info,
  Layers,
  Loader2,
  Palette,
  Ruler,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  TicketPercent,
  Video as VideoIcon,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form } from "@/components/ui/form";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { SIZE_OPTIONS } from "@/config/constants";
import {
  createProductSchema,
  slugify,
  productStatuses,
  productStatusLabels,
  type CreateProductFormInput,
  type CreateProductInput,
} from "../validators/product-validator";
import type { ProductImage, ProductVariant } from "../types";
import { useCreateProduct } from "../hooks/use-product-mutations";
import { formToCreatePayload } from "../lib/product-mappers";
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
import { productDefaultValues } from "../constants/product-defaults";

// ============================================================================
// Container
// ============================================================================
export function CreateProductContainer({
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
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-6 w-1 rounded-full bg-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Create product</h1>
        </div>
        <p className="mt-1 ml-3 text-sm text-muted-foreground">
          Fill the details. Save as draft anytime — only title, category, and
          price are required to publish.
        </p>
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Error
// ============================================================================
export function CreateProductError({
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
            <h3 className="text-lg font-semibold">Something went wrong</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message ?? "Failed to load the create-product form."}
            </p>
          </div>
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
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Content — form (RHF + Zod). Sections INLINE (course pattern).
// ============================================================================
const LABEL =
  "mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground";

export function CreateProductContent() {
  const router = useRouter();
  const { mutate: createProduct, isPending } = useCreateProduct();

  const form = useForm<CreateProductFormInput, unknown, CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: productDefaultValues,
  });
  const { control, setValue } = form;

  // auto-slug from title (until user edits slug)
  const title = useWatch({ control, name: "title" }) ?? "";
  const slugDirty = form.formState.dirtyFields.slug;
  useEffect(() => {
    if (!slugDirty) setValue("slug", slugify(title));
  }, [title, slugDirty, setValue]);

  // watched array/media values (scoped re-renders)
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
  // submit button ka label/icon status ke hisaab se badalta hai
  const status = useWatch({ control, name: "status" }) ?? "DRAFT";

  const set = <K extends keyof CreateProductFormInput>(
    name: K,
    value: CreateProductFormInput[K],
  ) => setValue(name, value as never, { shouldDirty: true });

  // Submit — hook khud toast karta (useCreateProduct), yahan sirf redirect
  const onSubmit = (data: CreateProductInput) => {
    createProduct(formToCreatePayload(data), {
      onSuccess: (product) =>
        router.push(`/seller/products/${product.id}/edit`),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    disabled={isPending}
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
                disabled={isPending}
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
              disabled={isPending}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                name="slug"
                label="Slug"
                placeholder="auto-generated-from-title"
                control={control}
                disabled={isPending}
                hint="Leave empty to auto-generate"
              />
              <TextInput
                name="brand"
                label="Brand"
                placeholder="e.g. Apple"
                control={control}
                disabled={isPending}
              />
            </div>
            <TextareaInput
              name="shortDescription"
              label="Short description (quick view)"
              rows={3}
              maxLength={2000}
              placeholder="Enter product description for quick view"
              control={control}
              disabled={isPending}
            />
            <CategorySelects
              control={control}
              setValue={setValue}
              disabled={isPending}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                name="warranty"
                label="Warranty"
                placeholder="1 Year / No Warranty"
                control={control}
                disabled={isPending}
              />
              {/* Status — Draft (private) ya Published (ACTIVE, public). Publish
                  ke liye kam se kam ek image chahiye (schema refine) */}
              <SelectInput
                name="status"
                label="Status"
                placeholder="Select status"
                options={productStatuses}
                labels={productStatusLabels}
                control={control}
                disabled={isPending}
                hint="Published needs at least one image"
              />
            </div>
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
                  disabled={isPending}
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
                disabled={isPending}
              />
              <PriceInput
                name="salePrice"
                label="Sale price *"
                control={control}
                disabled={isPending}
                hint="Must be ≤ MRP"
              />
              <TextInput
                name="currency"
                label="Currency"
                placeholder="INR"
                control={control}
                disabled={isPending}
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
                disabled={isPending}
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
                disabled={isPending}
              />
            </div>
            <SwitchInput
              name="cashOnDelivery"
              label="Cash on Delivery"
              description="Allow buyers to pay on delivery"
              control={control}
              disabled={isPending}
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
                disabled={isPending}
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
                disabled={isPending}
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
              disabled={isPending}
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
              disabled={isPending}
            />
          </SectionCard>

          {/* Video */}
          <SectionCard icon={VideoIcon} title="Product video (optional)">
            <VideoUploader
              value={videoUrl}
              onChange={(url) => set("videoUrl", url)}
              disabled={isPending}
            />
          </SectionCard>

          {/* Discounts */}
          <SectionCard icon={TicketPercent} title="Discount codes (optional)">
            <DiscountSelector
              value={discountCodeIds}
              onChange={(n) => set("discountCodeIds", n)}
              disabled={isPending}
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
                disabled={isPending}
              />
              <DateTimeInput
                name="eventEndsAt"
                label="Event ends"
                control={control}
                disabled={isPending}
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
              disabled={isPending}
            />
            <TextareaInput
              name="metaDescription"
              label="Meta description"
              rows={2}
              maxLength={320}
              placeholder="Shown below the title in search results"
              control={control}
              disabled={isPending}
            />
          </SectionCard>

          {/* Sticky action bar */}
          <motion.div
            initial={false}
            className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/90 px-4 py-3 backdrop-blur"
          >
            <p className="text-xs text-muted-foreground">
              {form.formState.isDirty
                ? "Unsaved changes"
                : "Ready when you are"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => router.push("/seller/products")}
              >
                Cancel
              </Button>
              {/* Single submit — status upar Basic info ke dropdown se aata hai.
                  Label/icon status ke hisaab se: ACTIVE → Publish, DRAFT → draft */}
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="gap-1.5"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : status === "ACTIVE" ? (
                  <Send className="size-4" />
                ) : (
                  <Save className="size-4" />
                )}{" "}
                {isPending
                  ? "Saving…"
                  : status === "ACTIVE"
                    ? "Publish product"
                    : "Save as draft"}
              </Button>
            </div>
          </motion.div>
        </FieldGroup>
      </form>
    </Form>
  );
}

// ============================================================================
// Reusable inputs + SectionCard (course pattern — exported, edit view reuses)
// ============================================================================
type Ctrl = Control<CreateProductFormInput>;
type Name = FieldPath<CreateProductFormInput>;
const FLABEL =
  "text-xs font-medium uppercase tracking-wider text-muted-foreground";

export function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-primary" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function TextInput({
  name,
  label,
  placeholder,
  hint,
  control,
  disabled,
}: {
  name: Name;
  label: string;
  placeholder?: string;
  hint?: string;
  control: Ctrl;
  disabled?: boolean;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel className={FLABEL}>{label}</FieldLabel>
          <Input
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={(field.value as string | undefined) ?? ""}
            onChange={field.onChange}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
          />
          {hint && !fieldState.invalid && (
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          )}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}

export function NumberInput({
  name,
  label,
  placeholder,
  hint,
  control,
  disabled,
}: {
  name: Name;
  label: string;
  placeholder?: string;
  hint?: string;
  control: Ctrl;
  disabled?: boolean;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel className={FLABEL}>{label}</FieldLabel>
          <Input
            type="number"
            min={0}
            step={1}
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={(field.value as number | null | undefined) ?? ""}
            onChange={(e) =>
              field.onChange(
                e.target.value === "" ? undefined : Number(e.target.value),
              )
            }
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
          />
          {hint && !fieldState.invalid && (
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          )}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}

export function PriceInput({
  name,
  label,
  control,
  disabled,
  hint,
  currency = "₹",
}: {
  name: Name;
  label: string;
  control: Ctrl;
  disabled?: boolean;
  hint?: string;
  currency?: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel className={FLABEL}>{label}</FieldLabel>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {currency}
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={(field.value as number | null | undefined) ?? ""}
              onChange={(e) =>
                field.onChange(
                  e.target.value === "" ? undefined : Number(e.target.value),
                )
              }
              placeholder="0.00"
              disabled={disabled}
              aria-invalid={fieldState.invalid}
              className="pl-7"
            />
          </div>
          {hint && !fieldState.invalid && (
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          )}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}

export function TextareaInput({
  name,
  label,
  placeholder,
  rows = 3,
  maxLength,
  control,
  disabled,
}: {
  name: Name;
  label: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  control: Ctrl;
  disabled?: boolean;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel className={FLABEL}>{label}</FieldLabel>
          <Textarea
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={(field.value as string | undefined) ?? ""}
            onChange={field.onChange}
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
          />
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}

// ── datetime-local string ("YYYY-MM-DDTHH:mm") helpers ──
const DT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function parseLocalDateTime(v?: string | null): { date?: Date; time: string } {
  if (!v) return { time: "" };
  const d = new Date(v);
  const time = v.includes("T") ? v.split("T")[1].slice(0, 5) : "";
  return { date: Number.isNaN(d.getTime()) ? undefined : d, time };
}
function buildLocalDateTime(date: Date, time: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time || "00:00"}`;
}

// ============================================================================
// DateTimeInput — shadcn Popover + Calendar + time (auto-close on date pick)
// ============================================================================
// Value form me datetime-local string rehti hai (mapper ISO me convert karta).
// Industry pattern (Linear/Stripe): time set karo → din pick karo → popover
// turant band. Framer motion entrance.
export function DateTimeInput({
  name,
  label,
  hint,
  control,
  disabled,
}: {
  name: Name;
  label: string;
  hint?: string;
  control: Ctrl;
  disabled?: boolean;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <DateTimeField
          label={label}
          hint={hint}
          disabled={disabled}
          invalid={fieldState.invalid}
          error={fieldState.error}
          value={(field.value as string | null | undefined) ?? ""}
          onChange={field.onChange}
        />
      )}
    />
  );
}

// ─── TimeSelect — HH : MM via two shadcn Selects (no ugly native picker) ───
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function TimeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [h = "00", m = "00"] = (value || "00:00").split(":");
  return (
    <div className="flex items-center gap-1">
      <Select value={h} onValueChange={(nh) => onChange(`${nh}:${m}`)} disabled={disabled}>
        <SelectTrigger className="h-8 w-[4.25rem] tabular-nums">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-56">
          {HOURS.map((hh) => (
            <SelectItem key={hh} value={hh} className="tabular-nums">
              {hh}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-sm font-semibold text-muted-foreground">:</span>
      <Select value={m} onValueChange={(nm) => onChange(`${h}:${nm}`)} disabled={disabled}>
        <SelectTrigger className="h-8 w-[4.25rem] tabular-nums">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-56">
          {MINUTES.map((mm) => (
            <SelectItem key={mm} value={mm} className="tabular-nums">
              {mm}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Inner field — owns popover-open + local time state ───
function DateTimeField({
  label,
  hint,
  value,
  onChange,
  disabled,
  invalid,
  error,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid: boolean;
  error: unknown;
}) {
  const [open, setOpen] = useState(false);
  const { date } = parseLocalDateTime(value);
  const [time, setTime] = useState(parseLocalDateTime(value).time || "12:00");

  // external value change → time sync
  useEffect(() => {
    const t = parseLocalDateTime(value).time;
    if (t) setTime(t);
  }, [value]);

  return (
    <Field data-invalid={invalid}>
      <FieldLabel className={FLABEL}>{label}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={invalid}
            className={`w-full justify-start gap-2 text-left font-normal${
              date ? "" : " text-muted-foreground"
            }`}
          >
            <CalendarIcon className="size-4 text-primary" />
            {date
              ? `${date.getDate()} ${DT_MONTHS[date.getMonth()]} ${date.getFullYear()}, ${time}`
              : "Pick date & time"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[320px] overflow-hidden p-0">
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {/* Time row — shadcn Select (HH : MM), centered */}
            <div className="flex items-center justify-center gap-2 border-b border-border bg-muted/30 p-3">
              <Clock className="size-4 text-muted-foreground" />
              <TimeSelect
                value={time}
                disabled={disabled}
                onChange={(t) => {
                  setTime(t);
                  if (date) onChange(buildLocalDateTime(date, t));
                }}
              />
              <span className="text-[11px] text-muted-foreground">
                then pick a day
              </span>
            </div>

            {/* Calendar — centered. date pick → combine with time + auto-close */}
            <div className="flex justify-center p-2">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (d) {
                    onChange(buildLocalDateTime(d, time || "00:00"));
                    setOpen(false);
                  }
                }}
                defaultMonth={date}
                captionLayout="dropdown"
                startMonth={new Date(2020, 0)}
                endMonth={new Date(2050, 11)}
              />
            </div>

            {(date || value) && (
              <div className="border-t border-border p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="w-full text-xs text-muted-foreground hover:text-rose-500"
                >
                  Clear
                </Button>
              </div>
            )}
          </motion.div>
        </PopoverContent>
      </Popover>
      {hint && !invalid && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
      {invalid && (
        <FieldError
          errors={
            error
              ? ([error] as NonNullable<Parameters<typeof FieldError>[0]>["errors"])
              : []
          }
        />
      )}
    </Field>
  );
}

export function SwitchInput({
  name,
  label,
  description,
  control,
  disabled,
}: {
  name: Name;
  label: string;
  description?: string;
  control: Ctrl;
  disabled?: boolean;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card/40 px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">{label}</p>
            {description && (
              <p className="text-[11px] text-muted-foreground">{description}</p>
            )}
          </div>
          <Switch
            checked={!!field.value}
            onCheckedChange={field.onChange}
            disabled={disabled}
          />
        </div>
      )}
    />
  );
}

// ============================================================================
// SelectInput — enum dropdown (status/level jaisa). Course SelectInput mirror.
// ============================================================================
// Generic <T> taaki options + labels type-safe rahein. field.value enum string
// hota hai → Select ka value/onValueChange seedha bind.
export function SelectInput<T extends string>({
  name,
  label,
  placeholder,
  options,
  labels,
  hint,
  control,
  disabled,
}: {
  name: Name;
  label: string;
  placeholder?: string;
  options: readonly T[];
  labels: Record<T, string>;
  hint?: string;
  control: Ctrl;
  disabled?: boolean;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel className={FLABEL}>{label}</FieldLabel>
          <Select
            value={(field.value as string | undefined) ?? undefined}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <SelectTrigger aria-invalid={fieldState.invalid}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {labels[opt]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hint && !fieldState.invalid && (
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          )}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}
