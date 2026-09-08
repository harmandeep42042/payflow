import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

@Injectable()
export class RazorpayWebhookIdentityService {
  payloadHash(rawBody: Buffer): string {
    return createHash('sha256')
      .update(rawBody)
      .digest('hex');
  }

  eventId(
    rawBody: Buffer,
    suppliedEventId?: string,
  ): string {
    const normalized = suppliedEventId?.trim();

    if (normalized) {
      return normalized;
    }

    // Deterministic fallback provides replay protection even when
    // the provider event identifier is unavailable.
    return this.payloadHash(rawBody);
  }
}