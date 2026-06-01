// ============================================================================
// product-defaults.ts — RHF default values for create/edit product form
// ============================================================================
// Type validator se (CreateProductFormInput), values yahan. Create + edit dono
// import karte hain (employeeDefaultValues pattern).
// ============================================================================

import type { CreateProductFormInput } from "../validators/product-validator";

export const productDefaultValues: CreateProductFormInput = {
  title: "",
  slug: "",
  brand: "",
  shortDescription: "",
  description: "",
  warranty: "",
  videoUrl: "",
  categoryId: "",
  subcategoryId: "",
  tags: [],
  colors: [],
  sizes: [],
  currency: "INR",
  regularPrice: 0,
  salePrice: 0,
  stock: 0,
  cashOnDelivery: true,
  specifications: [],
  bannerUrl: "",
  images: [],
  variants: [],
  discountCodeIds: [],
  status: "DRAFT",
  eventStartsAt: "",
  eventEndsAt: "",
  metaTitle: "",
  metaDescription: "",
};
