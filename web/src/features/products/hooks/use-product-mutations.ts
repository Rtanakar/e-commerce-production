// ============================================================================
// use-product-mutations.ts — create / update / archive / restore / delete
// ============================================================================
// Industry pattern (useCourses jaisa): mutations cache invalidate + toast khud
// karte hain → views ka onSubmit simple rehta (mutate + onSuccess redirect).
// DELETE intentionally NO toast — caller toast.promise wrap karta (single row).
// ============================================================================

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { STALE_TIME } from "@/config/constants";
import { ApiError } from "@/lib/api";
import { productKeys } from "../api/product-keys";
import {
  createProduct,
  updateProduct,
  archiveProduct,
  restoreProduct,
  deleteProduct,
  fetchSellerProduct,
} from "../api/products-api";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "../validators/product-validator";

const errMsg = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

// ─── Single product (edit form) ───
export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => fetchSellerProduct(id),
    staleTime: STALE_TIME.DETAIL,
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductInput) => createProduct(data),
    onSuccess: (_product, variables) => {
      qc.invalidateQueries({ queryKey: productKeys.sellerLists() });
      qc.invalidateQueries({ queryKey: productKeys.stats() });
      toast.success(
        variables.status === "ACTIVE" ? "Product published 🎉" : "Draft saved",
      );
    },
    onError: (err) => toast.error(errMsg(err, "Failed to save product")),
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProductInput) => updateProduct(id, data),
    onSuccess: (product) => {
      qc.invalidateQueries({ queryKey: productKeys.sellerLists() });
      qc.invalidateQueries({ queryKey: productKeys.stats() });
      qc.setQueryData(productKeys.detail(id), product);
      toast.success("Product updated");
    },
    onError: (err) => toast.error(errMsg(err, "Failed to update product")),
  });
}

export function useArchiveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: archiveProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.sellerLists() });
      qc.invalidateQueries({ queryKey: productKeys.stats() });
      toast.success("Product archived");
    },
    onError: (err) => toast.error(errMsg(err, "Failed to archive")),
  });
}

export function useRestoreProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restoreProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.sellerLists() });
      toast.success("Product restored to draft");
    },
    onError: (err) => toast.error(errMsg(err, "Failed to restore")),
  });
}

// DELETE — no toast here; caller wraps mutateAsync with toast.promise.
export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.sellerLists() });
      qc.invalidateQueries({ queryKey: productKeys.stats() });
    },
  });
}
