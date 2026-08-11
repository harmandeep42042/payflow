-- CreateTable
CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "transfersEnabled" BOOLEAN NOT NULL DEFAULT true,
  "depositsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "withdrawalsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "paymentsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'IN_APP',
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key"
ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx"
ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx"
ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_email_idx"
ON "Notification"("email");

-- CreateIndex
CREATE INDEX "Notification_type_idx"
ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_status_idx"
ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx"
ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx"
ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "NotificationPreference"
ADD CONSTRAINT "NotificationPreference_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;