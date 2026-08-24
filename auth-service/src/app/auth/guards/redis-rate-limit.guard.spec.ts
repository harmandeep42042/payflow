import { createHash } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import type { RedisService } from '../../redis/redis.service';
import { RedisRateLimitGuard } from './redis-rate-limit.guard';

describe('RedisRateLimitGuard', () => {
  const options = { prefix: 'refresh', limit: 10, windowSeconds: 60 };

  function context(body: Record<string, unknown>, ip = '10.0.0.1'): ExecutionContext {
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ body, headers: {}, ip }) }),
    } as unknown as ExecutionContext;
  }

  it('isolates refresh limits by a non-reversible token fingerprint', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(options) };
    const redis = { consumeRateLimit: jest.fn().mockResolvedValue({ allowed: true }) };
    const guard = new RedisRateLimitGuard(reflector as unknown as Reflector, redis as unknown as RedisService);

    await guard.canActivate(context({ refreshToken: 'refresh-secret' }));

    const fingerprint = createHash('sha256').update('refresh-secret').digest('hex');
    expect(redis.consumeRateLimit).toHaveBeenCalledWith(
      `payflow:rate-limit:refresh:refresh-token:${fingerprint}`,
      10,
      60,
    );
  });

  it('keeps login limits separate and scoped by IP and email', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue({ prefix: 'login', limit: 5, windowSeconds: 300 }) };
    const redis = { consumeRateLimit: jest.fn().mockResolvedValue({ allowed: true }) };
    const guard = new RedisRateLimitGuard(reflector as unknown as Reflector, redis as unknown as RedisService);

    await guard.canActivate(context({ email: 'USER@Example.Test' }));

    expect(redis.consumeRateLimit).toHaveBeenCalledWith(
      'payflow:rate-limit:login:10.0.0.1:user_example.test',
      5,
      300,
    );
  });
});
