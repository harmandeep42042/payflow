jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

import {
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient } from 'redis';
import { PaymentOrderRateLimitService } from './payment-order-rate-limit.service';

describe('PaymentOrderRateLimitService', () => {
  const originalRedisUrl =
    process.env.REDIS_URL;

  let client: {
    isReady: boolean;
    isOpen: boolean;
    connect: jest.Mock;
    disconnect: jest.Mock;
    eval: jest.Mock;
    quit: jest.Mock;
    on: jest.Mock;
  };

  beforeEach(() => {
    process.env.REDIS_URL =
      'redis://redis:6379';

    client = {
      isReady: false,
      isOpen: true,

      connect: jest.fn().mockImplementation(
        async () => {
          client.isReady = true;
        },
      ),

      disconnect:
        jest.fn().mockResolvedValue(undefined),

      eval:
        jest.fn().mockResolvedValue([1, 60]),

      quit:
        jest.fn().mockResolvedValue(undefined),

      on: jest.fn(),
    };

    (createClient as jest.Mock)
      .mockReturnValue(client);
  });

  afterEach(() => {
    jest.clearAllMocks();

    delete process.env.PAYMENT_ORDER_RATE_LIMIT_MAX;
    delete process.env.PAYMENT_ORDER_RATE_LIMIT_WINDOW_SECONDS;

    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL =
        originalRedisUrl;
    }
  });

  it('uses one atomic EVAL with a user-scoped key and window TTL', async () => {
    client.eval.mockResolvedValue([1, 60]);

    const service =
      new PaymentOrderRateLimitService();

    await service.enforce('user-1');

    expect(client.eval)
      .toHaveBeenCalledTimes(1);

    const [
      script,
      options,
    ] = client.eval.mock.calls[0];

    expect(typeof script)
      .toBe('string');

    expect(script)
      .toContain("redis.call('INCR', KEYS[1])");

    expect(script)
      .toContain('if current == 1 then');

    expect(script)
      .toContain("redis.call('EXPIRE', KEYS[1], ARGV[1])");

    expect(script)
      .toContain("redis.call('TTL', KEYS[1])");

    expect(script)
      .toContain('return { current, ttl }');

    expect(options)
      .toEqual({
        keys: [
          'payflow:rate-limit:payment-order:user-1',
        ],
        arguments: [
          '60',
        ],
      });
  });

  it('uses the same atomic Lua operation for an existing window', async () => {
    client.eval.mockResolvedValue([2, 45]);

    const service =
      new PaymentOrderRateLimitService();

    await service.enforce('user-1');

    expect(client.eval)
      .toHaveBeenCalledTimes(1);

    const [
      ,
      options,
    ] = client.eval.mock.calls[0];

    expect(options)
      .toEqual({
        keys: [
          'payflow:rate-limit:payment-order:user-1',
        ],
        arguments: [
          '60',
        ],
      });
  });

  it('allows the tenth request', async () => {
    client.eval.mockResolvedValue([10, 30]);

    const service =
      new PaymentOrderRateLimitService();

    await expect(
      service.enforce('user-1'),
    ).resolves.toBeUndefined();

    expect(client.eval)
      .toHaveBeenCalledTimes(1);
  });

  it('rejects request eleven with 429', async () => {
    client.eval.mockResolvedValue([11, 30]);

    const service =
      new PaymentOrderRateLimitService();

    let caught: unknown;

    try {
      await service.enforce('user-1');
    } catch (error) {
      caught = error;
    }

    expect(caught)
      .toBeInstanceOf(HttpException);

    expect(
      (caught as HttpException).getStatus(),
    ).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );

    expect(client.eval)
      .toHaveBeenCalledTimes(1);
  });

  it('uses independent distributed keys for different users', async () => {
    client.eval
      .mockResolvedValueOnce([1, 60])
      .mockResolvedValueOnce([1, 60]);

    const service =
      new PaymentOrderRateLimitService();

    await service.enforce('user-1');
    await service.enforce('user-2');

    expect(client.eval)
      .toHaveBeenCalledTimes(2);

    const firstOptions =
      client.eval.mock.calls[0][1];

    const secondOptions =
      client.eval.mock.calls[1][1];

    expect(firstOptions.keys)
      .toEqual([
        'payflow:rate-limit:payment-order:user-1',
      ]);

    expect(secondOptions.keys)
      .toEqual([
        'payflow:rate-limit:payment-order:user-2',
      ]);

    expect(firstOptions.keys[0])
      .not.toBe(
        secondOptions.keys[0],
      );
  });

  it('fails closed without REDIS_URL', async () => {
    delete process.env.REDIS_URL;

    const service =
      new PaymentOrderRateLimitService();

    await expect(
      service.enforce('user-1'),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(client.eval)
      .not.toHaveBeenCalled();
  });

  it('fails closed on Redis EVAL failure', async () => {
    client.eval.mockRejectedValue(
      new Error('redis unavailable'),
    );

    const service =
      new PaymentOrderRateLimitService();

    await expect(
      service.enforce('user-1'),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails closed on malformed Redis EVAL response', async () => {
    client.eval.mockResolvedValue(
      'invalid-response',
    );

    const service =
      new PaymentOrderRateLimitService();

    await expect(
      service.enforce('user-1'),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('uses configured maximum request limit', async () => {
    process.env.PAYMENT_ORDER_RATE_LIMIT_MAX =
      '3';

    client.eval.mockResolvedValue([4, 30]);

    const service =
      new PaymentOrderRateLimitService();

    let caught: unknown;

    try {
      await service.enforce('user-1');
    } catch (error) {
      caught = error;
    }

    expect(caught)
      .toBeInstanceOf(HttpException);

    expect(
      (caught as HttpException).getStatus(),
    ).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );

    expect(client.eval)
      .toHaveBeenCalledTimes(1);
  });

  it('passes configured window seconds to atomic Lua', async () => {
    process.env.PAYMENT_ORDER_RATE_LIMIT_WINDOW_SECONDS =
      '120';

    client.eval.mockResolvedValue([1, 120]);

    const service =
      new PaymentOrderRateLimitService();

    await service.enforce('user-1');

    expect(client.eval)
      .toHaveBeenCalledTimes(1);

    const options =
      client.eval.mock.calls[0][1];

    expect(options.arguments)
      .toEqual([
        '120',
      ]);
  });

  it('fails closed on zero maximum configuration', () => {
    process.env.PAYMENT_ORDER_RATE_LIMIT_MAX =
      '0';

    expect(
      () => new PaymentOrderRateLimitService(),
    ).toThrow(
      ServiceUnavailableException,
    );

    expect(client.eval)
      .not.toHaveBeenCalled();
  });

  it('fails closed on non-integer maximum configuration', () => {
    process.env.PAYMENT_ORDER_RATE_LIMIT_MAX =
      '2.5';

    expect(
      () => new PaymentOrderRateLimitService(),
    ).toThrow(
      ServiceUnavailableException,
    );

    expect(client.eval)
      .not.toHaveBeenCalled();
  });

  it('fails closed on invalid window configuration', () => {
    process.env.PAYMENT_ORDER_RATE_LIMIT_WINDOW_SECONDS =
      'invalid';

    expect(
      () => new PaymentOrderRateLimitService(),
    ).toThrow(
      ServiceUnavailableException,
    );

    expect(client.eval)
      .not.toHaveBeenCalled();
  });
  it('rejects an empty authenticated identity without touching Redis', async () => {
    const service =
      new PaymentOrderRateLimitService();

    await expect(
      service.enforce(''),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(client.eval)
      .not.toHaveBeenCalled();
  });
});