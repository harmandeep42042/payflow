-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MOCK', 'RAZORPAY', 'STRIPE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM (
  'CREATED',
  'PENDING',
  'AUTHORIZED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);

-- CreateTable
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'MOCK',
  "providerOrderId" TEXT,
  "providerPaymentId" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "amountInPaise" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "description" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "failureReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "authorizedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),

  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerOrderId_key"
ON "Payment"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key"
ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key"
ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx"
ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_walletId_createdAt_idx"
ON "Payment"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx"
ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_provider_providerOrderId_idx"
ON "Payment"("provider", "providerOrderId");
