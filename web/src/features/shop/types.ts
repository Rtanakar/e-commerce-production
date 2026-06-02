// ============================================================================
// shop/types.ts — Customer storefront domain types
// ============================================================================
// Backend public endpoints (/products, /cart, /wishlist) ke response shapes.
// Pricing minor units (paise). Color variants product card pe dikhte hain.
// ============================================================================

export interface ShopImage {
  url: string;
  alt: string | null;
}

// Variant — color/size choice (card pe color swatch ke liye)
export interface ShopVariant {
  id: string;
  title: string;
  color: string | null; // hex
  price: number | null; // minor units override (null = product price)
  stock: number;
  images?: ShopImage[];
}

// Public product (storefront card + listing)
export interface ShopProduct {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  shortDescription?: string | null;
  bannerUrl?: string | null; // seller-uploaded "Banner (optional)" — hero carousel
  currency: string;
  regularPrice: number; // MRP, minor units
  salePrice: number; // selling, minor units
  discountPercent: number;
  stock: number;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  colors?: string[]; // base product ke hex colors — default swatch ka actual color
  images: ShopImage[];
  variants?: ShopVariant[];
  category?: { id: string; name: string; slug: string } | null;
  subcategory?: { id: string; name: string; slug: string } | null;
}

// ── Cart line (server response) ──
export interface CartLine {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number; // effective (variant ?? product), minor units
  lineTotal: number;
  availableStock: number;
  product: {
    id: string;
    slug: string;
    title: string;
    brand: string | null;
    currency: string;
    regularPrice: number;
    salePrice: number;
    discountPercent: number;
    stock: number;
    status: string;
    images: ShopImage[];
  };
  variant: {
    id: string;
    title: string;
    color: string | null;
    price: number | null;
    stock: number;
    images: ShopImage[];
  } | null;
}

export interface CartSummary {
  totalItems: number;
  totalLines: number;
  subtotal: number;
  mrpTotal: number;
  savings: number;
  currency: string;
}

export interface CartResponse {
  items: CartLine[];
  summary: CartSummary;
}

// ── Wishlist line ──
export interface WishlistLine {
  id: string;
  productId: string;
  variantId: string | null;
  createdAt: string;
  product: CartLine["product"];
  variant: { id: string; title: string; color: string | null; price: number | null; stock: number } | null;
}

export interface WishlistResponse {
  items: WishlistLine[];
  count: number;
}

// ── Guest (localStorage) shapes — minimal, server se merge hota ──
export interface GuestCartItem {
  productId: string;
  variantId: string | null;
  quantity: number;
  // UI snapshot (offline render — server se overwrite ho jaata)
  name: string;
  slug: string;
  price: number;
  image?: string;
  color?: string | null;
}

export interface GuestWishlistItem {
  productId: string;
  variantId: string | null;
  name: string;
  slug: string;
  price: number;
  image?: string;
}
