jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import { of, throwError } from 'rxjs';

import { ExternalPaymentSettlementService } from './external-payment-settlement.service';

describe('ExternalPaymentSettlementService', () => {
  const payment = {
    id: '11111111-1111-4111-8111-111111111111',

    walletId: '22222222-2222-4222-8222-222222222222',

    status: 'AUTHORIZED',

    providerOrderId: 'order_123',

    providerPaymentId: 'pay_123',

    amountInPaise: 100,

    currency: 'INR',

    lastRecoveryAt: null,
  };

  const capturedEvidence = {
    provider: 'RAZORPAY' as const,

    providerPaymentId: 'pay_123',

    providerOrderId: 'order_123',

    amountMinor: 100,

    currency: 'INR',

    status: 'captured',

    captured: true,
  };

  const walletEvidence = {
    id: 'deposit-1',

    paymentId: payment.id,

    providerPaymentId: payment.providerPaymentId,

    idempotencyKey: 'payment:' + payment.id,

    walletId: payment.walletId,

    amount: '1.00',

    currency: 'INR',

    reference: 'EXTERNAL-PAYMENT-' + payment.id,

    status: 'COMPLETED',

    completedAt: new Date().toISOString(),

    replayed: false,
  };

  function createHarness(options?: {
    paymentRows?: unknown[];
    providerPayments?: unknown[];
    walletResponse?: unknown;
    walletError?: Error;
    claimCount?: number;
    completionCount?: number;
    currentPayment?: unknown;
  }) {
    const paymentUpdateMany = jest.fn().mockImplementation(
      async (args: {
        data?: {
          status?: string;
        };
      }) => {
        if (args.data?.status === 'COMPLETED') {
          return {
            count: options?.completionCount ?? 1,
          };
        }

        return {
          count: options?.claimCount ?? 1,
        };
      },
    );

    const tx = {
      payment: {
        updateMany: paymentUpdateMany,

        findUnique: jest.fn().mockResolvedValue({
          userId: 'user-1',
        }),
      },

      outboxEvent: {
        create: jest.fn().mockResolvedValue({
          id: 'outbox-1',
        }),
      },
    };

    const prisma = {
      payment: {
        findMany: jest
          .fn()
          .mockResolvedValue(options?.paymentRows ?? [payment]),

        updateMany: jest.fn().mockResolvedValue({
          count: options?.claimCount ?? 1,
        }),

        findUnique: jest.fn().mockResolvedValue(
          options?.currentPayment ?? {
            status: 'COMPLETED',

            providerPaymentId: payment.providerPaymentId,
          },
        ),
      },

      $transaction: jest.fn(
        async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };

    const http = {
      post: jest.fn(),
    };

    if (options?.walletError) {
      http.post.mockReturnValue(throwError(() => options.walletError));
    } else {
      http.post.mockReturnValue(
        of({
          data: options?.walletResponse ?? walletEvidence,
        }),
      );
    }

    const paymentRail = {
      isConfigured: jest.fn().mockReturnValue(true),

      findPaymentsByOrderId: jest
        .fn()
        .mockResolvedValue(options?.providerPayments ?? [capturedEvidence]),
    };

    const service = new ExternalPaymentSettlementService(
      prisma as never,
      http as never,
      paymentRail as never,
    );

    process.env.PAYMENT_SETTLEMENT_INTERNAL_TOKEN = 'test-token';

    return {
      service,
      prisma,
      tx,
      http,
      paymentRail,
    };
  }

  afterEach(() => {
    delete process.env.PAYMENT_SETTLEMENT_INTERNAL_TOKEN;
  });

  it('settles one captured authorized payment and completes atomically', async () => {
    const harness = createHarness();

    await harness.service.settleExternalPayments();

    expect(harness.paymentRail.findPaymentsByOrderId).toHaveBeenCalledWith(
      payment.providerOrderId,
    );

    expect(harness.http.post).toHaveBeenCalledTimes(1);

    expect(harness.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('uses internal wallet settlement route with service token', async () => {
    const harness = createHarness();

    await harness.service.settleExternalPayments();

    expect(harness.http.post).toHaveBeenCalledWith(
      expect.stringContaining('/internal/settlements/payment'),

      expect.objectContaining({
        paymentId: payment.id,

        walletId: payment.walletId,

        providerPaymentId: payment.providerPaymentId,
      }),

      expect.objectContaining({
        headers: expect.objectContaining({
          'x-payflow-service-token': 'test-token',
        }),
      }),
    );
  });

  it('does not call wallet when provider evidence is not captured', async () => {
    const harness = createHarness({
      providerPayments: [
        {
          ...capturedEvidence,

          status: 'authorized',

          captured: false,
        },
      ],
    });

    await harness.service.settleExternalPayments();

    expect(harness.http.post).not.toHaveBeenCalled();
  });

  it('moves to NEEDS_REVIEW when captured evidence does not match amount', async () => {
    const harness = createHarness({
      providerPayments: [
        {
          ...capturedEvidence,

          amountMinor: 999,
        },
      ],
    });

    await harness.service.settleExternalPayments();

    expect(harness.http.post).not.toHaveBeenCalled();

    expect(harness.prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'NEEDS_REVIEW',
        }),
      }),
    );
  });

  it('preserves AUTHORIZED when wallet HTTP response is lost', async () => {
    const harness = createHarness({
      walletError: new Error('socket timeout'),
    });

    await harness.service.settleExternalPayments();

    expect(harness.http.post).toHaveBeenCalledTimes(1);

    expect(harness.tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('accepts replayed durable wallet evidence after a previous lost response', async () => {
    const harness = createHarness({
      walletResponse: {
        ...walletEvidence,

        replayed: true,
      },
    });

    await harness.service.settleExternalPayments();

    expect(harness.http.post).toHaveBeenCalledTimes(1);

    expect(harness.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('rejects mismatched wallet settlement evidence', async () => {
    const harness = createHarness({
      walletResponse: {
        ...walletEvidence,

        amount: '9.99',
      },
    });

    await harness.service.settleExternalPayments();

    expect(harness.tx.outboxEvent.create).not.toHaveBeenCalled();

    expect(harness.prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'NEEDS_REVIEW',
        }),
      }),
    );
  });

  it('losing the atomic work claim prevents provider and wallet activity', async () => {
    const harness = createHarness({
      claimCount: 0,
    });

    await harness.service.settleExternalPayments();

    expect(harness.paymentRail.findPaymentsByOrderId).not.toHaveBeenCalled();

    expect(harness.http.post).not.toHaveBeenCalled();
  });

  it('treats concurrent completion winner as safe replay', async () => {
    const harness = createHarness({
      completionCount: 0,

      currentPayment: {
        status: 'COMPLETED',

        providerPaymentId: payment.providerPaymentId,
      },
    });

    await harness.service.settleExternalPayments();

    expect(harness.http.post).toHaveBeenCalledTimes(1);

    expect(harness.prisma.payment.findUnique).toHaveBeenCalled();
  });

  it('never creates a provider order during settlement', async () => {
    const harness = createHarness();

    await harness.service.settleExternalPayments();

    expect(
      (
        harness.paymentRail as {
          createOrder?: jest.Mock;
        }
      ).createOrder,
    ).toBeUndefined();
  });

  it('does nothing when there are no authorized payments', async () => {
    const harness = createHarness({
      paymentRows: [],
    });

    await harness.service.settleExternalPayments();

    expect(harness.http.post).not.toHaveBeenCalled();

    expect(harness.paymentRail.findPaymentsByOrderId).not.toHaveBeenCalled();
  });
});
