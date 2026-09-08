import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class RazorpayWebhookSignatureService {
  private verificationSecrets(): string[] {
    const current =
      process.env.RAZORPAY_WEBHOOK_SECRET_CURRENT ??
      process.env.RAZORPAY_WEBHOOK_SECRET;

    const previous =
      process.env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS;

    if (!current) {
      throw new ServiceUnavailableException(
        'Webhook verification is not configured',
      );
    }

    if (previous && previous !== current) {
      return [current, previous];
    }

    return [current];
  }

  verify(rawBody: Buffer, suppliedSignature?: string): void {
    const secrets = this.verificationSecrets();

    if (!suppliedSignature) {
      throw new UnauthorizedException('Webhook signature is required');
    }

    const suppliedBuffer = Buffer.from(
      suppliedSignature.trim(),
      'utf8',
    );

    let signatureIsValid = false;

    for (const secret of secrets) {
      const expected = createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const expectedBuffer = Buffer.from(expected, 'utf8');

      const matches =
        expectedBuffer.length === suppliedBuffer.length &&
        timingSafeEqual(expectedBuffer, suppliedBuffer);

      signatureIsValid =
        matches || signatureIsValid;
    }

    if (!signatureIsValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
