import {
  Module,
} from '@nestjs/common';
import {
  ScheduleModule,
} from '@nestjs/schedule';

import {
  HealthController,
} from './health.controller';
import {
  MockPaymentModule,
} from './mock-payment/mock-payment.module';
import {
  OutboxModule,
} from './outbox/outbox.module';
import {
  PaymentsModule,
} from './payments/payments.module';
import {
  RazorpayModule,
} from './razorpay/razorpay.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MockPaymentModule,
    RazorpayModule,
    PaymentsModule,
    OutboxModule,
  ],

  controllers: [
    HealthController,
  ],
})
export class AppModule {}
