import {
  Module,
} from '@nestjs/common';

import {
  PrismaModule,
} from '@payflow/database';

import {
  PaymentsController,
} from './payments.controller';

import {
  PaymentsService,
} from './payments.service';

import {
  RazorpayService,
} from './razorpay/razorpay.service';

@Module({
  imports: [
    PrismaModule,
  ],

  controllers: [
    PaymentsController,
  ],

  providers: [
    PaymentsService,
    RazorpayService,
  ],

  exports: [
    PaymentsService,
    RazorpayService,
  ],
})
export class PaymentsModule {}