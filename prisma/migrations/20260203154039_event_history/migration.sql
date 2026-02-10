-- CreateEnum
CREATE TYPE "public"."EventEntityType" AS ENUM ('ORDER', 'JOB');

-- CreateTable
CREATE TABLE "public"."EventLog" (
    "id" SERIAL NOT NULL,
    "entityType" "public"."EventEntityType" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventLog_entityType_entityId_createdAt_idx" ON "public"."EventLog"("entityType", "entityId", "createdAt");
