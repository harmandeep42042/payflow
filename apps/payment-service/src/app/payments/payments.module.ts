import {
  Module,
} from '@nestjs/common';

import {
  HttpModule,
} from '@nestjs/axios';

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

    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
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
