/*
  Warnings:

  - A unique constraint covering the columns `[batchId]` on the table `DeliveryJob` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."DeliveryJob" ADD COLUMN     "batchId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryJob_batchId_key" ON "public"."DeliveryJob"("batchId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "public"."OrderItem"("orderId");
