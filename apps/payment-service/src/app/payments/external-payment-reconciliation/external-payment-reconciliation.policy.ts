import { FindRailPaymentResult } from '../../payment-rails/payment-rail-provider';

export type ExternalPaymentReconciliationStatus =
  | 'ORDER_CREATED'
  | 'AUTHORIZED'
  | 'NEEDS_REVIEW';

export interface ExternalPaymentIntentEvidence {
  providerOrderId: string;
  amountInPaise: number;
  currency: string;
}

export interface ExternalPaymentReconciliationDecision {
  status: ExternalPaymentReconciliationStatus;
  providerPaymentId?: string;
  reason?: string;
}

export function decideExternalPaymentReconciliation(
  intent: ExternalPaymentIntentEvidence,
  payments: FindRailPaymentResult[],
): ExternalPaymentReconciliationDecision {
  if (payments.length === 0) {
    return {
      status: 'ORDER_CREATED',
    };
  }

  const normalizedCurrency = intent.currency.toUpperCase();

  const mismatchedEvidence = payments.some((payment) => {
    const orderMatches = payment.providerOrderId === intent.providerOrderId;

    const amountMatches = payment.amountMinor === intent.amountInPaise;

    const currencyMatches =
      payment.currency.toUpperCase() === normalizedCurrency;

    return !orderMatches || !amountMatches || !currencyMatches;
  });

  if (mismatchedEvidence) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'Provider payment evidence does not match durable payment intent',
    };
  }

  const refundedEvidence = payments.some(
    (payment) => payment.status.toLowerCase() === 'refunded',
  );

  if (refundedEvidence) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'Refunded provider payment requires explicit reconciliation',
    };
  }

  const successfulPayments = payments.filter((payment) => {
    const status = payment.status.toLowerCase();

    return (
      status === 'authorized' ||
      status === 'captured' ||
      payment.captured === true
    );
  });

  const distinctSuccessfulPayments = new Map(
    successfulPayments.map((payment) => [payment.providerPaymentId, payment]),
  );

  if (distinctSuccessfulPayments.size > 1) {
    return {
      status: 'NEEDS_REVIEW',
      reason:
        'Multiple successful provider payments require manual reconciliation',
    };
  }

  if (distinctSuccessfulPayments.size === 1) {
    const payment = Array.from(distinctSuccessfulPayments.values())[0];

    return {
      status: 'AUTHORIZED',
      providerPaymentId: payment.providerPaymentId,
    };
  }

  /*
   * "created" and "failed" provider attempts do not
   * prove successful money movement.
   *
   * The Razorpay order remains a valid durable order,
   * so Payflow does not falsely authorize or complete it.
   */
  return {
    status: 'ORDER_CREATED',
  };
}
