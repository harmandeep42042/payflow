import {
  Module,
} from '@nestjs/common';

import {
  MockPaymentController,
} from './mock-payment.controller';

import {
  MockPaymentService,
} from './mock-payment.service';

@Module({
  controllers: [
    MockPaymentController,
  ],

  providers: [
    MockPaymentService,
  ],

  exports: [
    MockPaymentService,
  ],
})
export class MockPaymentModule {}