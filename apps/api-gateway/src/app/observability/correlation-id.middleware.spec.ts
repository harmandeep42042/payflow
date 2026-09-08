import { Request, Response } from 'express';
import {
  CORRELATION_ID_HEADER,
  CorrelatedRequest,
  CorrelationIdMiddleware,
} from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  function createResponse() {
    return {
      setHeader: jest.fn(),
    } as unknown as Response;
  }

  it('preserves a valid incoming correlation ID', () => {
    const request = {
      headers: {
        [CORRELATION_ID_HEADER]: 'client-request-123',
      },
    } as unknown as CorrelatedRequest;

    const response = createResponse();
    const next = jest.fn();

    middleware.use(request, response, next);

    expect(request.correlationId).toBe('client-request-123');

    expect(response.setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      'client-request-123',
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates an ID when none is supplied', () => {
    const request = {
      headers: {},
    } as unknown as CorrelatedRequest;

    const response = createResponse();
    const next = jest.fn();

    middleware.use(request, response, next);

    expect(request.correlationId).toEqual(expect.any(String));

    expect(request.correlationId).toMatch(/^[0-9a-f-]{36}$/i);

    expect(response.setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      request.correlationId,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('replaces an unsafe incoming ID', () => {
    const request = {
      headers: {
        [CORRELATION_ID_HEADER]: 'unsafe\r\ninjected-header',
      },
    } as unknown as CorrelatedRequest;

    const response = createResponse();
    const next = jest.fn();

    middleware.use(request, response, next);

    expect(request.correlationId).not.toBe('unsafe\r\ninjected-header');

    expect(request.correlationId).toMatch(/^[0-9a-f-]{36}$/i);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('replaces an excessively long incoming ID', () => {
    const request = {
      headers: {
        [CORRELATION_ID_HEADER]: 'a'.repeat(129),
      },
    } as unknown as CorrelatedRequest;

    const response = createResponse();
    const next = jest.fn();

    middleware.use(request, response, next);

    expect(request.correlationId).not.toBe('a'.repeat(129));

    expect(request.correlationId).toMatch(/^[0-9a-f-]{36}$/i);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
