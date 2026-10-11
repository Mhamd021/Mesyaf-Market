/*
  Warnings:

  - A unique constraint covering the columns `[sourceEventId]` on the table `JobTimeline` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sourceEventId]` on the table `OrderTimeline` will be added. If there are existing duplicate values, this will fail.
  - Made the column `batchId` on table `DeliveryJob` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "DeliveryJob" ALTER COLUMN "batchId" SET NOT NULL;

-- AlterTable
ALTER TABLE "JobTimeline" ADD COLUMN     "sourceEventId" INTEGER;

-- AlterTable
ALTER TABLE "OrderTimeline" ADD COLUMN     "sourceEventId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "JobTimeline_sourceEventId_key" ON "JobTimeline"("sourceEventId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderTimeline_sourceEventId_key" ON "OrderTimeline"("sourceEventId");
