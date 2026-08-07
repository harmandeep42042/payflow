-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'PREVIEW');

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "eventType" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_eventId_key" ON "NotificationLog"("eventId");

-- CreateIndex
CREATE INDEX "NotificationLog_status_createdAt_idx" ON "NotificationLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_recipient_idx" ON "NotificationLog"("recipient");

-- CreateIndex
CREATE INDEX "NotificationLog_eventType_idx" ON "NotificationLog"("eventType");
