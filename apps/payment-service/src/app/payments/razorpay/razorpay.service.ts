import type {
  PaymentRailProvider,
} from '../../payment-rails/payment-rail-provider';

import {
  PAYMENT_RAIL_PROVIDER,
} from '../../payment-rails/payment-rail.tokens';
import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  payflowConfig,
} from '@payflow/shared-config';


type CreateProviderOrderInput = {
  amountInPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
};

@Injectable()
export class RazorpayService {
  constructor(
    @Inject(PAYMENT_RAIL_PROVIDER)
    private readonly paymentRail: PaymentRailProvider,
  ) {}


  isEnabled(): boolean {
    return this.paymentRail.isConfigured();
  }

  getPublicKeyId(): string {
    return payflowConfig.razorpay.keyId;
  }

  async createOrder(
    input: CreateProviderOrderInput,
  ) {
    if (!this.paymentRail.isConfigured()) {
      throw new ServiceUnavailableException(
        'Razorpay is not configured',
      );
    }

    const railOrder =
      await this.paymentRail.createOrder({
        amountMinor: input.amountInPaise,
        currency: input.currency
          .trim()
          .toUpperCase(),
        receipt: input.receipt,
        notes: input.notes,
      });

    return (
      railOrder.raw ?? {
        id: railOrder.providerOrderId,
        amount: railOrder.amountMinor,
        currency: railOrder.currency,
        status: railOrder.status,
      }
    );
  }
}