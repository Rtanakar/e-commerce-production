// ============================================================================
// /seller/products/new — create product page
// ============================================================================

import { ErrorBoundary } from "react-error-boundary";
import {
  CreateProductContainer,
  CreateProductContent,
  CreateProductError,
} from "@/features/products/views/create-product-view";

export const metadata = { title: "Create product" };

export default function NewProductPage() {
  return (
    <CreateProductContainer>
      <ErrorBoundary fallback={<CreateProductError />}>
        <CreateProductContent />
      </ErrorBoundary>
    </CreateProductContainer>
  );
}
