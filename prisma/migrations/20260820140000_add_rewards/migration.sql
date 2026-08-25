-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('CASHBACK', 'SCRATCH_CARD', 'POINTS');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('AVAILABLE', 'CLAIMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rewardType" "RewardType" NOT NULL DEFAULT 'SCRATCH_CARD',
    "minPaymentAmount" DECIMAL(18,2),
    "minRewardAmount" DECIMAL(18,2) NOT NULL DEFAULT 1,
    "maxRewardAmount" DECIMAL(18,2) NOT NULL DEFAULT 20,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "paymentId" TEXT,
    "campaignId" TEXT,
    "rewardType" "RewardType" NOT NULL DEFAULT 'SCRATCH_CARD',
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "status" "RewardStatus" NOT NULL DEFAULT 'AVAILABLE',
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_createdAt_idx" ON "PasswordResetToken"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RewardCampaign_active_idx" ON "RewardCampaign"("active");

-- CreateIndex
CREATE INDEX "RewardCampaign_startsAt_endsAt_idx" ON "RewardCampaign"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reward_paymentId_key" ON "Reward"("paymentId");

-- CreateIndex
CREATE INDEX "Reward_userId_createdAt_idx" ON "Reward"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Reward_walletId_idx" ON "Reward"("walletId");

-- CreateIndex
CREATE INDEX "Reward_status_idx" ON "Reward"("status");

-- CreateIndex
CREATE INDEX "Reward_campaignId_idx" ON "Reward"("campaignId");

-- CreateIndex
CREATE INDEX "Reward_expiresAt_idx" ON "Reward"("expiresAt");

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "RewardCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
