import { Injectable, NestMiddleware } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export type CorrelatedRequest = Request & {
  correlationId?: string;
};

type CorrelationContext = {
  correlationId: string;
};

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

const MAX_CORRELATION_ID_LENGTH = 128;

const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]+$/;

function normalizeCorrelationId(
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

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

export function correlationHeaders(): Record<string, string> {
  const correlationId = getCorrelationId();

  return correlationId
    ? {
        [CORRELATION_ID_HEADER]: correlationId,
      }
    : {};
}

export function withCorrelationHeaders<T extends Record<string, unknown>>(
  headers: T,
): T & Record<string, string> {
  return {
    ...headers,
    ...correlationHeaders(),
  };
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(
    request: CorrelatedRequest,
    response: Response,
    next: NextFunction,
  ): void {
    const supplied = normalizeCorrelationId(
      request.headers[CORRELATION_ID_HEADER],
    );

    const correlationId = supplied ?? randomUUID();

    request.correlationId = correlationId;

    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    correlationStorage.run(
      {
        correlationId,
      },
      next,
    );
  }
}
