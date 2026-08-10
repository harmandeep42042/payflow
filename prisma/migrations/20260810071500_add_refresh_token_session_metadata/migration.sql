-- AlterTable
ALTER TABLE "RefreshToken"
ADD COLUMN "deviceName" TEXT,
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "ipAddress" TEXT,
ADD COLUMN "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "RefreshToken_lastUsedAt_idx"
ON "RefreshToken"("lastUsedAt");
