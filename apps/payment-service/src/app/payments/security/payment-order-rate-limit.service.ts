import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class PaymentOrderRateLimitService
  implements OnModuleDestroy
{
  private readonly logger = new Logger(
    PaymentOrderRateLimitService.name,
  );

  private readonly limit =
    this.readPositiveInteger(
      'PAYMENT_ORDER_RATE_LIMIT_MAX',
      10,
    );
  private readonly windowSeconds =
    this.readPositiveInteger(
      'PAYMENT_ORDER_RATE_LIMIT_WINDOW_SECONDS',
      60,
    );

  private client: RedisClientType | null = null;
  private connectPromise: Promise<RedisClientType> | null = null;

  private readPositiveInteger(
    name: string,
    fallback: number,
  ): number {
    const rawValue = process.env[name];

    if (
      rawValue === undefined ||
      rawValue.trim() === ''
    ) {
      return fallback;
    }

    const normalizedValue =
      rawValue.trim();

    if (!/^[1-9]\d*$/.test(normalizedValue)) {
      throw new ServiceUnavailableException(
        'Payment order abuse protection configuration is invalid',
      );
    }

    const parsedValue =
      Number(normalizedValue);

    if (
      !Number.isSafeInteger(parsedValue) ||
      parsedValue <= 0
    ) {
      throw new ServiceUnavailableException(
        'Payment order abuse protection configuration is invalid',
      );
    }

    return parsedValue;
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
        'Payment order abuse protection is unavailable',
      );
    }

    const client = createClient({
      url: redisUrl,
    });

    client.on('error', (error: Error) => {
      this.logger.error(
        'Payment order Redis error: ' +
          error.message,
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

  async enforce(userId: string): Promise<void> {
    const normalizedUserId =
      userId?.trim();

    if (!normalizedUserId) {
      throw new ServiceUnavailableException(
        'Authenticated payment identity is unavailable',
      );
    }

    try {
      const client =
        await this.getClient();

      const key =
        'payflow:rate-limit:payment-order:' +
        normalizedUserId;

      /*
       * Redis transaction:
       * INCR and TTL establishment are committed
       * together for a newly observed key.
       *
       * Existing windows keep their original TTL.
       */
      const atomicResult =
        await client.eval(
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
            arguments: [
              String(this.windowSeconds),
            ],
          },
        );

      if (
        !Array.isArray(atomicResult) ||
        atomicResult.length !== 2
      ) {
        throw new Error(
          'Invalid Redis rate-limit response',
        );
      }

      const count =
        Number(atomicResult[0]);

      const remainingTtl =
        Number(atomicResult[1]);

      if (
        !Number.isFinite(count) ||
        !Number.isFinite(remainingTtl) ||
        count < 1 ||
        remainingTtl < 0
      ) {
        throw new Error(
          'Invalid Redis rate-limit state',
        );
      }

      if (count > this.limit) {
        throw new HttpException(
          'Too many payment order requests',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (
        (error instanceof HttpException &&
          error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      this.logger.error(
        'Payment order rate-limit enforcement failed',
      );

      /*
       * Financial order creation fails closed if
       * distributed abuse protection is unavailable.
       */
      throw new ServiceUnavailableException(
        'Payment order abuse protection is unavailable',
      );
    }
  }

  async checkReadiness(): Promise<boolean> {
    try {
      const client = await this.getClient();

      if (!client.isReady) {
        return false;
      }

      const response = await client.ping();

      return response === 'PONG';
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