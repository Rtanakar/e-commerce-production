-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductStatus" ADD VALUE 'PENDING';
ALTER TYPE "ProductStatus" ADD VALUE 'DELETED';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "purgeAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "products_purgeAt_idx" ON "products"("purgeAt");
