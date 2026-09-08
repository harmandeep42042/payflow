import { PaymentRailModule } from '../payment-rails/payment-rail.module';
import {
  Module,
} from '@nestjs/common';

import {
  RazorpayController,
} from './razorpay.controller';

import {
  RazorpayService,
} from './razorpay.service';

@Module({
  imports: [
    PaymentRailModule,
  ],
  controllers: [
    RazorpayController,
  ],

  providers: [
    RazorpayService,
  ],

  exports: [
    RazorpayService,
  ],
})
export class RazorpayModule {}