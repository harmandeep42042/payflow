export type PaymentLifecycleStatus =
  | 'CREATED'
  | 'PROCESSING'
  | 'ORDER_CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'COMPLETED'
  | 'FAILED'
  | 'NEEDS_REVIEW'
  | 'CANCELLED'
  | 'REFUNDED';

const transitions: Readonly<
  Record<
    PaymentLifecycleStatus,
    readonly PaymentLifecycleStatus[]
  >
> = {
  CREATED: [
    'PROCESSING',
    'FAILED',
    'NEEDS_REVIEW',
    'CANCELLED',
  ],

  PROCESSING: [
    'ORDER_CREATED',
    'PENDING',
    'AUTHORIZED',
    'FAILED',
    'NEEDS_REVIEW',
  ],

  ORDER_CREATED: [
    'PENDING',
    'AUTHORIZED',
    'FAILED',
    'NEEDS_REVIEW',
    'CANCELLED',
  ],

  PENDING: [
    'AUTHORIZED',
    'FAILED',
    'NEEDS_REVIEW',
    'CANCELLED',
  ],

  AUTHORIZED: [
    'COMPLETED',
    'FAILED',
    'NEEDS_REVIEW',
  ],

  COMPLETED: [
    'REFUNDED',
    'NEEDS_REVIEW',
  ],

  FAILED: [
    'NEEDS_REVIEW',
  ],

  NEEDS_REVIEW: [
    'PROCESSING',
    'ORDER_CREATED',
    'PENDING',
    'AUTHORIZED',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'REFUNDED',
  ],

  CANCELLED: [
    'NEEDS_REVIEW',
  ],

  REFUNDED: [
    'NEEDS_REVIEW',
  ],
};

export class InvalidPaymentStateTransitionError
  extends Error
{
  constructor(
    readonly from: PaymentLifecycleStatus,
    readonly to: PaymentLifecycleStatus,
  ) {
    super(
      `Illegal payment state transition: ${from} -> ${to}`,
    );

    this.name =
      'InvalidPaymentStateTransitionError';
  }
}

export function canTransitionPayment(
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus,
): boolean {
  if (from === to) {
    return true;
  }

  return transitions[from].includes(to);
}

export function assertPaymentTransition(
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus,
): void {
  if (!canTransitionPayment(from, to)) {
    throw new InvalidPaymentStateTransitionError(
      from,
      to,
    );
  }
}

export function isPaymentTerminalState(
  status: PaymentLifecycleStatus,
): boolean {
  return (
    status === 'COMPLETED' ||
    status === 'FAILED' ||
    status === 'CANCELLED' ||
    status === 'REFUNDED'
  );
}

export function allowedPaymentTransitions(
  status: PaymentLifecycleStatus,
): readonly PaymentLifecycleStatus[] {
  return transitions[status];
}