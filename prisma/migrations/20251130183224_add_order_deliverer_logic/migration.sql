-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('FOOD', 'GROCERY', 'VEGETABLE', 'EMPTY');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING_VENDOR_CONFIRMATION', 'READY_FOR_DELIVERY', 'WAITING_FOR_DELIVERER', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."DelivererProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "availability" BOOLEAN NOT NULL DEFAULT true,
    "activeJobId" INTEGER,

    CONSTRAINT "DelivererProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "status" "public"."OrderStatus" NOT NULL,
    "orderType" "public"."OrderType" NOT NULL,
    "prepTimeMin" INTEGER,
    "readyAt" TIMESTAMP(3),
    "deliveryFee" INTEGER,
    "delivererId" INTEGER,
    "deliveryJobId" INTEGER,
    "deliveryBatchId" INTEGER,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryJob" (
    "id" SERIAL NOT NULL,
    "delivererId" INTEGER NOT NULL,
    "status" "public"."JobStatus" NOT NULL,
    "route" JSONB,

    CONSTRAINT "DeliveryJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryBatch" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "delivererId" INTEGER,
    "status" "public"."JobStatus" NOT NULL,
    "batchFee" INTEGER,
    "distanceKm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DelivererProfile_userId_key" ON "public"."DelivererProfile"("userId");

-- CreateIndex
CREATE INDEX "Product_vendorId_idx" ON "public"."Product"("vendorId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "public"."Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_isAvailable_idx" ON "public"."Product"("isAvailable");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "public"."ProductImage"("productId");

-- CreateIndex
CREATE INDEX "VendorProfile_isActive_isVerified_idx" ON "public"."VendorProfile"("isActive", "isVerified");

-- AddForeignKey
ALTER TABLE "public"."DelivererProfile" ADD CONSTRAINT "DelivererProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."VendorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_delivererId_fkey" FOREIGN KEY ("delivererId") REFERENCES "public"."DelivererProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_deliveryJobId_fkey" FOREIGN KEY ("deliveryJobId") REFERENCES "public"."DeliveryJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_deliveryBatchId_fkey" FOREIGN KEY ("deliveryBatchId") REFERENCES "public"."DeliveryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryJob" ADD CONSTRAINT "DeliveryJob_delivererId_fkey" FOREIGN KEY ("delivererId") REFERENCES "public"."DelivererProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_delivererId_fkey" FOREIGN KEY ("delivererId") REFERENCES "public"."DelivererProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
