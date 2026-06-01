// ============================================================================
// /seller/products/[id]/edit — edit product page
// ============================================================================
// Next 16: params is a Promise — await it.
// ============================================================================

import { ErrorBoundary } from "react-error-boundary";
import {
  EditProductContainer,
  EditProductContent,
  EditProductError,
} from "@/features/products/views/edit-product-view";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <EditProductContainer>
      <ErrorBoundary fallback={<EditProductError />}>
        <EditProductContent id={id} />
      </ErrorBoundary>
    </EditProductContainer>
  );
}
