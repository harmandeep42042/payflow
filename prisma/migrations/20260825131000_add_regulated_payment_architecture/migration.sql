CREATE TYPE "ExternalVerificationStatus" AS ENUM ('NOT_CONFIGURED','PENDING','VERIFIED','FAILED','LOCKED');
CREATE TYPE "UpiPaymentStatus" AS ENUM ('CREATED','PENDING','SUCCESS','FAILED','EXPIRED','REVERSED');
CREATE TYPE "UpiPaymentKind" AS ENUM ('PAY','COLLECT');
CREATE TYPE "PaymentAuthenticationStatus" AS ENUM ('PROVIDER_BLOCKED','NOT_CONFIGURED','PENDING','VERIFIED','FAILED','LOCKED');
CREATE TYPE "MerchantOnboardingStatus" AS ENUM ('DRAFT','PENDING_VERIFICATION','ACTIVE','SUSPENDED','REJECTED');
CREATE TYPE "MerchantPaymentStatus" AS ENUM ('CREATED','PENDING','SUCCEEDED','FAILED','REFUNDED','PARTIALLY_REFUNDED','REVERSED');
CREATE TYPE "RefundStatus" AS ENUM ('PROVIDER_NOT_CONFIGURED','PENDING','SUCCEEDED','FAILED','CANCELLED');
CREATE TYPE "PaymentMethodType" AS ENUM ('BANK_ACCOUNT','CARD_TOKEN','RUPAY_TOKEN','UPI_VPA');
CREATE TYPE "PaymentMethodStatus" AS ENUM ('NOT_CONFIGURED','PENDING','ACTIVE','INACTIVE','REMOVED','FAILED');
CREATE TYPE "TransactionCategory" AS ENUM ('FOOD','SHOPPING','TRAVEL','BILLS','RECHARGE','TRANSFER','RENT','ENTERTAINMENT','OTHER');
CREATE TYPE "RecurringPaymentStatus" AS ENUM ('DRAFT','PROVIDER_BLOCKED','ACTIVE','PAUSED','CANCELLED','COMPLETED','FAILED');
CREATE TYPE "RecurringPaymentFrequency" AS ENUM ('DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY');

CREATE TABLE "BankAccount" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "bankName" TEXT NOT NULL,
  "accountHolderName" TEXT NOT NULL, "maskedAccountNumber" TEXT NOT NULL,
  "accountFingerprint" TEXT NOT NULL, "ifsc" TEXT NOT NULL,
  "status" "ExternalVerificationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false, "providerReference" TEXT,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "unlinkedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BankAccount_userId_accountFingerprint_key" ON "BankAccount"("userId","accountFingerprint");
CREATE INDEX "BankAccount_userId_status_idx" ON "BankAccount"("userId","status");

CREATE TABLE "PaymentMethod" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "type" "PaymentMethodType" NOT NULL,
  "label" TEXT NOT NULL, "maskedIdentifier" TEXT NOT NULL, "providerTokenRef" TEXT,
  "cardBrand" TEXT, "expiryMonth" INTEGER, "expiryYear" INTEGER,
  "status" "PaymentMethodStatus" NOT NULL DEFAULT 'NOT_CONFIGURED', "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "removedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PaymentMethod_userId_status_idx" ON "PaymentMethod"("userId","status");
CREATE INDEX "PaymentMethod_providerTokenRef_idx" ON "PaymentMethod"("providerTokenRef");

CREATE TABLE "UpiPaymentIntent" (
  "id" TEXT PRIMARY KEY, "senderUserId" TEXT NOT NULL, "receiverUserId" TEXT,
  "senderVpa" TEXT NOT NULL, "receiverVpa" TEXT NOT NULL, "kind" "UpiPaymentKind" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL, "currency" VARCHAR(3) NOT NULL, "note" TEXT,
  "status" "UpiPaymentStatus" NOT NULL DEFAULT 'CREATED',
  "providerState" "ExternalVerificationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "providerReference" TEXT, "transactionReference" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "completedAt" TIMESTAMP(3),
  CONSTRAINT "UpiPaymentIntent_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "UpiPaymentIntent_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UpiPaymentIntent_transactionReference_key" ON "UpiPaymentIntent"("transactionReference");
CREATE UNIQUE INDEX "UpiPaymentIntent_idempotencyKey_key" ON "UpiPaymentIntent"("idempotencyKey");
CREATE INDEX "UpiPaymentIntent_senderUserId_status_createdAt_idx" ON "UpiPaymentIntent"("senderUserId","status","createdAt");
CREATE INDEX "UpiPaymentIntent_receiverUserId_status_createdAt_idx" ON "UpiPaymentIntent"("receiverUserId","status","createdAt");
CREATE INDEX "UpiPaymentIntent_expiresAt_status_idx" ON "UpiPaymentIntent"("expiresAt","status");

CREATE TABLE "UpiTransactionAudit" (
  "id" TEXT PRIMARY KEY, "upiPaymentId" TEXT NOT NULL, "fromStatus" "UpiPaymentStatus",
  "toStatus" "UpiPaymentStatus" NOT NULL, "actorUserId" TEXT, "reasonCode" TEXT, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UpiTransactionAudit_upiPaymentId_fkey" FOREIGN KEY ("upiPaymentId") REFERENCES "UpiPaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UpiTransactionAudit_upiPaymentId_createdAt_idx" ON "UpiTransactionAudit"("upiPaymentId","createdAt");

CREATE TABLE "PaymentAuthProfile" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL,
  "status" "PaymentAuthenticationStatus" NOT NULL DEFAULT 'PROVIDER_BLOCKED',
  "failedAttemptCount" INTEGER NOT NULL DEFAULT 0, "lockedUntil" TIMESTAMP(3), "providerReference" TEXT,
  "credentialHash" TEXT, "credentialChangedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentAuthProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentAuthProfile_userId_key" ON "PaymentAuthProfile"("userId");

CREATE TABLE "PaymentAuthAttempt" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "operation" TEXT NOT NULL,
  "status" "PaymentAuthenticationStatus" NOT NULL, "reasonCode" TEXT,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAuthAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PaymentAuthAttempt_userId_attemptedAt_idx" ON "PaymentAuthAttempt"("userId","attemptedAt");

CREATE TABLE "Merchant" (
  "id" TEXT PRIMARY KEY, "displayName" TEXT NOT NULL, "legalName" TEXT, "category" TEXT NOT NULL,
  "merchantVpa" TEXT NOT NULL, "qrIdentity" TEXT NOT NULL,
  "onboardingStatus" "MerchantOnboardingStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "providerState" "ExternalVerificationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "Merchant_merchantVpa_key" ON "Merchant"("merchantVpa");
CREATE UNIQUE INDEX "Merchant_qrIdentity_key" ON "Merchant"("qrIdentity");
CREATE INDEX "Merchant_onboardingStatus_category_idx" ON "Merchant"("onboardingStatus","category");

CREATE TABLE "MerchantPayment" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "merchantId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL, "currency" VARCHAR(3) NOT NULL,
  "status" "MerchantPaymentStatus" NOT NULL DEFAULT 'CREATED',
  "providerState" "ExternalVerificationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "providerReference" TEXT, "transactionReference" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "receiptNumber" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "completedAt" TIMESTAMP(3),
  CONSTRAINT "MerchantPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MerchantPayment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MerchantPayment_transactionReference_key" ON "MerchantPayment"("transactionReference");
CREATE UNIQUE INDEX "MerchantPayment_idempotencyKey_key" ON "MerchantPayment"("idempotencyKey");
CREATE UNIQUE INDEX "MerchantPayment_receiptNumber_key" ON "MerchantPayment"("receiptNumber");
CREATE INDEX "MerchantPayment_userId_createdAt_idx" ON "MerchantPayment"("userId","createdAt");
CREATE INDEX "MerchantPayment_merchantId_status_idx" ON "MerchantPayment"("merchantId","status");

CREATE TABLE "MerchantRefund" (
  "id" TEXT PRIMARY KEY, "merchantPaymentId" TEXT NOT NULL, "amount" DECIMAL(18,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL, "reason" TEXT,
  "status" "RefundStatus" NOT NULL DEFAULT 'PROVIDER_NOT_CONFIGURED', "providerReference" TEXT,
  "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantRefund_merchantPaymentId_fkey" FOREIGN KEY ("merchantPaymentId") REFERENCES "MerchantPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MerchantRefund_idempotencyKey_key" ON "MerchantRefund"("idempotencyKey");
CREATE INDEX "MerchantRefund_merchantPaymentId_status_idx" ON "MerchantRefund"("merchantPaymentId","status");

CREATE TABLE "TransactionClassification" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "transferId" TEXT NOT NULL,
  "category" "TransactionCategory" NOT NULL DEFAULT 'OTHER', "source" TEXT NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransactionClassification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TransactionClassification_userId_transferId_key" ON "TransactionClassification"("userId","transferId");
CREATE INDEX "TransactionClassification_userId_category_idx" ON "TransactionClassification"("userId","category");

CREATE TABLE "PaymentTemplate" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "destinationRef" TEXT NOT NULL,
  "maskedDestination" TEXT NOT NULL, "amount" DECIMAL(18,2), "currency" VARCHAR(3) NOT NULL, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PaymentTemplate_userId_updatedAt_idx" ON "PaymentTemplate"("userId","updatedAt");

CREATE TABLE "RecurringPaymentSchedule" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "templateId" TEXT NOT NULL,
  "frequency" "RecurringPaymentFrequency" NOT NULL, "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3), "nextRunAt" TIMESTAMP(3) NOT NULL,
  "status" "RecurringPaymentStatus" NOT NULL DEFAULT 'PROVIDER_BLOCKED', "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringPaymentSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RecurringPaymentSchedule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PaymentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RecurringPaymentSchedule_idempotencyKey_key" ON "RecurringPaymentSchedule"("idempotencyKey");
CREATE INDEX "RecurringPaymentSchedule_userId_status_idx" ON "RecurringPaymentSchedule"("userId","status");
CREATE INDEX "RecurringPaymentSchedule_status_nextRunAt_idx" ON "RecurringPaymentSchedule"("status","nextRunAt");

CREATE TABLE "RecurringPaymentExecution" (
  "id" TEXT PRIMARY KEY, "scheduleId" TEXT NOT NULL, "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "RecurringPaymentStatus" NOT NULL DEFAULT 'PROVIDER_BLOCKED', "idempotencyKey" TEXT NOT NULL,
  "failureCode" TEXT, "transferId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringPaymentExecution_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RecurringPaymentSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RecurringPaymentExecution_idempotencyKey_key" ON "RecurringPaymentExecution"("idempotencyKey");
CREATE INDEX "RecurringPaymentExecution_scheduleId_scheduledFor_idx" ON "RecurringPaymentExecution"("scheduleId","scheduledFor");
