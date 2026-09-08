import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { RazorpayWebhookSignatureService } from './razorpay-webhook-signature.service';

describe('RazorpayWebhookSignatureService', () => {
  const originalSecret =
    process.env.RAZORPAY_WEBHOOK_SECRET;

  const originalCurrentSecret =
    process.env.RAZORPAY_WEBHOOK_SECRET_CURRENT;

  const originalPreviousSecret =
    process.env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS;

  beforeEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET_CURRENT;
    delete process.env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
    } else {
      process.env.RAZORPAY_WEBHOOK_SECRET =
        originalSecret;
    }

    if (originalCurrentSecret === undefined) {
      delete process.env.RAZORPAY_WEBHOOK_SECRET_CURRENT;
    } else {
      process.env.RAZORPAY_WEBHOOK_SECRET_CURRENT =
        originalCurrentSecret;
    }

    if (originalPreviousSecret === undefined) {
      delete process.env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS;
    } else {
      process.env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS =
        originalPreviousSecret;
    }
  });

  it('accepts an authentic HMAC signature', () => {
    process.env.RAZORPAY_WEBHOOK_SECRET =
      'test-webhook-secret';

    const rawBody = Buffer.from(
      '{"event":"payment.captured"}',
      'utf8',
    );

    const signature = createHmac(
      'sha256',
      'test-webhook-secret',
    )
      .update(rawBody)
      .digest('hex');

    const service =
      new RazorpayWebhookSignatureService();

    expect(() =>
      service.verify(rawBody, signature),
    ).not.toThrow();
  });

  it('rejects a missing signature', () => {
    process.env.RAZORPAY_WEBHOOK_SECRET =
      'test-webhook-secret';

    const service =
      new RazorpayWebhookSignatureService();

    expect(() =>
      service.verify(Buffer.from('{}')),
    ).toThrow(UnauthorizedException);
  });

  it('rejects an invalid signature', () => {
    process.env.RAZORPAY_WEBHOOK_SECRET =
      'test-webhook-secret';

    const service =
      new RazorpayWebhookSignatureService();

    expect(() =>
      service.verify(
        Buffer.from('{}'),
        'invalid-signature',
      ),
    ).toThrow(UnauthorizedException);
  });

  it('fails closed when the webhook secret is absent', () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const service =
      new RazorpayWebhookSignatureService();

    expect(() =>
      service.verify(
        Buffer.from('{}'),
        'anything',
      ),
    ).toThrow(ServiceUnavailableException);
  });

  it('rejects a signature created for different raw bytes', () => {
    process.env.RAZORPAY_WEBHOOK_SECRET =
      'test-webhook-secret';

    const signedBody =
      Buffer.from('{"amount":100}');

    const changedBody =
      Buffer.from('{"amount":200}');

    const signature = createHmac(
      'sha256',
      'test-webhook-secret',
    )
      .update(signedBody)
      .digest('hex');

    const service =
      new RazorpayWebhookSignatureService();

    expect(() =>
      service.verify(changedBody, signature),
    ).toThrow(UnauthorizedException);
  });

  it('supports previous webhook signatures during secret rotation', () => {
    const legacySecret =
      'legacy-webhook-secret';

    const currentSecret =
      'current-webhook-secret';

    const rawBody = Buffer.from(
      '{"event":"payment.captured","amount":100}',
      'utf8',
    );

    const tamperedBody = Buffer.from(
      '{"event":"payment.captured","amount":999}',
      'utf8',
    );

    const service =
      new RazorpayWebhookSignatureService();

    // PHASE A:
    // Legacy secret only.
    process.env.RAZORPAY_WEBHOOK_SECRET =
      legacySecret;

    delete process.env.RAZORPAY_WEBHOOK_SECRET_CURRENT;
    delete process.env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS;

    const legacySignature = createHmac(
      'sha256',
      legacySecret,
    )
      .update(rawBody)
      .digest('hex');

    expect(() =>
      service.verify(
        rawBody,
        legacySignature,
      ),
    ).not.toThrow();

    // PHASE B:
    // New secret becomes current.
    // Legacy secret becomes previous.
    process.env.RAZORPAY_WEBHOOK_SECRET_CURRENT =
      currentSecret;

    process.env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS =
      legacySecret;

    expect(() =>
      service.verify(
        rawBody,
        legacySignature,
      ),
    ).not.toThrow();

    const currentSignature = createHmac(
      'sha256',
      currentSecret,
    )
      .update(rawBody)
      .digest('hex');

    expect(() =>
      service.verify(
        rawBody,
        currentSignature,
      ),
    ).not.toThrow();

    expect(() =>
      service.verify(
        tamperedBody,
        currentSignature,
      ),
    ).toThrow(UnauthorizedException);

    // PHASE C:
    // Previous secret is retired.
    delete process.env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS;

    expect(() =>
      service.verify(
        rawBody,
        legacySignature,
      ),
    ).toThrow(UnauthorizedException);

    expect(() =>
      service.verify(
        rawBody,
        currentSignature,
      ),
    ).not.toThrow();
  });
});
