import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '@payflow/database';
import { Decimal } from '@prisma/client/runtime/client';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class WalletTransferRiskService implements OnModuleDestroy {
  private readonly logger = new Logger(WalletTransferRiskService.name);

  private readonly burstMax = this.positiveInt(
    'WALLET_TRANSFER_BURST_MAX',
    5,
  );

  private readonly burstWindowSeconds = this.positiveInt(
    'WALLET_TRANSFER_BURST_WINDOW_SECONDS',
    300,
  );

  private readonly hourlyMax = this.positiveInt(
    'WALLET_TRANSFER_HOURLY_MAX',
    20,
  );

  private readonly dailyMax = this.positiveInt(
    'WALLET_TRANSFER_DAILY_MAX',
    100,
  );

  private readonly dailyAmountMax = this.positiveDecimal(
    'WALLET_TRANSFER_DAILY_AMOUNT_MAX',
    '100000',
  );

  private client: RedisClientType | null = null;
  private connectPromise: Promise<RedisClientType> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private positiveInt(name: string, fallback: number): number {
    const raw = process.env[name];

    if (raw === undefined || raw.trim() === '') {
      return fallback;
    }

    const value = raw.trim();

    if (!/^[1-9]\d*$/.test(value)) {
      throw new ServiceUnavailableException(
        'Wallet transfer risk configuration is invalid',
      );
    }

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new ServiceUnavailableException(
        'Wallet transfer risk configuration is invalid',
      );
    }

    return parsed;
  }

  private positiveDecimal(name: string, fallback: string): Decimal {
    const raw = process.env[name]?.trim() || fallback;

    try {
      const value = new Decimal(raw);

      if (!value.isFinite() || !value.gt(0)) {
        throw new Error('invalid');
      }

      return value;
    } catch {
      throw new ServiceUnavailableException(
        'Wallet transfer risk configuration is invalid',
      );
    }
  }

  private async getClient(): Promise<RedisClientType> {
    if (this.client?.isReady) {
      return this.client;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new ServiceUnavailableException(
        'Wallet transfer abuse protection is unavailable',
      );
    }

    const client = createClient({ url: redisUrl });

    client.on('error', (error: Error) => {
      this.logger.error(
        'Wallet transfer Redis error: ' + error.message,
      );
    });

    this.connectPromise = (async () => {
      try {
        await client.connect();
        this.client = client;
        return client;
      } catch (error) {
        if (client.isOpen) {
          await client.disconnect();
        }

        throw error;
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  private async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<number> {
    const client = await this.getClient();

    const result = await client.eval(
      [
        "local current = redis.call('INCR', KEYS[1])",
        'if current == 1 then',
        "  redis.call('EXPIRE', KEYS[1], ARGV[1])",
        'end',
        "local ttl = redis.call('TTL', KEYS[1])",
        'return { current, ttl }',
      ].join('\n'),
      {
        keys: [key],
        arguments: [String(windowSeconds)],
      },
    );

    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error('Invalid Redis velocity response');
    }

    const count = Number(result[0]);
    const ttl = Number(result[1]);

    if (
      !Number.isFinite(count) ||
      !Number.isFinite(ttl) ||
      count < 1 ||
      ttl < 0
    ) {
      throw new Error('Invalid Redis velocity state');
    }

    if (count > limit) {
      throw new HttpException(
        'Transfer velocity limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return count;
  }

  private async consumeVelocity(userId: string): Promise<void> {
    const client = await this.getClient();

    const burstKey =
      'payflow:risk:wallet-transfer:burst:' + userId;

    const hourlyKey =
      'payflow:risk:wallet-transfer:hour:' + userId;

    const result = await client.eval(
      [
        "local burst = redis.call('INCR', KEYS[1])",
        "if burst == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
        "local hourly = redis.call('INCR', KEYS[2])",
        "if hourly == 1 then redis.call('EXPIRE', KEYS[2], ARGV[2]) end",
        "local burstTtl = redis.call('TTL', KEYS[1])",
        "local hourlyTtl = redis.call('TTL', KEYS[2])",
        "return { burst, hourly, burstTtl, hourlyTtl }",
      ].join('\n'),
      {
        keys: [burstKey, hourlyKey],
        arguments: [
          String(this.burstWindowSeconds),
          '3600',
        ],
      },
    );

    if (!Array.isArray(result) || result.length !== 4) {
      throw new Error('Invalid Redis velocity response');
    }

    const burstCount = Number(result[0]);
    const hourlyCount = Number(result[1]);
    const burstTtl = Number(result[2]);
    const hourlyTtl = Number(result[3]);

    if (
      !Number.isFinite(burstCount) ||
      !Number.isFinite(hourlyCount) ||
      !Number.isFinite(burstTtl) ||
      !Number.isFinite(hourlyTtl) ||
      burstCount < 1 ||
      hourlyCount < 1 ||
      burstTtl < 0 ||
      hourlyTtl < 0
    ) {
      throw new Error('Invalid Redis velocity state');
    }

    if (
      burstCount > this.burstMax ||
      hourlyCount > this.hourlyMax
    ) {
      throw new HttpException(
        'Transfer velocity limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
  async enforce(
    userId: string,
    sourceWalletId: string,
    amount: Decimal,
  ): Promise<void> {
    const normalizedUserId = userId?.trim();
    const normalizedWalletId = sourceWalletId?.trim();

    if (!normalizedUserId || !normalizedWalletId) {
      throw new ServiceUnavailableException(
        'Authenticated transfer identity is unavailable',
      );
    }

    try {
      const profile = await this.prisma.riskProfile.findUnique({
        where: { userId: normalizedUserId },
        select: { status: true },
      });

      if (profile?.status === 'RESTRICTED') {
        throw new HttpException(
          'Transfers are restricted for this account',
          HttpStatus.FORBIDDEN,
        );
      }

      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const completedToday = await this.prisma.transfer.findMany({
        where: {
          sourceWalletId: normalizedWalletId,
          status: 'COMPLETED',
          completedAt: { gte: startOfDay },
        },
        select: { amount: true },
      });

      if (completedToday.length >= this.dailyMax) {
        await this.recordSignal(
          normalizedUserId,
          'RAPID_TRANSFERS',
          'HIGH',
          'Daily completed transfer count threshold reached',
          {
            transferCount: completedToday.length,
            threshold: this.dailyMax,
          },
        );

        throw new HttpException(
          'Daily transfer limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const dailyAmount = completedToday.reduce(
        (total, item) => total.plus(item.amount),
        new Decimal(0),
      );

      if (dailyAmount.plus(amount).gt(this.dailyAmountMax)) {
        await this.recordSignal(
          normalizedUserId,
          'HIGH_VALUE_ACTIVITY',
          'HIGH',
          'Daily cumulative transfer amount threshold reached',
          {
            currentAmount: dailyAmount.toString(),
            requestedAmount: amount.toString(),
            threshold: this.dailyAmountMax.toString(),
          },
        );

        throw new HttpException(
          'Daily transfer amount limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      await this.consumeVelocity(normalizedUserId);
    } catch (error) {
      if (
        error instanceof HttpException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      this.logger.error(
        'Wallet transfer risk enforcement failed',
      );

      throw new ServiceUnavailableException(
        'Wallet transfer risk protection is unavailable',
      );
    }
  }

  private async recordSignal(
    userId: string,
    type: 'RAPID_TRANSFERS' | 'HIGH_VALUE_ACTIVITY',
    severity: string,
    summary: string,
    evidence: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const existing = await this.prisma.riskSignal.findFirst({
      where: {
        userId,
        type,
        status: 'OPEN',
      },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.riskSignal.create({
        data: {
          userId,
          type,
          severity,
          summary,
          evidence,
        },
      });
    }

    await this.prisma.riskProfile.upsert({
      where: { userId },
      create: {
        userId,
        status: 'REVIEW_REQUIRED',
        reviewReason: summary,
      },
      update: {
        status: 'REVIEW_REQUIRED',
        reviewReason: summary,
      },
    });
  }

  async checkReadiness(): Promise<boolean> {
    try {
      const client = await this.getClient();

      if (!client.isReady) {
        return false;
      }

      return (await client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
    }

    this.client = null;
    this.connectPromise = null;
  }
}
