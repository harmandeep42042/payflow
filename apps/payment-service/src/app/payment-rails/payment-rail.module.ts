import { Module } from '@nestjs/common';

import { PAYMENT_RAIL_PROVIDER } from './payment-rail.tokens';
import { RazorpayPaymentRailAdapter } from './razorpay-payment-rail.adapter';

import { UPI_RAIL_PROVIDER } from './upi-rail.tokens';
import { UnconfiguredUpiRailAdapter } from './unconfigured-upi-rail.adapter';

@Module({
  providers: [
    RazorpayPaymentRailAdapter,
    {
      provide: PAYMENT_RAIL_PROVIDER,
      useExisting: RazorpayPaymentRailAdapter,
    },

    UnconfiguredUpiRailAdapter,
    {
      provide: UPI_RAIL_PROVIDER,
      useExisting: UnconfiguredUpiRailAdapter,
    },
  ],

  exports: [
    PAYMENT_RAIL_PROVIDER,
    RazorpayPaymentRailAdapter,

    UPI_RAIL_PROVIDER,
    UnconfiguredUpiRailAdapter,
  ],
})
export class PaymentRailModule {}