// ============================================================================
// api-response.ts - API response shape contracts
// ============================================================================
// Har endpoint ye same shape return karega - frontend ka kaam easy
// Stripe, GitHub, Linear APIs ye discriminated union pattern use karte hai
// ============================================================================

// ===== Success response =====
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  requestId?: string;
}

// ===== Error response =====
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
  timestamp?: string;
}

// ===== Discriminated union - TS narrows automatically on `success` field =====
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ===== Pagination metadata =====
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ===== Helper builders =====
// Controllers me use karte hai - shape consistent rahe
export const ApiResponseBuilder = {
  success<T>(data: T, meta?: PaginationMeta): ApiSuccessResponse<T> {
    return { success: true, data, ...(meta && { meta }) };
  },

  error(code: string, message: string, details?: unknown): ApiErrorResponse {
    return {
      success: false,
      error: { code, message, ...(details !== undefined && { details }) },
      timestamp: new Date().toISOString(),
    };
  },

  paginated<T>(items: T[], page: number, limit: number, total: number): ApiSuccessResponse<T[]> {
    const totalPages = Math.ceil(total / limit);
    return {
      success: true,
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  },
};
