CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED');
CREATE TYPE "OfferClaimStatus" AS ENUM ('CLAIMED', 'REDEEMED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "MoneyRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "BillSplitType" AS ENUM ('EQUAL', 'EXACT');
CREATE TYPE "BillSplitStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'EXPIRED');
CREATE TYPE "SplitAllocationStatus" AS ENUM ('PENDING', 'PAID', 'DECLINED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "ProviderAttemptStatus" AS ENUM ('PROVIDER_NOT_CONFIGURED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "MandateStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'FAILED');
CREATE TYPE "MandateFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE "SupportCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED');
CREATE TYPE "SupportCasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "Offer" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL,
  "merchant" TEXT NOT NULL, "category" TEXT NOT NULL, "currency" VARCHAR(3) NOT NULL,
  "benefitDescription" TEXT NOT NULL, "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "eligibilityRules" JSONB, "usageLimit" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OfferClaim" (
  "id" TEXT NOT NULL, "offerId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "status" "OfferClaimStatus" NOT NULL DEFAULT 'CLAIMED', "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "redeemedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OfferClaim_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Contact" (
  "id" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "recipientUserId" TEXT NOT NULL,
  "nickname" TEXT, "favourite" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MoneyRequest" (
  "id" TEXT NOT NULL, "requesterUserId" TEXT NOT NULL, "payerUserId" TEXT NOT NULL, "walletId" TEXT NOT NULL,
  "currency" VARCHAR(3) NOT NULL, "amount" DECIMAL(18,2) NOT NULL, "note" TEXT,
  "status" "MoneyRequestStatus" NOT NULL DEFAULT 'PENDING', "expiresAt" TIMESTAMP(3) NOT NULL,
  "settlementTransferId" TEXT, "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MoneyRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BillSplit" (
  "id" TEXT NOT NULL, "creatorUserId" TEXT NOT NULL, "walletId" TEXT NOT NULL, "currency" VARCHAR(3) NOT NULL,
  "totalAmount" DECIMAL(18,2) NOT NULL, "type" "BillSplitType" NOT NULL,
  "status" "BillSplitStatus" NOT NULL DEFAULT 'OPEN', "note" TEXT, "dueAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BillSplit_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SplitAllocation" (
  "id" TEXT NOT NULL, "splitId" TEXT NOT NULL, "participantUserId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL, "status" "SplitAllocationStatus" NOT NULL DEFAULT 'PENDING',
  "settlementTransferId" TEXT, "paidAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SplitAllocation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RechargeAttempt" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "operator" TEXT NOT NULL, "mobileNumber" TEXT NOT NULL,
  "planId" TEXT, "amount" DECIMAL(18,2) NOT NULL, "currency" VARCHAR(3) NOT NULL,
  "status" "ProviderAttemptStatus" NOT NULL DEFAULT 'PROVIDER_NOT_CONFIGURED', "providerRef" TEXT,
  "idempotencyKey" TEXT NOT NULL, "failureCode" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "RechargeAttempt_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BillPaymentAttempt" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "category" TEXT NOT NULL, "billerId" TEXT,
  "customerRef" TEXT NOT NULL, "amount" DECIMAL(18,2) NOT NULL, "currency" VARCHAR(3) NOT NULL,
  "status" "ProviderAttemptStatus" NOT NULL DEFAULT 'PROVIDER_NOT_CONFIGURED', "providerRef" TEXT,
  "idempotencyKey" TEXT NOT NULL, "failureCode" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BillPaymentAttempt_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Mandate" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "merchant" TEXT NOT NULL, "amount" DECIMAL(18,2),
  "maxAmount" DECIMAL(18,2) NOT NULL, "currency" VARCHAR(3) NOT NULL, "frequency" "MandateFrequency" NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL, "endAt" TIMESTAMP(3), "status" "MandateStatus" NOT NULL DEFAULT 'PENDING',
  "providerMandateId" TEXT, "consentAt" TIMESTAMP(3) NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Mandate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SupportCase" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "transactionId" TEXT, "category" TEXT NOT NULL,
  "description" TEXT NOT NULL, "status" "SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportCasePriority" NOT NULL DEFAULT 'NORMAL', "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3), CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SupportCaseEvent" (
  "id" TEXT NOT NULL, "caseId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "fromStatus" "SupportCaseStatus", "toStatus" "SupportCaseStatus" NOT NULL, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SupportCaseEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Offer_status_startsAt_expiresAt_idx" ON "Offer"("status", "startsAt", "expiresAt");
CREATE INDEX "Offer_category_idx" ON "Offer"("category");
CREATE UNIQUE INDEX "OfferClaim_offerId_userId_key" ON "OfferClaim"("offerId", "userId");
CREATE INDEX "OfferClaim_userId_status_idx" ON "OfferClaim"("userId", "status");
CREATE INDEX "OfferClaim_expiresAt_idx" ON "OfferClaim"("expiresAt");
CREATE UNIQUE INDEX "Contact_ownerUserId_recipientUserId_key" ON "Contact"("ownerUserId", "recipientUserId");
CREATE INDEX "Contact_ownerUserId_favourite_idx" ON "Contact"("ownerUserId", "favourite");
CREATE UNIQUE INDEX "MoneyRequest_settlementTransferId_key" ON "MoneyRequest"("settlementTransferId");
CREATE UNIQUE INDEX "MoneyRequest_idempotencyKey_key" ON "MoneyRequest"("idempotencyKey");
CREATE INDEX "MoneyRequest_requesterUserId_status_createdAt_idx" ON "MoneyRequest"("requesterUserId", "status", "createdAt");
CREATE INDEX "MoneyRequest_payerUserId_status_createdAt_idx" ON "MoneyRequest"("payerUserId", "status", "createdAt");
CREATE INDEX "MoneyRequest_expiresAt_status_idx" ON "MoneyRequest"("expiresAt", "status");
CREATE UNIQUE INDEX "BillSplit_idempotencyKey_key" ON "BillSplit"("idempotencyKey");
CREATE INDEX "BillSplit_creatorUserId_status_createdAt_idx" ON "BillSplit"("creatorUserId", "status", "createdAt");
CREATE INDEX "BillSplit_dueAt_status_idx" ON "BillSplit"("dueAt", "status");
CREATE UNIQUE INDEX "SplitAllocation_settlementTransferId_key" ON "SplitAllocation"("settlementTransferId");
CREATE UNIQUE INDEX "SplitAllocation_splitId_participantUserId_key" ON "SplitAllocation"("splitId", "participantUserId");
CREATE INDEX "SplitAllocation_participantUserId_status_idx" ON "SplitAllocation"("participantUserId", "status");
CREATE UNIQUE INDEX "RechargeAttempt_idempotencyKey_key" ON "RechargeAttempt"("idempotencyKey");
CREATE INDEX "RechargeAttempt_userId_createdAt_idx" ON "RechargeAttempt"("userId", "createdAt");
CREATE INDEX "RechargeAttempt_status_idx" ON "RechargeAttempt"("status");
CREATE UNIQUE INDEX "BillPaymentAttempt_idempotencyKey_key" ON "BillPaymentAttempt"("idempotencyKey");
CREATE INDEX "BillPaymentAttempt_userId_createdAt_idx" ON "BillPaymentAttempt"("userId", "createdAt");
CREATE INDEX "BillPaymentAttempt_status_idx" ON "BillPaymentAttempt"("status");
CREATE UNIQUE INDEX "Mandate_providerMandateId_key" ON "Mandate"("providerMandateId");
CREATE UNIQUE INDEX "Mandate_idempotencyKey_key" ON "Mandate"("idempotencyKey");
CREATE INDEX "Mandate_userId_status_idx" ON "Mandate"("userId", "status");
CREATE INDEX "Mandate_status_startAt_idx" ON "Mandate"("status", "startAt");
CREATE INDEX "SupportCase_userId_status_createdAt_idx" ON "SupportCase"("userId", "status", "createdAt");
CREATE INDEX "SupportCase_status_priority_createdAt_idx" ON "SupportCase"("status", "priority", "createdAt");
CREATE INDEX "SupportCase_transactionId_idx" ON "SupportCase"("transactionId");
CREATE INDEX "SupportCaseEvent_caseId_createdAt_idx" ON "SupportCaseEvent"("caseId", "createdAt");
CREATE INDEX "SupportCaseEvent_actorUserId_idx" ON "SupportCaseEvent"("actorUserId");

ALTER TABLE "OfferClaim" ADD CONSTRAINT "OfferClaim_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfferClaim" ADD CONSTRAINT "OfferClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MoneyRequest" ADD CONSTRAINT "MoneyRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MoneyRequest" ADD CONSTRAINT "MoneyRequest_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MoneyRequest" ADD CONSTRAINT "MoneyRequest_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MoneyRequest" ADD CONSTRAINT "MoneyRequest_settlementTransferId_fkey" FOREIGN KEY ("settlementTransferId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillSplit" ADD CONSTRAINT "BillSplit_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillSplit" ADD CONSTRAINT "BillSplit_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SplitAllocation" ADD CONSTRAINT "SplitAllocation_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "BillSplit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SplitAllocation" ADD CONSTRAINT "SplitAllocation_participantUserId_fkey" FOREIGN KEY ("participantUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SplitAllocation" ADD CONSTRAINT "SplitAllocation_settlementTransferId_fkey" FOREIGN KEY ("settlementTransferId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RechargeAttempt" ADD CONSTRAINT "RechargeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillPaymentAttempt" ADD CONSTRAINT "BillPaymentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportCaseEvent" ADD CONSTRAINT "SupportCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
