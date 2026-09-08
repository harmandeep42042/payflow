import {
  createOperationalLog,
  serializeOperationalLog,
} from './operational-log';

describe('Operational logging', () => {
  it('creates a structured payment log record', () => {
    expect(
      createOperationalLog('payment.reconciliation.completed', {
        correlationId: 'gateway-context-123',
        paymentId: 'payment-123',
        providerOrderId: 'order-123',
        attempts: 2,
        status: 'COMPLETED',
        outcome: 'authoritative-success',
      }),
    ).toEqual({
      event: 'payment.reconciliation.completed',
      correlationId: 'gateway-context-123',
      paymentId: 'payment-123',
      providerOrderId: 'order-123',
      attempts: 2,
      status: 'COMPLETED',
      outcome: 'authoritative-success',
    });
  });

  it('serializes a machine-readable JSON record', () => {
    const serialized = serializeOperationalLog('webhook.claimed', {
      webhookEventId: 'webhook-123',
      providerEventId: 'provider-event-123',
      status: 'PROCESSING',
    });

    expect(JSON.parse(serialized)).toEqual({
      event: 'webhook.claimed',
      webhookEventId: 'webhook-123',
      providerEventId: 'provider-event-123',
      status: 'PROCESSING',
    });
  });

  it('omits unavailable optional fields instead of inventing correlation data', () => {
    expect(
      createOperationalLog('rabbitmq.publish.completed', {
        eventId: 'event-123',
      }),
    ).toEqual({
      event: 'rabbitmq.publish.completed',
      eventId: 'event-123',
    });
  });

  it('normalizes control characters from text fields', () => {
    expect(
      createOperationalLog('provider.failure', {
        reason: 'provider\r\nfailure',
      }),
    ).toEqual({
      event: 'provider.failure',
      reason: 'provider  failure',
    });
  });

  it('rejects an empty event name', () => {
    expect(() => createOperationalLog('   ')).toThrow(
      'Operational log event is required.',
    );
  });

  it('does not accept arbitrary credential fields through the typed contract', () => {
    const record = createOperationalLog('payment.test', {
      paymentId: 'payment-123',
    });

    expect(record).not.toHaveProperty('authorization');

    expect(record).not.toHaveProperty('token');

    expect(record).not.toHaveProperty('password');

    expect(record).not.toHaveProperty('secret');
  });
});
