import {
  InvalidPaymentStateTransitionError,
  allowedPaymentTransitions,
  assertPaymentTransition,
  canTransitionPayment,
  isPaymentTerminalState,
} from './payment-state-machine';

describe('PaymentStateMachine', () => {
  it('allows normal payment progression', () => {
    expect(
      canTransitionPayment(
        'CREATED',
        'PROCESSING',
      ),
    ).toBe(true);

    expect(
      canTransitionPayment(
        'PROCESSING',
        'ORDER_CREATED',
      ),
    ).toBe(true);

    expect(
      canTransitionPayment(
        'ORDER_CREATED',
        'PENDING',
      ),
    ).toBe(true);

    expect(
      canTransitionPayment(
        'PENDING',
        'AUTHORIZED',
      ),
    ).toBe(true);

    expect(
      canTransitionPayment(
        'AUTHORIZED',
        'COMPLETED',
      ),
    ).toBe(true);
  });

  it('allows idempotent same-state observation', () => {
    expect(
      canTransitionPayment(
        'COMPLETED',
        'COMPLETED',
      ),
    ).toBe(true);
  });

  it('blocks backward completion transitions', () => {
    expect(
      canTransitionPayment(
        'COMPLETED',
        'PROCESSING',
      ),
    ).toBe(false);

    expect(() =>
      assertPaymentTransition(
        'COMPLETED',
        'PROCESSING',
      ),
    ).toThrow(
      InvalidPaymentStateTransitionError,
    );
  });

  it('does not blindly resurrect failed payments', () => {
    expect(
      canTransitionPayment(
        'FAILED',
        'COMPLETED',
      ),
    ).toBe(false);

    expect(
      canTransitionPayment(
        'FAILED',
        'AUTHORIZED',
      ),
    ).toBe(false);

    expect(
      canTransitionPayment(
        'FAILED',
        'NEEDS_REVIEW',
      ),
    ).toBe(true);
  });

  it('requires review before reopening cancelled payments', () => {
    expect(
      allowedPaymentTransitions(
        'CANCELLED',
      ),
    ).toEqual([
      'NEEDS_REVIEW',
    ]);
  });

  it('allows settlement ambiguity to park in review', () => {
    expect(
      canTransitionPayment(
        'AUTHORIZED',
        'NEEDS_REVIEW',
      ),
    ).toBe(true);

    expect(
      canTransitionPayment(
        'COMPLETED',
        'NEEDS_REVIEW',
      ),
    ).toBe(true);
  });

  it('classifies durable end states', () => {
    expect(
      isPaymentTerminalState('COMPLETED'),
    ).toBe(true);

    expect(
      isPaymentTerminalState('FAILED'),
    ).toBe(true);

    expect(
      isPaymentTerminalState('CANCELLED'),
    ).toBe(true);

    expect(
      isPaymentTerminalState('REFUNDED'),
    ).toBe(true);

    expect(
      isPaymentTerminalState('NEEDS_REVIEW'),
    ).toBe(false);

    expect(
      isPaymentTerminalState('AUTHORIZED'),
    ).toBe(false);
  });

  it('allows controlled review resolution', () => {
    expect(
      canTransitionPayment(
        'NEEDS_REVIEW',
        'AUTHORIZED',
      ),
    ).toBe(true);

    expect(
      canTransitionPayment(
        'NEEDS_REVIEW',
        'COMPLETED',
      ),
    ).toBe(true);

    expect(
      canTransitionPayment(
        'NEEDS_REVIEW',
        'FAILED',
      ),
    ).toBe(true);
  });
});