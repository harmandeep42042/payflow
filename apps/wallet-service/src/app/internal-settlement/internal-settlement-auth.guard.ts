import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { timingSafeEqual } from 'node:crypto';

type InternalRequest = {
  headers?: Record<string, string | string[] | undefined>;
};

@Injectable()
export class InternalSettlementAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.PAYMENT_SETTLEMENT_INTERNAL_TOKEN;

    if (!expected) {
      throw new ServiceUnavailableException(
        'Internal settlement authentication is not configured',
      );
    }

    const request = context.switchToHttp().getRequest<InternalRequest>();

    const raw = request.headers?.['x-payflow-service-token'];

    const supplied = Array.isArray(raw) ? raw[0] : raw;

    if (!supplied || !this.safeEqual(supplied, expected)) {
      throw new UnauthorizedException(
        'Invalid internal settlement credentials',
      );
    }

    return true;
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);

    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
