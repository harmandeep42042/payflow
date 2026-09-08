import { FindRailPaymentResult } from '../../payment-rails/payment-rail-provider';

import { decideExternalPaymentReconciliation } from './external-payment-reconciliation.policy';

describe('external payment reconciliation policy', () => {
  const intent = {
    providerOrderId: 'order_123',
    amountInPaise: 100,
    currency: 'INR',
  };

  function payment(
    overrides: Partial<FindRailPaymentResult> = {},
  ): FindRailPaymentResult {
    return {
      provider: 'RAZORPAY',
      providerPaymentId: 'pay_123',
      providerOrderId: 'order_123',
      amountMinor: 100,
      currency: 'INR',
      status: 'created',
      captured: false,
      ...overrides,
    };
  }

  it('keeps ORDER_CREATED when no payment evidence exists', () => {
    expect(decideExternalPaymentReconciliation(intent, [])).toEqual({
      status: 'ORDER_CREATED',
    });
  });

  it('maps one matching authorized payment to AUTHORIZED', () => {
    expect(
      decideExternalPaymentReconciliation(intent, [
        payment({
          status: 'authorized',
        }),
      ]),
    ).toEqual({
      status: 'AUTHORIZED',
      providerPaymentId: 'pay_123',
    });
  });

  it('maps captured evidence to AUTHORIZED but never COMPLETED', () => {
    const result = decideExternalPaymentReconciliation(intent, [
      payment({
        status: 'captured',
        captured: true,
      }),
    ]);

    expect(result.status).toBe('AUTHORIZED');

    expect(result.status).not.toBe('COMPLETED');
  });

  it('requires review for multiple successful provider payments', () => {
    const result = decideExternalPaymentReconciliation(intent, [
      payment({
        providerPaymentId: 'pay_1',
        status: 'authorized',
      }),
      payment({
        providerPaymentId: 'pay_2',
        status: 'captured',
        captured: true,
      }),
    ]);

    expect(result.status).toBe('NEEDS_REVIEW');
  });

  it('requires review for amount mismatch', () => {
    const result = decideExternalPaymentReconciliation(intent, [
      payment({
        amountMinor: 999,
        status: 'authorized',
      }),
    ]);

    expect(result.status).toBe('NEEDS_REVIEW');
  });

  it('requires review for currency mismatch', () => {
    const result = decideExternalPaymentReconciliation(intent, [
      payment({
        currency: 'USD',
        status: 'authorized',
      }),
    ]);

    expect(result.status).toBe('NEEDS_REVIEW');
  });

  it('requires review for provider order mismatch', () => {
    const result = decideExternalPaymentReconciliation(intent, [
      payment({
        providerOrderId: 'order_wrong',
        status: 'authorized',
      }),
    ]);

    expect(result.status).toBe('NEEDS_REVIEW');
  });

  it('requires review for refunded provider evidence', () => {
    const result = decideExternalPaymentReconciliation(intent, [
      payment({
        status: 'refunded',
      }),
    ]);

    expect(result.status).toBe('NEEDS_REVIEW');
  });

  it('does not authorize from failed attempt evidence', () => {
    expect(
      decideExternalPaymentReconciliation(intent, [
        payment({
          status: 'failed',
        }),
      ]).status,
    ).toBe('ORDER_CREATED');
  });

  it('does not authorize from created attempt evidence', () => {
    expect(
      decideExternalPaymentReconciliation(intent, [
        payment({
          status: 'created',
        }),
      ]).status,
    ).toBe('ORDER_CREATED');
  });

  it('treats duplicate copies of the same successful payment as one payment', () => {
    const evidence = payment({
      providerPaymentId: 'pay_same',
      status: 'authorized',
    });

    expect(
      decideExternalPaymentReconciliation(intent, [
        evidence,
        {
          ...evidence,
        },
      ]),
    ).toEqual({
      status: 'AUTHORIZED',
      providerPaymentId: 'pay_same',
    });
  });
});
