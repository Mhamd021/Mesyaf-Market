-- DropForeignKey
ALTER TABLE "public"."DeliveryJob" DROP CONSTRAINT "DeliveryJob_delivererId_fkey";

-- AlterTable
ALTER TABLE "public"."DeliveryJob" ALTER COLUMN "delivererId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."DeliveryJob" ADD CONSTRAINT "DeliveryJob_delivererId_fkey" FOREIGN KEY ("delivererId") REFERENCES "public"."DelivererProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
