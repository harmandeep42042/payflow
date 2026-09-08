import { BadGatewayException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import {
  OutboxEventProducer,
  PaymentEventPattern,
  PaymentEventVersion,
} from '@payflow/shared-events';

import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const payment = {
    id: 'payment-1',
    userId: 'user-1',
    walletId: 'wallet-1',
    provider: 'MOCK',
    providerOrderId: 'mock-order-1',
    providerPaymentId: null,
    amount: '1.00',
    amountInPaise: 100,
    currency: 'INR',
    status: 'CREATED',
    description: null,
    idempotencyKey: 'create-payment-1',
    metadata: null,
    createdAt: new Date('2026-08-21T00:00:00.000Z'),
    updatedAt: new Date('2026-08-21T00:00:00.000Z'),
    completedAt: null,
  };

  const completedPayment = {
    ...payment,
    status: 'COMPLETED',
    providerPaymentId: 'mock-pay-1',
    completedAt: new Date('2026-08-21T00:01:00.000Z'),
  };

  const walletResponse = {
    deposit: {
      id: 'deposit-1',
    },
  };

  const rewardResponse = {
    generated: true,
  };

  function createHarness() {
    let paymentStatus = payment.status;

    const transactionPayment = {
      updateMany: jest.fn(async () => {
        if (paymentStatus !== 'CREATED') {
          return { count: 0 };
        }

        paymentStatus = 'COMPLETED';
        return { count: 1 };
      }),
    };

    const transactionOutbox = {
      create: jest.fn(async ({ data }) => data),
    };

    const prisma = {
      payment: {
        findUnique: jest.fn(async () =>
          paymentStatus === 'COMPLETED' ? completedPayment : payment,
        ),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (callback) =>
        callback({
          payment: transactionPayment,
          outboxEvent: transactionOutbox,
        }),
      ),
    };

    const http = {
      post: jest.fn((url: string) =>
        url.includes('/wallets/deposit')
          ? of({ data: walletResponse })
          : of({ data: rewardResponse }),
      ),
    };

    const service = new PaymentsService(prisma as never, http as never);

    return {
      service,
      prisma,
      http,
      transactionPayment,
      transactionOutbox,
      setPaymentStatus: (status: string) => {
        paymentStatus = status;
      },
    };
  }

  it('creates exactly one PAYMENT_COMPLETED outbox event on successful completion', async () => {
    const harness = createHarness();

    const result = await harness.service.confirmOrder(
      payment.id,
      payment.userId,
      'Bearer token',
    );

    expect(result.replayed).toBe(false);
    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(harness.transactionOutbox.create).toHaveBeenCalledTimes(1);
    expect(harness.transactionOutbox.create).toHaveBeenCalledWith({
      data: {
        producer: OutboxEventProducer.Payment,
        aggregateType: 'PAYMENT',
        aggregateId: payment.id,
        eventType: PaymentEventPattern.Completed,
        payload: {
          version: PaymentEventVersion.Completed,
          paymentId: payment.id,
          userId: payment.userId,
          walletId: payment.walletId,
          amount: payment.amount,
          currency: payment.currency,
        },
      },
    });
  });

  it('does not create another outbox event when a completed payment is replayed', async () => {
    const harness = createHarness();
    harness.setPaymentStatus('COMPLETED');

    const result = await harness.service.confirmOrder(
      payment.id,
      payment.userId,
      'Bearer token',
    );

    expect(result.replayed).toBe(true);
    expect(harness.http.post).not.toHaveBeenCalled();
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
    expect(harness.transactionOutbox.create).not.toHaveBeenCalled();
  });

  it('does not create duplicate outbox events for concurrent confirmation', async () => {
    const harness = createHarness();

    const results = await Promise.all([
      harness.service.confirmOrder(payment.id, payment.userId, 'Bearer token'),
      harness.service.confirmOrder(payment.id, payment.userId, 'Bearer token'),
    ]);

    expect(harness.transactionPayment.updateMany).toHaveBeenCalledTimes(2);
    expect(harness.transactionOutbox.create).toHaveBeenCalledTimes(1);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(results.filter((result) => result.replayed)).toHaveLength(1);
  });

  it('does not create an outbox event when wallet credit fails', async () => {
    const harness = createHarness();
    harness.http.post.mockImplementation(() =>
      throwError(() => new Error('wallet unavailable')),
    );

    await expect(
      harness.service.confirmOrder(payment.id, payment.userId, 'Bearer token'),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
    expect(harness.transactionOutbox.create).not.toHaveBeenCalled();
  });

  it('keeps create-order idempotency unchanged', async () => {
    const harness = createHarness();

    const result = await harness.service.createOrder(
      {
        userId: payment.userId,
        walletId: payment.walletId,
        amountInPaise: payment.amountInPaise,
        currency: payment.currency,
        idempotencyKey: payment.idempotencyKey,
      },
      payment.userId,
    );

    expect(result).toEqual({
      ...payment,
      replayed: true,
    });
    expect(harness.prisma.wallet.findUnique).not.toHaveBeenCalled();
    expect(harness.prisma.payment.create).not.toHaveBeenCalled();
  });
});

describe('PaymentsService external rail durability', () => {
  const basePayment = {
    id: 'payment-razorpay-1',
    userId: 'user-1',
    walletId: 'wallet-1',
    provider: 'RAZORPAY',
    providerOrderId: null,
    providerPaymentId: null,
    amount: '1.00',
    amountInPaise: 100,
    currency: 'INR',
    status: 'CREATED',
    description: null,
    idempotencyKey: 'razorpay-payment-1',
    failureReason: null,
    metadata: {
      mode: 'razorpay',
    },
    createdAt: new Date('2026-08-28T00:00:00.000Z'),
    updatedAt: new Date('2026-08-28T00:00:00.000Z'),
    authorizedAt: null,
    completedAt: null,
    failedAt: null,
    processingStartedAt: null,
    lastRecoveryAt: null,
    recoveryAttempts: 0,
  };

  function createExternalRailHarness() {
    let currentPayment: any = null;

    const paymentCreate = jest.fn(async ({ data }) => {
      currentPayment = {
        ...basePayment,
        ...data,
        id: basePayment.id,
        providerOrderId: data.providerOrderId ?? null,
        providerPaymentId: null,
        failureReason: null,
        createdAt: basePayment.createdAt,
        updatedAt: basePayment.updatedAt,
        authorizedAt: null,
        completedAt: null,
        failedAt: null,
        processingStartedAt: null,
        lastRecoveryAt: null,
        recoveryAttempts: 0,
      };

      return currentPayment;
    });

    const paymentFindUnique = jest.fn(async ({ where }: any) => {
      if (!currentPayment) {
        return null;
      }

      if (where.id && where.id !== currentPayment.id) {
        return null;
      }

      if (
        where.idempotencyKey &&
        where.idempotencyKey !== currentPayment.idempotencyKey
      ) {
        return null;
      }

      return {
        ...currentPayment,
      };
    });

    const paymentUpdateMany = jest.fn(async ({ where, data }: any) => {
      if (!currentPayment) {
        return { count: 0 };
      }

      if (where.id && where.id !== currentPayment.id) {
        return { count: 0 };
      }

      if (where.provider && where.provider !== currentPayment.provider) {
        return { count: 0 };
      }

      if (where.status && where.status !== currentPayment.status) {
        return { count: 0 };
      }

      const nextData = {
        ...data,
      };

      if (
        nextData.recoveryAttempts &&
        typeof nextData.recoveryAttempts === 'object' &&
        typeof nextData.recoveryAttempts.increment === 'number'
      ) {
        nextData.recoveryAttempts =
          (currentPayment.recoveryAttempts ?? 0) +
          nextData.recoveryAttempts.increment;
      }

      currentPayment = {
        ...currentPayment,
        ...nextData,
        updatedAt: new Date(),
      };

      return { count: 1 };
    });

    const prisma = {
      payment: {
        findUnique: paymentFindUnique,
        create: paymentCreate,
        updateMany: paymentUpdateMany,
        findMany: jest.fn(),
      },

      wallet: {
        findUnique: jest.fn(async () => ({
          id: basePayment.walletId,
          userId: basePayment.userId,
          currency: basePayment.currency,
        })),
      },

      $transaction: jest.fn(),
    };

    const http = {
      post: jest.fn(),
    };

    const paymentRail = {
      name: 'RAZORPAY' as const,
      isConfigured: jest.fn(() => true),
      createOrder: jest.fn(),
    };

    const service = new PaymentsService(prisma as never, http as never);

    Object.defineProperty(service, 'paymentRail', {
      value: paymentRail,
      configurable: true,
    });

    return {
      service,
      prisma,
      http,
      paymentRail,

      getPayment: () => (currentPayment ? { ...currentPayment } : null),

      seedPayment: (value: any) => {
        currentPayment = {
          ...value,
        };
      },
    };
  }

  function createDto() {
    return {
      userId: basePayment.userId,
      walletId: basePayment.walletId,
      amountInPaise: basePayment.amountInPaise,
      currency: basePayment.currency,
      idempotencyKey: basePayment.idempotencyKey,
      provider: 'RAZORPAY' as const,
    };
  }

  it('persists Razorpay order as ORDER_CREATED without crediting wallet', async () => {
    const harness = createExternalRailHarness();

    harness.paymentRail.createOrder.mockResolvedValue({
      provider: 'RAZORPAY',
      providerOrderId: 'order_test_123',
      amountMinor: 100,
      currency: 'INR',
      status: 'created',
      raw: {
        id: 'order_test_123',
        status: 'created',
      },
    });

    const result = await harness.service.createOrder(
      createDto(),
      basePayment.userId,
    );

    expect(harness.paymentRail.createOrder).toHaveBeenCalledTimes(1);

    expect(harness.paymentRail.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 100,
        currency: 'INR',
      }),
    );

    expect(harness.prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: basePayment.id,
          provider: 'RAZORPAY',
          status: 'CREATED',
        }),
        data: expect.objectContaining({
          status: 'PROCESSING',
        }),
      }),
    );

    expect(harness.prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: basePayment.id,
          status: 'PROCESSING',
        }),
        data: expect.objectContaining({
          status: 'ORDER_CREATED',
          providerOrderId: 'order_test_123',
        }),
      }),
    );

    expect(result.status).toBe('ORDER_CREATED');

    expect(result.providerOrderId).toBe('order_test_123');

    expect(harness.getPayment().status).toBe('ORDER_CREATED');

    expect(harness.http.post).not.toHaveBeenCalled();

    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('marks definite provider 4xx rejection as FAILED', async () => {
    const harness = createExternalRailHarness();

    const providerError: any = new Error('provider rejected request');

    providerError.statusCode = 401;

    harness.paymentRail.createOrder.mockRejectedValue(providerError);

    await expect(
      harness.service.createOrder(createDto(), basePayment.userId),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(harness.paymentRail.createOrder).toHaveBeenCalledTimes(1);

    expect(harness.getPayment().status).toBe('FAILED');

    expect(harness.getPayment().failedAt).toBeInstanceOf(Date);

    expect(harness.http.post).not.toHaveBeenCalled();
  });

  it('marks ambiguous provider timeout as NEEDS_REVIEW', async () => {
    const harness = createExternalRailHarness();

    harness.paymentRail.createOrder.mockRejectedValue(
      new Error('provider timeout'),
    );

    await expect(
      harness.service.createOrder(createDto(), basePayment.userId),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(harness.paymentRail.createOrder).toHaveBeenCalledTimes(1);

    expect(harness.getPayment().status).toBe('NEEDS_REVIEW');

    expect(harness.getPayment().recoveryAttempts).toBe(1);

    expect(harness.getPayment().lastRecoveryAt).toBeInstanceOf(Date);

    expect(harness.http.post).not.toHaveBeenCalled();
  });

  it('marks provider 5xx as NEEDS_REVIEW instead of blind retry', async () => {
    const harness = createExternalRailHarness();

    const providerError: any = new Error('provider unavailable');

    providerError.statusCode = 503;

    harness.paymentRail.createOrder.mockRejectedValue(providerError);

    await expect(
      harness.service.createOrder(createDto(), basePayment.userId),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(harness.paymentRail.createOrder).toHaveBeenCalledTimes(1);

    expect(harness.getPayment().status).toBe('NEEDS_REVIEW');

    expect(harness.getPayment().recoveryAttempts).toBe(1);

    expect(harness.http.post).not.toHaveBeenCalled();
  });

  it('does not call provider again for an existing durable payment', async () => {
    const harness = createExternalRailHarness();

    harness.seedPayment({
      ...basePayment,
      status: 'ORDER_CREATED',
      providerOrderId: 'order_existing_1',
    });

    const result = await harness.service.createOrder(
      createDto(),
      basePayment.userId,
    );

    expect('replayed' in result && result.replayed).toBe(true);

    expect(result.status).toBe('ORDER_CREATED');

    expect(result.providerOrderId).toBe('order_existing_1');

    expect(harness.paymentRail.createOrder).not.toHaveBeenCalled();

    expect(harness.prisma.payment.create).not.toHaveBeenCalled();

    expect(harness.http.post).not.toHaveBeenCalled();
  });

  it('keeps MOCK create-order replay behavior isolated from external rail', async () => {
    const harness = createExternalRailHarness();

    harness.seedPayment({
      ...basePayment,
      provider: 'MOCK',
      status: 'CREATED',
      providerOrderId: 'mock_existing_1',
      idempotencyKey: 'mock-existing-key',
    });

    const result = await harness.service.createOrder(
      {
        userId: basePayment.userId,
        walletId: basePayment.walletId,
        amountInPaise: 100,
        currency: 'INR',
        idempotencyKey: 'mock-existing-key',
      },
      basePayment.userId,
    );

    expect('replayed' in result && result.replayed).toBe(true);

    expect(harness.paymentRail.createOrder).not.toHaveBeenCalled();

    expect(harness.http.post).not.toHaveBeenCalled();
  });

  /*
   * 7C.6C IDEMPOTENCY HARDENING
   *
   * Same idempotency key is replayable only when the
   * complete durable payment intent is identical.
   */

  it('replays an existing payment when the idempotency payload is identical', async () => {
    const harness = createExternalRailHarness();

    harness.prisma.payment.findUnique.mockResolvedValueOnce({
      ...basePayment,
      description: null,
    });

    const result = await harness.service.createOrder(
      createDto(),
      basePayment.userId,
    );

    expect('replayed' in result && result.replayed).toBe(true);

    expect(harness.prisma.payment.create).not.toHaveBeenCalled();

    expect(harness.paymentRail.createOrder).not.toHaveBeenCalled();
  });

  it.each([
    [
      'user',
      {
        userId: 'different-user',
      },
    ],

    [
      'wallet',
      {
        walletId: 'different-wallet',
      },
    ],

    [
      'amount',
      {
        amountInPaise: 999,
      },
    ],

    [
      'currency',
      {
        currency: 'USD',
      },
    ],

    [
      'provider',
      {
        provider: 'MOCK' as const,
      },
    ],

    [
      'description',
      {
        description: 'Different payment',
      },
    ],
  ])(
    'rejects reuse of an idempotency key with different %s payload',
    async (_field, override) => {
      const harness = createExternalRailHarness();

      harness.prisma.payment.findUnique.mockResolvedValueOnce({
        ...basePayment,
        description: null,
      });

      await expect(
        harness.service.createOrder(
          {
            ...createDto(),
            ...override,
          },
          (
            override as {
              userId?: string;
            }
          ).userId ?? basePayment.userId,
        ),
      ).rejects.toThrow(
        'Idempotency key is already bound to a different payment payload',
      );

      expect(harness.prisma.payment.create).not.toHaveBeenCalled();

      expect(harness.paymentRail.createOrder).not.toHaveBeenCalled();
    },
  );

  it('recovers a concurrent P2002 loser as replay when the winner payload matches', async () => {
    const harness = createExternalRailHarness();

    harness.prisma.payment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...basePayment,
        description: null,
      });

    harness.prisma.payment.create.mockRejectedValueOnce({
      code: 'P2002',
    });

    const result = await harness.service.createOrder(
      createDto(),
      basePayment.userId,
    );

    expect('replayed' in result && result.replayed).toBe(true);

    expect(harness.prisma.payment.create).toHaveBeenCalledTimes(1);

    expect(harness.paymentRail.createOrder).not.toHaveBeenCalled();
  });

  it('rejects a concurrent P2002 loser when the winner payload differs', async () => {
    const harness = createExternalRailHarness();

    harness.prisma.payment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...basePayment,

        amountInPaise: 999,

        description: null,
      });

    harness.prisma.payment.create.mockRejectedValueOnce({
      code: 'P2002',
    });

    await expect(
      harness.service.createOrder(createDto(), basePayment.userId),
    ).rejects.toThrow(
      'Idempotency key is already bound to a different payment payload',
    );

    expect(harness.paymentRail.createOrder).not.toHaveBeenCalled();
  });

  it('does not hide a non-P2002 database failure', async () => {
    const harness = createExternalRailHarness();

    harness.prisma.payment.findUnique.mockResolvedValueOnce(null);

    harness.prisma.payment.create.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(
      harness.service.createOrder(createDto(), basePayment.userId),
    ).rejects.toThrow('database unavailable');

    expect(harness.paymentRail.createOrder).not.toHaveBeenCalled();
  });
});
