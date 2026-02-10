-- CreateTable
CREATE TABLE "public"."OrderTimeline" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "public"."OrderStatus",
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobTimeline" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderTimeline_orderId_idx" ON "public"."OrderTimeline"("orderId");

-- CreateIndex
CREATE INDEX "OrderTimeline_occurredAt_idx" ON "public"."OrderTimeline"("occurredAt");

-- CreateIndex
CREATE INDEX "JobTimeline_jobId_idx" ON "public"."JobTimeline"("jobId");

-- CreateIndex
CREATE INDEX "JobTimeline_occurredAt_idx" ON "public"."JobTimeline"("occurredAt");
