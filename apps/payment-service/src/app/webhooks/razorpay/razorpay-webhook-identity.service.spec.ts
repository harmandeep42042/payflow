import { RazorpayWebhookIdentityService } from './razorpay-webhook-identity.service';

describe('RazorpayWebhookIdentityService', () => {
  const service = new RazorpayWebhookIdentityService();

  it('uses a supplied provider event id', () => {
    expect(
      service.eventId(
        Buffer.from('{}'),
        'event_123',
      ),
    ).toBe('event_123');
  });

  it('uses a deterministic payload hash as fallback', () => {
    const body = Buffer.from(
      '{"event":"payment.captured"}',
    );

    expect(
      service.eventId(body),
    ).toBe(service.payloadHash(body));
  });

  it('changes the hash when raw bytes change', () => {
    expect(
      service.payloadHash(Buffer.from('{"a":1}')),
    ).not.toBe(
      service.payloadHash(Buffer.from('{"a":2}')),
    );
  });
});