-- DropForeignKey
ALTER TABLE "public"."DeliveryBatch" DROP CONSTRAINT "DeliveryBatch_delivererId_fkey";

-- AlterTable
ALTER TABLE "public"."DeliveryBatch" ALTER COLUMN "delivererId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_delivererId_fkey" FOREIGN KEY ("delivererId") REFERENCES "public"."DelivererProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
