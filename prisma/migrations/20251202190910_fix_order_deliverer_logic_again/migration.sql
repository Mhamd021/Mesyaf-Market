/*
  Warnings:

  - You are about to drop the column `createdByAdminId` on the `DeliveryBatch` table. All the data in the column will be lost.
  - You are about to drop the column `distanceKm` on the `DeliveryBatch` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedReadyAt` on the `DeliveryBatch` table. All the data in the column will be lost.
  - You are about to drop the column `groupOfferApplied` on the `DeliveryBatch` table. All the data in the column will be lost.
  - You are about to drop the column `route` on the `DeliveryJob` table. All the data in the column will be lost.
  - You are about to drop the column `prepTimeMin` on the `Order` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[activeJobId]` on the table `DelivererProfile` will be added. If there are existing duplicate values, this will fail.
  - Made the column `maxConcurrentOrders` on table `DelivererProfile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `maxStops` on table `DelivererProfile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `delivererId` on table `DeliveryBatch` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `price` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."DeliveryBatch" DROP CONSTRAINT "DeliveryBatch_delivererId_fkey";

-- AlterTable
ALTER TABLE "public"."DelivererProfile" ALTER COLUMN "maxConcurrentOrders" SET NOT NULL,
ALTER COLUMN "maxConcurrentOrders" SET DEFAULT 3,
ALTER COLUMN "maxStops" SET NOT NULL,
ALTER COLUMN "maxStops" SET DEFAULT 5;

-- AlterTable
ALTER TABLE "public"."DeliveryBatch" DROP COLUMN "createdByAdminId",
DROP COLUMN "distanceKm",
DROP COLUMN "estimatedReadyAt",
DROP COLUMN "groupOfferApplied",
ADD COLUMN     "totalDistanceKm" DOUBLE PRECISION,
ALTER COLUMN "delivererId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."DeliveryJob" DROP COLUMN "route",
ADD COLUMN     "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "routeJson" JSONB,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "totalDistanceKm" DOUBLE PRECISION,
ADD COLUMN     "totalOrders" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "prepTimeMin",
ADD COLUMN     "distanceKm" DOUBLE PRECISION,
ADD COLUMN     "estimatedPrepTime" INTEGER;

-- AlterTable
ALTER TABLE "public"."OrderItem" ADD COLUMN     "price" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "quantity" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."DeliveryDropOff" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'PENDING',
    "dropoffLat" DOUBLE PRECISION,
    "dropoffLng" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DeliveryDropOff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DelivererProfile_activeJobId_key" ON "public"."DelivererProfile"("activeJobId");

-- CreateIndex
CREATE INDEX "DelivererProfile_availability_idx" ON "public"."DelivererProfile"("availability");

-- CreateIndex
CREATE INDEX "DelivererProfile_availability_currentLat_currentLng_idx" ON "public"."DelivererProfile"("availability", "currentLat", "currentLng");

-- CreateIndex
CREATE INDEX "DeliveryBatch_status_idx" ON "public"."DeliveryBatch"("status");

-- CreateIndex
CREATE INDEX "DeliveryJob_delivererId_idx" ON "public"."DeliveryJob"("delivererId");

-- CreateIndex
CREATE INDEX "DeliveryJob_status_idx" ON "public"."DeliveryJob"("status");

-- CreateIndex
CREATE INDEX "Order_delivererId_idx" ON "public"."Order"("delivererId");

-- CreateIndex
CREATE INDEX "Order_deliveryJobId_idx" ON "public"."Order"("deliveryJobId");

-- AddForeignKey
ALTER TABLE "public"."DelivererProfile" ADD CONSTRAINT "DelivererProfile_activeJobId_fkey" FOREIGN KEY ("activeJobId") REFERENCES "public"."DeliveryJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryDropOff" ADD CONSTRAINT "DeliveryDropOff_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."DeliveryJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryDropOff" ADD CONSTRAINT "DeliveryDropOff_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_delivererId_fkey" FOREIGN KEY ("delivererId") REFERENCES "public"."DelivererProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
