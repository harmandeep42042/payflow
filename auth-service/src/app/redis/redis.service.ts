import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { RedisClientType } from 'redis';

import { REDIS_CLIENT } from './redis.constants';

export type RateLimitResult = {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

@Injectable()
export class RedisService
  implements OnApplicationShutdown
{
  private readonly logger = new Logger(
    RedisService.name,
  );

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly client: RedisClientType,
  ) {}

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async get(
    key: string,
  ): Promise<string | null> {
    const value = await this.client.get(key);

    if (value === null) {
      return null;
    }

    return String(value);
  }

  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<void> {
    if (
      ttlSeconds !== undefined &&
      ttlSeconds > 0
    ) {
      await this.client.set(key, value, {
        EX: ttlSeconds,
      });

      return;
    }

    await this.client.set(key, value);
  }

  async delete(key: string): Promise<number> {
    return this.client.del(key);
  }

  async increment(
    key: string,
  ): Promise<number> {
    return this.client.incr(key);
  }

  async expire(
    key: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.client.expire(
      key,
      ttlSeconds,
    );

    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async exists(
    key: string,
  ): Promise<boolean> {
    const result =
      await this.client.exists(key);

    return result === 1;
  }

  async consumeRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const current =
      await this.client.incr(key);

    if (current === 1) {
      await this.client.expire(
        key,
        windowSeconds,
      );
    }

    let retryAfterSeconds =
      await this.client.ttl(key);

    if (retryAfterSeconds < 0) {
      await this.client.expire(
        key,
        windowSeconds,
      );

      retryAfterSeconds = windowSeconds;
    }

    return {
      allowed: current <= limit,
      current,
      limit,
      remaining: Math.max(
        limit - current,
        0,
      ),
      retryAfterSeconds,
    };
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();

      this.logger.log(
        'Redis connection closed',
      );
    }
  }
}