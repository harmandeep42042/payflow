import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  payflowConfig,
} from '@payflow/shared-config';

import Razorpay from 'razorpay';

type CreateProviderOrderInput = {
  amountInPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
};

@Injectable()
export class RazorpayService {
  private readonly client:
    Razorpay | null;

  constructor() {
    const {
      enabled,
      keyId,
      keySecret,
    } = payflowConfig.razorpay;

    this.client =
      enabled &&
      keyId &&
      keySecret
        ? new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
          })
        : null;
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  getPublicKeyId(): string {
    return payflowConfig.razorpay.keyId;
  }

  async createOrder(
    input: CreateProviderOrderInput,
  ) {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Razorpay is not configured',
      );
    }

    return this.client.orders.create({
      amount:
        input.amountInPaise,

      currency:
        input.currency
          .trim()
          .toUpperCase(),

      receipt:
        input.receipt,

      notes:
        input.notes,
    });
  }
}