// ============================================================================
// product-mappers.ts — form ↔ API shape conversion
// ============================================================================
// Form me RUPEES (UX), API me minor units (paise). Yahin convert hota hai.
// ============================================================================

import type {
  CreateProductFormInput,
  CreateProductInput,
} from "../validators/product-validator";
import type { ProductDetail, ProductImage, ProductVariant } from "../types";

// rupees → paise (round to avoid float drift)
const toMinor = (rupees: number) => Math.round((rupees || 0) * 100);
// paise → rupees
const toMajor = (paise: number) => (paise || 0) / 100;

// strip "" → undefined (API ko clean payload)
const clean = (s?: string | null) => (s && s.trim() !== "" ? s : undefined);

// ISO → <input type="datetime-local"> value (local time, "YYYY-MM-DDTHH:mm")
function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// datetime-local string → ISO (or null when empty — null update pe clear karta)
function fromDateInput(v?: string | null): string | null {
  if (!v || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ─── image form value → API image ───
function imageOut(img: ProductImage) {
  return {
    url: img.url,
    key: img.key ?? undefined,
    alt: img.alt ?? undefined,
    isPrimary: !!img.isPrimary,
    position: img.position ?? 0,
    width: img.width ?? undefined,
    height: img.height ?? undefined,
    sizeBytes: img.sizeBytes ?? undefined,
  };
}

function variantOut(v: ProductVariant) {
  return {
    title: v.title,
    color: clean(v.color),
    tags: v.tags ?? [],
    sku: clean(v.sku),
    price: v.price != null ? toMinor(v.price) : undefined,
    stock: v.stock ?? 0,
    position: v.position ?? 0,
    images: (v.images ?? []).map(imageOut),
  };
}

// ============================================================================
// formToCreatePayload — form values → POST /products body
// ============================================================================
export function formToCreatePayload(d: CreateProductInput) {
  return {
    title: d.title,
    slug: clean(d.slug),
    brand: clean(d.brand),
    shortDescription: clean(d.shortDescription),
    description: clean(d.description),
    warranty: clean(d.warranty),
    videoUrl: clean(d.videoUrl),
    categoryId: d.categoryId,
    subcategoryId: clean(d.subcategoryId),
    tags: d.tags ?? [],
    colors: d.colors ?? [],
    sizes: d.sizes ?? [],
    currency: d.currency ?? "INR",
    regularPrice: toMinor(d.regularPrice ?? 0),
    salePrice: toMinor(d.salePrice ?? 0),
    stock: d.stock ?? 0,
    cashOnDelivery: d.cashOnDelivery ?? true,
    specifications: (d.specifications ?? []).filter((s) => s.label && s.value),
    bannerUrl: clean(d.bannerUrl),
    images: (d.images ?? []).map((i) => imageOut(i as ProductImage)),
    variants: (d.variants ?? []).map((v) => variantOut(v as ProductVariant)),
    discountCodeIds: d.discountCodeIds ?? [],
    status: d.status ?? "DRAFT",
    eventStartsAt: fromDateInput(d.eventStartsAt),
    eventEndsAt: fromDateInput(d.eventEndsAt),
    metaTitle: clean(d.metaTitle),
    metaDescription: clean(d.metaDescription),
  };
}

// ============================================================================
// formToUpdatePayload — sirf badले fields (dirty) ko PATCH body me
// ============================================================================
// RHF dirtyFields se decide karte hain kaunse fields bheje. Arrays/media full
// bhejte hain jab woh dirty ho (backend REPLACE karta hai).
// ============================================================================
export function formToUpdatePayload(
  d: CreateProductInput,
  dirty: Partial<Record<keyof CreateProductFormInput, unknown>>,
): Record<string, unknown> {
  const full = formToCreatePayload(d);
  const payload: Record<string, unknown> = {};
  for (const key of Object.keys(dirty) as (keyof typeof full)[]) {
    if (key in full) payload[key] = full[key];
  }
  return payload;
}

// ============================================================================
// detailToFormValues — API ProductDetail → RHF form values (paise → rupees)
// ============================================================================
export function detailToFormValues(p: ProductDetail): CreateProductFormInput {
  return {
    title: p.title,
    slug: p.slug,
    brand: p.brand ?? "",
    shortDescription: p.shortDescription ?? "",
    description: p.description ?? "",
    warranty: p.warranty ?? "",
    videoUrl: p.videoUrl ?? "",
    // categoryId/subcategoryId scalar normally aate hain; defensive fallback
    // nested category/subcategory object pe (agar kabhi scalar missing ho)
    categoryId: p.categoryId ?? p.category?.id ?? "",
    subcategoryId: p.subcategoryId ?? p.subcategory?.id ?? "",
    tags: p.tags ?? [],
    colors: p.colors ?? [],
    sizes: p.sizes ?? [],
    currency: p.currency ?? "INR",
    regularPrice: toMajor(p.regularPrice),
    salePrice: toMajor(p.salePrice),
    stock: p.stock ?? 0,
    cashOnDelivery: p.cashOnDelivery ?? true,
    specifications: p.specifications ?? [],
    bannerUrl: p.bannerUrl ?? "",
    images: (p.images ?? []).map((i) => ({ ...i })),
    variants: (p.variants ?? []).map((v) => ({
      ...v,
      price: v.price != null ? toMajor(v.price) : null,
      images: v.images ?? [],
    })),
    discountCodeIds: (p.discountCodes ?? []).map((dc) => dc.id),
    status: p.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
    eventStartsAt: toDateInput(p.eventStartsAt),
    eventEndsAt: toDateInput(p.eventEndsAt),
    metaTitle: p.metaTitle ?? "",
    metaDescription: p.metaDescription ?? "",
  };
}
