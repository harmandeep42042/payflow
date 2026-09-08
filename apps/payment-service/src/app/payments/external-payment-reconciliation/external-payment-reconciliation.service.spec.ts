jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import { ExternalPaymentReconciliationService } from './external-payment-reconciliation.service';

describe('ExternalPaymentReconciliationService', () => {
  const basePayment = {
    id: 'payment-1',
    provider: 'RAZORPAY',
    status: 'ORDER_CREATED',
    providerOrderId: 'order_123',
    providerPaymentId: null as string | null,
    amountInPaise: 100,
    currency: 'INR',
    lastRecoveryAt: null as Date | null,
    recoveryAttempts: 0,
    updatedAt: new Date(Date.now() - 10 * 60 * 1000),
    authorizedAt: null as Date | null,
    failureReason: null as string | null,
  };

  function createHarness(options?: {
    providerPayments?: unknown[];
    providerError?: Error;
    initialStatus?: 'ORDER_CREATED' | 'NEEDS_REVIEW';
  }) {
    let currentPayment = {
      ...basePayment,
      status: options?.initialStatus ?? 'ORDER_CREATED',
    };

    const payment = {
      findMany: jest.fn().mockResolvedValue([currentPayment]),

      updateMany: jest
        .fn()
        .mockImplementation(
          async ({
            where,
            data,
          }: {
            where: Record<string, unknown>;
            data: Record<string, unknown>;
          }) => {
            if (where.id && where.id !== currentPayment.id) {
              return {
                count: 0,
              };
            }

            const nextData = {
              ...data,
            } as Record<string, unknown>;

            if (
              nextData.recoveryAttempts &&
              typeof nextData.recoveryAttempts === 'object' &&
              nextData.recoveryAttempts !== null &&
              'increment' in nextData.recoveryAttempts
            ) {
              nextData.recoveryAttempts =
                currentPayment.recoveryAttempts +
                Number(
                  (
                    nextData.recoveryAttempts as {
                      increment: number;
                    }
                  ).increment,
                );
            }

            currentPayment = {
              ...currentPayment,
              ...nextData,
            };

            return {
              count: 1,
            };
          },
        ),
    };

    const prisma = {
      payment,
    };

    const rail = {
      name: 'RAZORPAY',

      isConfigured: jest.fn().mockReturnValue(true),

      createOrder: jest.fn(),

      findOrderByReceipt: jest.fn(),

      findPaymentsByOrderId: options?.providerError
        ? jest.fn().mockRejectedValue(options.providerError)
        : jest.fn().mockResolvedValue(options?.providerPayments ?? []),
    };

    const service = new ExternalPaymentReconciliationService(
      prisma as never,
      rail as never,
    );

    return {
      service,
      prisma,
      rail,
      getPayment: () => currentPayment,
    };
  }

  function providerPayment(overrides: Record<string, unknown> = {}) {
    return {
      provider: 'RAZORPAY',
      providerPaymentId: 'pay_123',
      providerOrderId: 'order_123',
      amountMinor: 100,
      currency: 'INR',
      status: 'authorized',
      captured: false,
      ...overrides,
    };
  }

  it('maps matching authorized payment to AUTHORIZED', async () => {
    const harness = createHarness({
      providerPayments: [providerPayment()],
    });

    await harness.service.reconcileExternalPayments();

    expect(harness.rail.findPaymentsByOrderId).toHaveBeenCalledWith(
      'order_123',
    );

    expect(harness.getPayment().status).toBe('AUTHORIZED');

    expect(harness.getPayment().providerPaymentId).toBe('pay_123');

    expect(harness.getPayment().authorizedAt).toBeInstanceOf(Date);
  });

  it('maps captured payment only to AUTHORIZED', async () => {
    const harness = createHarness({
      providerPayments: [
        providerPayment({
          status: 'captured',
          captured: true,
        }),
      ],
    });

    await harness.service.reconcileExternalPayments();

    expect(harness.getPayment().status).toBe('AUTHORIZED');

    expect(harness.getPayment().status).not.toBe('COMPLETED');
  });

  it('keeps ORDER_CREATED when only failed evidence exists', async () => {
    const harness = createHarness({
      providerPayments: [
        providerPayment({
          status: 'failed',
          captured: false,
        }),
      ],
    });

    await harness.service.reconcileExternalPayments();

    expect(harness.getPayment().status).toBe('ORDER_CREATED');
  });

  it('keeps ORDER_CREATED when no payment evidence exists', async () => {
    const harness = createHarness({
      providerPayments: [],
    });

    await harness.service.reconcileExternalPayments();

    expect(harness.getPayment().status).toBe('ORDER_CREATED');
  });

  it('moves amount mismatch to NEEDS_REVIEW', async () => {
    const harness = createHarness({
      providerPayments: [
        providerPayment({
          amountMinor: 999,
        }),
      ],
    });

    await harness.service.reconcileExternalPayments();

    expect(harness.getPayment().status).toBe('NEEDS_REVIEW');
  });

  it('moves currency mismatch to NEEDS_REVIEW', async () => {
    const harness = createHarness({
      providerPayments: [
        providerPayment({
          currency: 'USD',
        }),
      ],
    });

    await harness.service.reconcileExternalPayments();

    expect(harness.getPayment().status).toBe('NEEDS_REVIEW');
  });

  it('moves order mismatch to NEEDS_REVIEW', async () => {
    const harness = createHarness({
      providerPayments: [
        providerPayment({
          providerOrderId: 'order_wrong',
        }),
      ],
    });

    await harness.service.reconcileExternalPayments();

    expect(harness.getPayment().status).toBe('NEEDS_REVIEW');
  });

  it('moves multiple successful payments to NEEDS_REVIEW', async () => {
    const harness = createHarness({
      providerPayments: [
        providerPayment({
          providerPaymentId: 'pay_1',
          status: 'authorized',
        }),
        providerPayment({
          providerPaymentId: 'pay_2',
          status: 'captured',
          captured: true,
        }),
      ],
    });

    await harness.service.reconcileExternalPayments();

    expect(harness.getPayment().status).toBe('NEEDS_REVIEW');
  });

  it('moves refunded evidence to NEEDS_REVIEW', async () => {
    const harness = createHarness({
      providerPayments: [
        providerPayment({
          status: 'refunded',
        }),
      ],
    });

    await harness.service.reconcileExternalPayments();

    expect(harness.getPayment().status).toBe('NEEDS_REVIEW');
  });

  it('preserves durable state when provider read fails', async () => {
    const harness = createHarness({
      providerError: new Error('provider unavailable'),
    });

    await harness.service.reconcileExternalPayments();

    expect(harness.getPayment().status).toBe('ORDER_CREATED');

    expect(harness.rail.createOrder).not.toHaveBeenCalled();
  });

  it('can recover eligible NEEDS_REVIEW back to AUTHORIZED', async () => {
    const harness = createHarness({
      initialStatus: 'NEEDS_REVIEW',

      providerPayments: [
        providerPayment({
          status: 'authorized',
        }),
      ],
    });

    await harness.service.reconcileExternalPayments();

    expect(harness.getPayment().status).toBe('AUTHORIZED');

    expect(harness.getPayment().providerPaymentId).toBe('pay_123');
  });

  it('never creates provider order during reconciliation', async () => {
    const harness = createHarness({
      providerPayments: [providerPayment()],
    });

    await harness.service.reconcileExternalPayments();

    expect(harness.rail.createOrder).not.toHaveBeenCalled();
  });

  it('increments reconciliation attempt counter', async () => {
    const harness = createHarness({
      providerPayments: [],
    });

    await harness.service.reconcileExternalPayments();

    expect(harness.getPayment().recoveryAttempts).toBe(1);
  });
});
