import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export type CorrelatedRequest = Request & {
  correlationId?: string;
};

const MAX_CORRELATION_ID_LENGTH = 128;

const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]+$/;

function readCorrelationId(
  value: string | string[] | undefined,
): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate) {
    return undefined;
  }

  const normalized = candidate.trim();

  if (
    normalized.length === 0 ||
    normalized.length > MAX_CORRELATION_ID_LENGTH ||
    !SAFE_CORRELATION_ID.test(normalized)
  ) {
    return undefined;
  }

  return normalized;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(
    request: CorrelatedRequest,
    response: Response,
    next: NextFunction,
  ): void {
    const correlationId = readCorrelationId(
      request.headers[CORRELATION_ID_HEADER],
    );

    if (correlationId) {
      request.correlationId = correlationId;

      response.setHeader(CORRELATION_ID_HEADER, correlationId);
    }

    next();
  }
}
