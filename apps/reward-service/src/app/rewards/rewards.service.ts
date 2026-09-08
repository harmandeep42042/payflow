import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@payflow/database';

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}
  getHealth() {
    return { success: true, service: 'reward-service', status: 'ok', timestamp: new Date().toISOString() };
  }

  async getUserRewards(userId: string) {
    if (!userId) throw new BadRequestException('userId is required');
    const rewards = await this.prisma.reward.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { success: true, count: rewards.length, rewards };
  }

  async generateScratchCard(userId: string, walletId: string, paymentId?: string) {
    if (!userId || !walletId) throw new BadRequestException('userId and walletId are required');
    const wallet = await this.prisma.wallet.findFirst({ where: { id: walletId, userId } });
    if (!wallet) throw new NotFoundException('Wallet not found for user');
    if (paymentId) {
      const existingReward = await this.prisma.reward.findUnique({ where: { paymentId } });
      if (existingReward) return { success: true, created: false, reward: existingReward };
    }
    const amount = Math.floor(Math.random() * 20) + 1;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    try {
      const reward = await this.prisma.reward.create({ data: { userId, walletId, paymentId: paymentId || null, rewardType: 'SCRATCH_CARD', amount, currency: 'INR', status: 'AVAILABLE', expiresAt } });
      return { success: true, created: true, reward };
    } catch (error) {
      if (!paymentId || !this.isPaymentIdUniqueConflict(error)) throw error;
      const existingReward = await this.prisma.reward.findUnique({ where: { paymentId } });
      if (!existingReward) throw error;
      return { success: true, created: false, reward: existingReward };
    }
  }

  async completeRewardedAd(
    userId: string,
    adSessionId: string,
    adUnit?: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    if (!adSessionId || !/^[A-Za-z0-9_-]{16,128}$/.test(adSessionId)) {
      throw new BadRequestException('Valid adSessionId is required');
    }

    const wallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!wallet) {
      throw new NotFoundException('Active wallet not found');
    }

    const idempotencyKey = `AD-${userId}-${adSessionId}`;

    const existing = await this.prisma.reward.findUnique({
      where: {
        paymentId: idempotencyKey,
      },
    });

    if (existing) {
      return {
        success: true,
        created: false,
        duplicate: true,
        reward: existing,
      };
    }

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const tomorrow = new Date(dayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = await this.prisma.reward.count({
      where: {
        userId,
        rewardType: 'REWARDED_AD',
        createdAt: {
          gte: dayStart,
          lt: tomorrow,
        },
      },
    });

    if (todayCount >= 5) {
      throw new BadRequestException(
        'Daily rewarded-ad limit reached. Try again tomorrow.',
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    try {
      const reward = await this.prisma.reward.create({
        data: {
          userId,
          walletId: wallet.id,
          paymentId: idempotencyKey,
          rewardType: 'REWARDED_AD',
          amount: '1.00',
          currency: 'INR',
          status: 'AVAILABLE',
          expiresAt,
        },
      });

      return {
        success: true,
        created: true,
        duplicate: false,
        reward: {
          id: reward.id,
          amount: reward.amount.toString(),
          currency: reward.currency,
          rewardType: reward.rewardType,
          status: reward.status,
          expiresAt: reward.expiresAt,
          adUnit: adUnit ?? null,
        },
      };
    } catch (error) {
      if (!this.isPaymentIdUniqueConflict(error)) {
        throw error;
      }

      const existingReward = await this.prisma.reward.findUnique({
        where: {
          paymentId: idempotencyKey,
        },
      });

      if (!existingReward) {
        throw error;
      }

      return {
        success: true,
        created: false,
        duplicate: true,
        reward: existingReward,
      };
    }
  }
  async claimReward(rewardId: string, userId: string) {
    if (!rewardId || !userId) throw new BadRequestException('rewardId and userId are required');
    const reward = await this.prisma.reward.findFirst({ where: { id: rewardId, userId } });
    if (!reward) throw new NotFoundException('Reward not found');
    if (reward.status === 'CLAIMED') throw new ConflictException('Reward already claimed');
    if (reward.status !== 'AVAILABLE') throw new BadRequestException('Reward is not available');
    if (reward.expiresAt && reward.expiresAt < new Date()) throw new BadRequestException('Reward has expired');
    const wallet = await this.prisma.wallet.findUnique({ where: { id: reward.walletId }, include: { ledgerAccount: true } });
    if (!wallet || wallet.userId !== userId) throw new NotFoundException('Reward wallet not found');
    if (wallet.status !== 'ACTIVE') throw new BadRequestException('Wallet is not active');
    if (wallet.currency !== reward.currency) throw new BadRequestException('Reward and wallet currency do not match');
    if (!wallet.ledgerAccount) throw new NotFoundException('Customer ledger account not found');
    const customerLedgerAccountId = wallet.ledgerAccount.id;
    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.reward.updateMany({ where: { id: reward.id, userId, status: 'AVAILABLE' }, data: { status: 'CLAIMED', claimedAt: new Date() } });
      if (claim.count !== 1) throw new ConflictException('Reward already claimed or unavailable');
      const systemLedgerAccount = await tx.ledgerAccount.upsert({ where: { code: 'SYSTEM-REWARD-INR' }, update: {}, create: { code: 'SYSTEM-REWARD-INR', name: 'INR Reward Cashback Account', type: 'SYSTEM', currency: reward.currency, status: 'ACTIVE' } });
      const deposit = await tx.deposit.create({ data: { idempotencyKey: 'REWARD-' + reward.id, walletId: wallet.id, amount: reward.amount, currency: reward.currency, reference: 'Reward cashback ' + reward.id, status: 'PROCESSING' } });
      const walletUpdate = await tx.wallet.updateMany({ where: { id: wallet.id, version: wallet.version, status: 'ACTIVE' }, data: { balance: { increment: reward.amount }, version: { increment: 1 } } });
      if (walletUpdate.count !== 1) throw new ConflictException('Wallet was updated by another transaction. Please retry.');
      const systemDebitEntry = await tx.ledgerEntry.create({ data: { depositId: deposit.id, ledgerAccountId: systemLedgerAccount.id, entryType: 'DEBIT', amount: reward.amount, currency: reward.currency } });
      const customerCreditEntry = await tx.ledgerEntry.create({ data: { depositId: deposit.id, ledgerAccountId: customerLedgerAccountId, entryType: 'CREDIT', amount: reward.amount, currency: reward.currency } });
      const completedDeposit = await tx.deposit.update({ where: { id: deposit.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
      const updatedWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });
      if (!updatedWallet) throw new NotFoundException('Updated wallet not found');
      return { completedDeposit, updatedWallet, systemDebitEntry, customerCreditEntry };
    });
    return { success: true, rewardId: reward.id, amount: reward.amount.toString(), currency: reward.currency, status: 'CLAIMED', claimedAt: new Date(), wallet: { id: result.updatedWallet.id, balance: result.updatedWallet.balance.toString(), version: result.updatedWallet.version }, depositId: result.completedDeposit.id, ledgerEntries: { debitId: result.systemDebitEntry.id, creditId: result.customerCreditEntry.id } };
  }

  private isPaymentIdUniqueConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') return false;
    if (!('meta' in error) || !error.meta || typeof error.meta !== 'object' || !('target' in error.meta)) return false;
    const target = error.meta.target;
    if (Array.isArray(target)) return target.includes('paymentId');
    return typeof target === 'string' && target.includes('paymentId');
  }
}
