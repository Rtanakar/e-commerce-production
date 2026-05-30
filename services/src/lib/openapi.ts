// ============================================================================
// openapi.ts - OpenAPI 3.1 spec generator from Zod schemas
// ============================================================================
// zod-to-openapi pattern - schemas hi source of truth
// JSDoc duplication NAHI - validator file me hi .openapi() metadata
//
// Generated spec consumers:
//   - Swagger UI (interactive API explorer)
//   - Postman/Insomnia (import & test)
//   - Frontend SDK generation (openapi-typescript, openapi-fetch)
//
// Industry: Stripe, Twilio, Linear - all expose OpenAPI spec
// ============================================================================

import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { env } from "../config/env.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  userRoleSchema,
} from "../modules/auth/auth.validator.js";
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
} from "../modules/product/product.validator.js";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../modules/category/category.validator.js";
import {
  createDiscountSchema,
  updateDiscountSchema,
} from "../modules/discount/discount.validator.js";
import { presignUploadSchema, deleteObjectSchema } from "../modules/upload/upload.validator.js";
import { z } from "zod";

// ============================================================================
// Registry - sab schemas + paths yahan register hote hai
// ============================================================================
const registry = new OpenAPIRegistry();

// ============================================================================
// Reusable schema components
// ============================================================================
registry.register("UserRole", userRoleSchema);
registry.register("RegisterRequest", registerSchema);
registry.register("LoginRequest", loginSchema);
registry.register("RefreshRequest", refreshSchema);
registry.register("ChangePasswordRequest", changePasswordSchema);
registry.register("VerifyOtpRequest", verifyOtpSchema);
registry.register("ResendOtpRequest", resendOtpSchema);
registry.register("ForgotPasswordRequest", forgotPasswordSchema);
registry.register("ResetPasswordRequest", resetPasswordSchema);

// ── Catalog request schemas (validators me .openapi() name already set) ──
registry.register("CreateProductRequest", createProductSchema);
registry.register("UpdateProductRequest", updateProductSchema);
registry.register("CreateCategoryRequest", createCategorySchema);
registry.register("UpdateCategoryRequest", updateCategorySchema);
registry.register("CreateDiscountRequest", createDiscountSchema);
registry.register("UpdateDiscountRequest", updateDiscountSchema);
registry.register("PresignUploadRequest", presignUploadSchema);
registry.register("DeleteObjectRequest", deleteObjectSchema);

// User response schema
const userResponseSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().nullable(),
    role: userRoleSchema,
  })
  .openapi("User");
registry.register("User", userResponseSchema);

// Tokens schema
const tokensSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
  })
  .openapi("AuthTokens");
registry.register("AuthTokens", tokensSchema);

// Auth response (login/register/refresh)
const authResponseSchema = z
  .object({
    user: userResponseSchema,
    tokens: tokensSchema,
  })
  .openapi("AuthResponse");
registry.register("AuthResponse", authResponseSchema);

// Generic success response wrapper
const successResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.unknown(),
    requestId: z.string().optional(),
  })
  .openapi("SuccessResponse");

// Generic error response
const errorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
    requestId: z.string().optional(),
    timestamp: z.string().optional(),
  })
  .openapi("ErrorResponse");
registry.register("ErrorResponse", errorResponseSchema);

// ============================================================================
// Security schemes - JWT Bearer (access) + httpOnly Cookie (refresh)
// ============================================================================
// bearerAuth: client sends `Authorization: Bearer <access_token>` header
// cookieAuth: browser auto-sends `rt` httpOnly cookie (Swagger UI also supports)
// ============================================================================
registry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "rt",
  description:
    "httpOnly refresh-token cookie. Set automatically by login/verify-otp endpoints. " +
    "Browsers auto-send on /auth/refresh. Path-scoped to /api/v1/auth.",
});

const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "JWT access token. Format: Bearer <token>",
});

// Seller cookie jar — seller portal endpoints (products/discounts/uploads writes)
// browser auto-sends `seller-access-token`. Mutations ko `X-CSRF-Token` header
// bhi chahiye (seller-csrf-token cookie se match).
const sellerCookieAuth = registry.registerComponent("securitySchemes", "sellerCookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "seller-access-token",
  description:
    "httpOnly seller access-token cookie (seller portal jar). Set by " +
    "/auth/seller/login. Mutations additionally require X-CSRF-Token header.",
});

// ============================================================================
// Helper - error response template
// ============================================================================
function errorResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: errorResponseSchema } },
  };
}

// ============================================================================
// AUTH paths
// ============================================================================
const apiBase = `/${env.API_PREFIX}/${env.API_VERSION}`;

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/register`,
  tags: ["Auth"],
  summary: "Register a new user",
  description: "Create a new customer or vendor account",
  request: {
    body: {
      content: { "application/json": { schema: registerSchema } },
    },
  },
  responses: {
    201: {
      description: "User created successfully",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: errorResponse("Validation failed"),
    409: errorResponse("Email already exists"),
    429: errorResponse("Too many requests"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/login`,
  tags: ["Auth"],
  summary: "Log in",
  request: {
    body: { content: { "application/json": { schema: loginSchema } } },
  },
  responses: {
    200: {
      description: "Login successful",
      content: { "application/json": { schema: successResponseSchema } },
    },
    401: errorResponse("Invalid credentials"),
    403: errorResponse("Account suspended"),
    429: errorResponse("Too many requests"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/refresh`,
  tags: ["Auth"],
  summary: "Refresh access token",
  description: "Exchange refresh token for new token pair (rotation)",
  request: {
    body: { content: { "application/json": { schema: refreshSchema } } },
  },
  responses: {
    200: {
      description: "Tokens refreshed",
      content: { "application/json": { schema: successResponseSchema } },
    },
    401: errorResponse("Invalid or revoked refresh token"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/logout`,
  tags: ["Auth"],
  summary: "Log out (current session)",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "Logged out",
      content: { "application/json": { schema: successResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/logout-all`,
  tags: ["Auth"],
  summary: "Log out from all devices",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "All sessions revoked",
      content: { "application/json": { schema: successResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
  },
});

registry.registerPath({
  method: "get",
  path: `${apiBase}/auth/me`,
  tags: ["Auth"],
  summary: "Get current user",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "Current user",
      content: { "application/json": { schema: successResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/change-password`,
  tags: ["Auth"],
  summary: "Change password",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: { content: { "application/json": { schema: changePasswordSchema } } },
  },
  responses: {
    200: {
      description: "Password changed",
      content: { "application/json": { schema: successResponseSchema } },
    },
    401: errorResponse("Unauthorized or wrong current password"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/verify-otp`,
  tags: ["Auth"],
  summary: "Verify email OTP",
  description: "Verifies the OTP sent during registration. Returns tokens on success.",
  request: { body: { content: { "application/json": { schema: verifyOtpSchema } } } },
  responses: {
    200: {
      description: "OTP verified, tokens issued",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: errorResponse("Invalid or expired OTP"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/resend-otp`,
  tags: ["Auth"],
  summary: "Resend OTP",
  request: { body: { content: { "application/json": { schema: resendOtpSchema } } } },
  responses: {
    200: { description: "OTP resent (or silent if user doesn't exist)" },
    429: errorResponse("Cooldown active or hourly limit exceeded"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/forgot-password`,
  tags: ["Auth"],
  summary: "Request password reset email",
  request: { body: { content: { "application/json": { schema: forgotPasswordSchema } } } },
  responses: {
    200: { description: "Reset email sent (silent if user doesn't exist)" },
    429: errorResponse("Too many requests"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/reset-password`,
  tags: ["Auth"],
  summary: "Reset password via token",
  request: { body: { content: { "application/json": { schema: resetPasswordSchema } } } },
  responses: {
    200: { description: "Password reset" },
    400: errorResponse("Invalid or expired token"),
  },
});

// ============================================================================
// CATEGORIES
// ============================================================================
registry.registerPath({
  method: "get",
  path: `${apiBase}/categories`,
  tags: ["Categories"],
  summary: "List categories",
  description: "Public. shape=tree (nested children) ya flat. parentId se subcategory filter.",
  request: {
    query: z.object({
      includeInactive: z.coerce.boolean().optional(),
      shape: z.enum(["tree", "flat"]).optional(),
      parentId: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Category list (tree ya flat)",
      content: { "application/json": { schema: successResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: `${apiBase}/categories/{slug}`,
  tags: ["Categories"],
  summary: "Get category by slug",
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: {
      description: "Category + active children",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: errorResponse("Category not found"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/categories`,
  tags: ["Categories"],
  summary: "Create category (ADMIN)",
  security: [{ [bearerAuth.name]: [] }],
  request: { body: { content: { "application/json": { schema: createCategorySchema } } } },
  responses: {
    201: {
      description: "Category created",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: errorResponse("Validation / slug taken / 2-level limit"),
    403: errorResponse("Admin only"),
  },
});

registry.registerPath({
  method: "patch",
  path: `${apiBase}/categories/{id}`,
  tags: ["Categories"],
  summary: "Update category (ADMIN)",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: updateCategorySchema } } },
  },
  responses: {
    200: {
      description: "Category updated",
      content: { "application/json": { schema: successResponseSchema } },
    },
    403: errorResponse("Admin only"),
    404: errorResponse("Category not found"),
  },
});

registry.registerPath({
  method: "delete",
  path: `${apiBase}/categories/{id}`,
  tags: ["Categories"],
  summary: "Delete category (ADMIN)",
  description: "Guard: linked products / subcategories na ho.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Category deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: errorResponse("Has linked products or subcategories"),
    403: errorResponse("Admin only"),
  },
});

// ============================================================================
// PRODUCTS
// ============================================================================
registry.registerPath({
  method: "get",
  path: `${apiBase}/products`,
  tags: ["Products"],
  summary: "List products (public storefront)",
  description:
    "ACTIVE products only. Cursor + offset hybrid pagination. Filters: " +
    "category/subcategory/tag/brand/price-range/inStock. Sort: newest|oldest|" +
    "price-asc|price-desc|popular|rating|discount.",
  request: { query: listProductsSchema },
  responses: {
    200: {
      description:
        "Paginated product list { products, nextCursor, totalCount, totalPages, hasNextPage, hasPreviousPage }",
      content: { "application/json": { schema: successResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: `${apiBase}/products/seller/mine`,
  tags: ["Products"],
  summary: "List my products (seller)",
  description:
    "Vendor-scoped 'All Products'. DRAFT/ARCHIVED bhi dikhte hain. status filter allowed.",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: { query: listProductsSchema },
  responses: {
    200: {
      description: "Seller's paginated products",
      content: { "application/json": { schema: successResponseSchema } },
    },
    403: errorResponse("Not a seller / shop setup incomplete"),
  },
});

registry.registerPath({
  method: "get",
  path: `${apiBase}/products/seller/{id}`,
  tags: ["Products"],
  summary: "Get my product by id (seller edit form)",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Full product (DRAFT visible)",
      content: { "application/json": { schema: successResponseSchema } },
    },
    403: errorResponse("Not owner"),
    404: errorResponse("Product not found"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/products`,
  tags: ["Products"],
  summary: "Create product (seller)",
  description:
    "Save Draft → status=DRAFT, Create → status=ACTIVE. Images presign/upload pehle, yahan {url,key} aata.",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: { body: { content: { "application/json": { schema: createProductSchema } } } },
  responses: {
    201: {
      description: "Product created (full payload)",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: errorResponse("Validation / slug taken / invalid category"),
    403: errorResponse("Not a seller"),
  },
});

registry.registerPath({
  method: "patch",
  path: `${apiBase}/products/{id}`,
  tags: ["Products"],
  summary: "Update product (seller)",
  description: "PATCH — arrays (images/variants/discountCodeIds) diye to REPLACE hote hain.",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: updateProductSchema } } },
  },
  responses: {
    200: {
      description: "Product updated",
      content: { "application/json": { schema: successResponseSchema } },
    },
    403: errorResponse("Not owner"),
    404: errorResponse("Product not found"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/products/{id}/archive`,
  tags: ["Products"],
  summary: "Archive product (soft delete)",
  description: "status=ARCHIVED + deletedAt. Reversible via restore.",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Product archived",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: errorResponse("Already archived"),
    403: errorResponse("Not owner"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/products/{id}/restore`,
  tags: ["Products"],
  summary: "Restore archived product → DRAFT",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Product restored to DRAFT",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: errorResponse("Not archived"),
    403: errorResponse("Not owner"),
  },
});

registry.registerPath({
  method: "delete",
  path: `${apiBase}/products/{id}`,
  tags: ["Products"],
  summary: "Delete product (hard delete + media cleanup)",
  description:
    "DB delete + R2/S3 media cleanup (gallery + variant + TipTap-embedded). Owner/admin.",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Product deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    403: errorResponse("Not owner"),
    404: errorResponse("Product not found"),
  },
});

registry.registerPath({
  method: "get",
  path: `${apiBase}/products/{slug}`,
  tags: ["Products"],
  summary: "Get product by slug (public detail)",
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: {
      description: "Full product detail (view count incremented)",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: errorResponse("Product not found"),
  },
});

// ============================================================================
// DISCOUNTS (seller-scoped)
// ============================================================================
registry.registerPath({
  method: "get",
  path: `${apiBase}/discounts`,
  tags: ["Discounts"],
  summary: "List my discount codes (seller)",
  description: "Cursor + offset hybrid. search + isActive filter.",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: {
    query: z.object({
      search: z.string().optional(),
      isActive: z.coerce.boolean().optional(),
      cursor: z.string().optional(),
      limit: z.coerce.number().optional(),
      page: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: {
      description: "Paginated discount codes",
      content: { "application/json": { schema: successResponseSchema } },
    },
    403: errorResponse("Not a seller"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/discounts`,
  tags: ["Discounts"],
  summary: "Create discount code (seller)",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: { body: { content: { "application/json": { schema: createDiscountSchema } } } },
  responses: {
    201: {
      description: "Discount code created",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: errorResponse("Validation / code already exists"),
    403: errorResponse("Not a seller"),
  },
});

registry.registerPath({
  method: "get",
  path: `${apiBase}/discounts/{id}`,
  tags: ["Discounts"],
  summary: "Get discount code (seller)",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Discount code",
      content: { "application/json": { schema: successResponseSchema } },
    },
    403: errorResponse("Not owner"),
    404: errorResponse("Not found"),
  },
});

registry.registerPath({
  method: "patch",
  path: `${apiBase}/discounts/{id}`,
  tags: ["Discounts"],
  summary: "Update discount code (seller)",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: updateDiscountSchema } } },
  },
  responses: {
    200: {
      description: "Updated",
      content: { "application/json": { schema: successResponseSchema } },
    },
    403: errorResponse("Not owner"),
    404: errorResponse("Not found"),
  },
});

registry.registerPath({
  method: "delete",
  path: `${apiBase}/discounts/{id}`,
  tags: ["Discounts"],
  summary: "Delete discount code (seller)",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    403: errorResponse("Not owner"),
    404: errorResponse("Not found"),
  },
});

// ============================================================================
// UPLOADS (seller-scoped)
// ============================================================================
registry.registerPath({
  method: "post",
  path: `${apiBase}/uploads/image`,
  tags: ["Uploads"],
  summary: "Upload + optimize image (webp/avif)",
  description:
    "Multipart 'file' field. Backend sharp se optimize karke (resize + webp/avif " +
    "compress) R2/S3 me upload karta hai. ?thumbnail=true → thumb variant bhi. " +
    "Returns { url, key, format, width, height, sizeBytes, originalBytes }.",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: {
    query: z.object({ thumbnail: z.coerce.boolean().optional() }),
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({ file: z.string().openapi({ type: "string", format: "binary" }) }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Image optimized + uploaded",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: errorResponse("Not an image / too large"),
    403: errorResponse("Not a seller"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/uploads/presign`,
  tags: ["Uploads"],
  summary: "Presigned PUT URL (video / large file)",
  description:
    "Raw direct upload (sharp se nahi guzarta). Returns { uploadUrl, key, publicUrl, expiresIn }.",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: { body: { content: { "application/json": { schema: presignUploadSchema } } } },
  responses: {
    200: {
      description: "Presigned upload URL",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: errorResponse("Unsupported type / too large"),
    403: errorResponse("Not a seller"),
  },
});

registry.registerPath({
  method: "delete",
  path: `${apiBase}/uploads`,
  tags: ["Uploads"],
  summary: "Delete uploaded object",
  description: "Folder-prefix ownership guard — sirf apne uploads delete kar sakte.",
  security: [{ [sellerCookieAuth.name]: [] }],
  request: { body: { content: { "application/json": { schema: deleteObjectSchema } } } },
  responses: {
    200: {
      description: "Object deleted",
      content: { "application/json": { schema: successResponseSchema } },
    },
    403: errorResponse("Not your upload"),
  },
});

// ============================================================================
// Health
// ============================================================================
registry.registerPath({
  method: "get",
  path: `${apiBase}/health`,
  tags: ["System"],
  summary: "Liveness probe",
  responses: {
    200: { description: "Service is alive" },
  },
});

registry.registerPath({
  method: "get",
  path: `${apiBase}/health/ready`,
  tags: ["System"],
  summary: "Readiness probe (deep check)",
  description: "Verifies DB + Redis connectivity",
  responses: {
    200: { description: "All dependencies healthy" },
    503: { description: "One or more dependencies unhealthy" },
  },
});

// ============================================================================
// Generate spec - on-demand (cached after first call)
// ============================================================================
let cachedSpec: ReturnType<OpenApiGeneratorV31["generateDocument"]> | null = null;

export function generateOpenApiSpec() {
  if (cachedSpec) return cachedSpec;

  const generator = new OpenApiGeneratorV31(registry.definitions);

  cachedSpec = generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "E-Commerce API",
      version: "1.0.0",
      description:
        "Multi-vendor e-commerce platform API. All endpoints return a consistent envelope: " +
        "`{ success: true, data }` or `{ success: false, error: { code, message } }`.",
      contact: { name: "Platform Team" },
      license: { name: "Proprietary" },
    },
    servers: [
      { url: "http://localhost:" + env.PORT, description: "Local development" },
      // Production servers add karo as needed:
      // { url: "https://api.shop.com", description: "Production" },
    ],
    tags: [
      { name: "Auth", description: "Authentication & session management" },
      { name: "Categories", description: "Category taxonomy (public read, admin CRUD)" },
      { name: "Products", description: "Product catalog — public listing/detail + seller CRUD" },
      { name: "Discounts", description: "Seller discount codes" },
      { name: "Uploads", description: "Image optimization + presigned media uploads" },
      { name: "System", description: "Health & operational endpoints" },
    ],
  });

  return cachedSpec;
}

export { registry };
