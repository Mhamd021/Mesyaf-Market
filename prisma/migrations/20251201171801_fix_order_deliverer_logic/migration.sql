/*
  Warnings:

  - You are about to drop the column `customerId` on the `DeliveryBatch` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "public"."OrderStatus" ADD VALUE 'CANCELLED';

-- DropForeignKey
ALTER TABLE "public"."DeliveryBatch" DROP CONSTRAINT "DeliveryBatch_customerId_fkey";

-- AlterTable
ALTER TABLE "public"."DelivererProfile" ADD COLUMN     "acceptsBatching" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxConcurrentOrders" INTEGER DEFAULT 2,
ADD COLUMN     "maxStops" INTEGER DEFAULT 4;

-- AlterTable
ALTER TABLE "public"."DeliveryBatch" DROP COLUMN "customerId",
ADD COLUMN     "batchDiscount" INTEGER,
ADD COLUMN     "createdByAdminId" INTEGER,
ADD COLUMN     "estimatedReadyAt" TIMESTAMP(3),
ADD COLUMN     "groupOfferApplied" BOOLEAN DEFAULT false,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "customerAddress" TEXT,
ADD COLUMN     "customerLat" DOUBLE PRECISION,
ADD COLUMN     "customerLng" DOUBLE PRECISION,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "pickedAt" TIMESTAMP(3),
ADD COLUMN     "vendorAddress" TEXT,
ADD COLUMN     "vendorLat" DOUBLE PRECISION,
ADD COLUMN     "vendorLng" DOUBLE PRECISION,
ALTER COLUMN "status" SET DEFAULT 'PENDING_VENDOR_CONFIRMATION',
ALTER COLUMN "orderType" SET DEFAULT 'EMPTY';

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "isInstant" BOOLEAN,
ADD COLUMN     "prepTimeMin" INTEGER;

-- CreateIndex
CREATE INDEX "DeliveryBatch_delivererId_idx" ON "public"."DeliveryBatch"("delivererId");

-- CreateIndex
CREATE INDEX "Order_vendorId_idx" ON "public"."Order"("vendorId");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "public"."Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "public"."Order"("status");

-- CreateIndex
CREATE INDEX "Order_deliveryBatchId_idx" ON "public"."Order"("deliveryBatchId");
