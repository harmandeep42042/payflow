import type { NextFunction, Response } from 'express';

import {
  CorrelatedRequest,
  CorrelationIdMiddleware,
  correlationHeaders,
  getCorrelationId,
  withCorrelationHeaders,
} from './correlation-id.middleware';

describe('Gateway correlation context', () => {
  const middleware = new CorrelationIdMiddleware();

  it('preserves headers and exposes correlation ID inside request context', (done) => {
    const request = {
      headers: {
        'x-correlation-id': 'gateway-context-123',
      },
    } as unknown as CorrelatedRequest;

    const response = {
      setHeader: jest.fn(),
    } as unknown as Response;

    const next = (() => {
      try {
        expect(getCorrelationId()).toBe('gateway-context-123');

        expect(correlationHeaders()).toEqual({
          'x-correlation-id': 'gateway-context-123',
        });

        expect(
          withCorrelationHeaders({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        ).toEqual({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
          'x-correlation-id': 'gateway-context-123',
        });

        done();
      } catch (error) {
        done(error);
      }
    }) as NextFunction;

    middleware.use(request, response, next);
  });

  it('does not add a correlation header outside request context', () => {
    expect(
      withCorrelationHeaders({
        Accept: 'application/json',
      }),
    ).toEqual({
      Accept: 'application/json',
    });
  });
});
