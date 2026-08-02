import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RedisService } from '../../redis/redis.service';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';

type HttpRequest = {
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
  headers: Record<
    string,
    string | string[] | undefined
  >;
  body?: {
    email?: unknown;
  };
};

@Injectable()
export class RedisRateLimitGuard
  implements CanActivate
{
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const options =
      this.reflector.getAllAndOverride<RateLimitOptions>(
        RATE_LIMIT_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (!options) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<HttpRequest>();

    const identifier =
      this.getIdentifier(request);

    const routePrefix =
      options.prefix ?? 'request';

    const key = [
      'payflow',
      'rate-limit',
      routePrefix,
      identifier,
    ].join(':');

    const result =
      await this.redisService.consumeRateLimit(
        key,
        options.limit,
        options.windowSeconds,
      );

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode:
            HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message:
            'Too many requests. Please try again later.',
          retryAfterSeconds:
            result.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getIdentifier(
    request: HttpRequest,
  ): string {
    const forwardedFor =
      request.headers['x-forwarded-for'];

    const forwardedIp =
      Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor
            ?.split(',')[0]
            ?.trim();

    const ip =
      forwardedIp ||
      request.ip ||
      request.socket?.remoteAddress ||
      'unknown';

    const email =
      typeof request.body?.email === 'string'
        ? request.body.email
            .trim()
            .toLowerCase()
        : 'no-email';

    return this.sanitize(`${ip}:${email}`);
  }

  private sanitize(value: string): string {
    return value.replace(
      /[^a-zA-Z0-9:._-]/g,
      '_',
    );
  }
}
