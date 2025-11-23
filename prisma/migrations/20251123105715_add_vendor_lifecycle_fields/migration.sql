-- AlterTable
ALTER TABLE "public"."VendorProfile" ADD COLUMN     "demotionReason" TEXT,
ADD COLUMN     "reactivatedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedAt" TIMESTAMP(3);
