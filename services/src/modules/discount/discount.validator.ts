// ============================================================================
// discount.validator.ts - Zod schemas for seller discount codes
// ============================================================================
// DiscountCode alag table hai (M:N with Product). Seller apne codes manage
// karta hai, fir product create/edit pe select karta hai.
//
// value semantics:
//   type=PERCENT → value = 1..100 (percentage)
//   type=FLAT    → value = minor units (paise/cents), > 0
// ============================================================================

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { PAGINATION } from "../../config/constants.js";

extendZodWithOpenApi(z);

// ISO datetime string → Date (optional fields)
const optionalDate = z.coerce.date().optional().nullable();

// ============================================================================
// CREATE - base shape; refine PERCENT value range
// ============================================================================
export const createDiscountSchema = z
  .object({
    // code uppercase normalize service me, yahan format guard
    code: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/, "Code can only contain letters, numbers, - and _")
      .trim()
      .openapi({ example: "FLASH5" }),
    title: z.string().max(120).trim().optional(),
    type: z.enum(["PERCENT", "FLAT"]).default("PERCENT"),
    value: z.number().int().positive(),
    minOrder: z.number().int().min(0).optional().nullable(),
    maxUses: z.number().int().positive().optional().nullable(),
    perUserLimit: z.number().int().positive().optional().nullable(),
    startsAt: optionalDate,
    endsAt: optionalDate,
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.type !== "PERCENT" || d.value <= 100, {
    message: "PERCENT discount value must be between 1 and 100",
    path: ["value"],
  })
  .refine((d) => !d.startsAt || !d.endsAt || d.endsAt > d.startsAt, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  })
  .openapi("CreateDiscountRequest");

// ============================================================================
// UPDATE - partial (no refine cross-checks; service re-validates PERCENT)
// ============================================================================
export const updateDiscountSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/)
      .trim()
      .optional(),
    title: z.string().max(120).trim().optional().nullable(),
    type: z.enum(["PERCENT", "FLAT"]).optional(),
    value: z.number().int().positive().optional(),
    minOrder: z.number().int().min(0).optional().nullable(),
    maxUses: z.number().int().positive().optional().nullable(),
    perUserLimit: z.number().int().positive().optional().nullable(),
    startsAt: optionalDate,
    endsAt: optionalDate,
    isActive: z.boolean().optional(),
  })
  .openapi("UpdateDiscountRequest");

// ============================================================================
// LIST query - cursor + offset hybrid + filters
// ============================================================================
export const listDiscountsSchema = z.object({
  search: z.string().trim().optional(),
  // ⚠️ z.coerce.boolean() mat use karo: query string "false" → Boolean("false")
  // === true ban jaata hai (har non-empty string truthy). Isse "inactive" filter
  // toot jaata. Yahan literal "true"/"false" string ko sahi boolean me map karte.
  isActive: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .optional(),
  cursor: z.string().cuid().optional().nullable(),
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION.MIN_PAGE_SIZE)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
});

export const discountIdParam = z.object({ id: z.string().cuid() });

export type CreateDiscountDto = z.infer<typeof createDiscountSchema>;
export type UpdateDiscountDto = z.infer<typeof updateDiscountSchema>;
export type ListDiscountsQuery = z.infer<typeof listDiscountsSchema>;
