import {
  MockPaymentModule,
} from './mock-payment/mock-payment.module';
import {
  RazorpayModule,
} from '../app/razorpay/razorpay.module';
import {
  Module,
} from '@nestjs/common';

import {
  HealthController,
} from './health.controller';

import {
  PaymentsModule,
} from './payments/payments.module';

@Module({
  imports: [
    MockPaymentModule,
    RazorpayModule,
    PaymentsModule,
  ],

  controllers: [
    HealthController,
  ],
})
export class AppModule {}