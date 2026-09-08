import type { NextFunction, Response } from 'express';

import {
  CorrelatedRequest,
  CorrelationIdMiddleware,
} from './correlation-id.middleware';

describe('Payment CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();

  function response(): Response {
    return {
      setHeader: jest.fn(),
    } as unknown as Response;
  }

  function next(): NextFunction {
    return jest.fn() as unknown as NextFunction;
  }

  it('accepts valid propagated correlation ID', () => {
    const request = {
      headers: {
        'x-correlation-id': 'payflow-request-123',
      },
    } as unknown as CorrelatedRequest;

    const res = response();
    const done = next();

    middleware.use(request, res, done);

    expect(request.correlationId).toBe('payflow-request-123');

    expect(res.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      'payflow-request-123',
    );

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('rejects CRLF injection', () => {
    const request = {
      headers: {
        'x-correlation-id': 'bad\r\nheader',
      },
    } as unknown as CorrelatedRequest;

    const res = response();
    const done = next();

    middleware.use(request, res, done);

    expect(request.correlationId).toBeUndefined();

    expect(res.setHeader).not.toHaveBeenCalled();

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('rejects values over 128 characters', () => {
    const request = {
      headers: {
        'x-correlation-id': 'a'.repeat(129),
      },
    } as unknown as CorrelatedRequest;

    const res = response();
    const done = next();

    middleware.use(request, res, done);

    expect(request.correlationId).toBeUndefined();

    expect(res.setHeader).not.toHaveBeenCalled();

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('does not generate a replacement ID', () => {
    const request = {
      headers: {},
    } as unknown as CorrelatedRequest;

    const res = response();
    const done = next();

    middleware.use(request, res, done);

    expect(request.correlationId).toBeUndefined();

    expect(res.setHeader).not.toHaveBeenCalled();

    expect(done).toHaveBeenCalledTimes(1);
  });
});
