// ============================================================================
// use-categories.ts — Category tree (for category + subcategory dropdowns)
// ============================================================================

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIME } from "@/config/constants";
import { categoryKeys } from "../api/product-keys";
import { fetchCategoryTree, createCategory } from "../api/products-api";

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.tree(),
    queryFn: fetchCategoryTree,
    staleTime: STALE_TIME.STATIC, // categories rarely change
  });
}

// create category/subcategory → tree invalidate (dropdown refresh)
export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}
