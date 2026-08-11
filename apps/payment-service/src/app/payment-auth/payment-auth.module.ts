import {
  Module,
} from '@nestjs/common';
import {
  PassportModule,
} from '@nestjs/passport';

import {
  PaymentJwtAuthGuard,
} from './guards/payment-jwt-auth.guard';
import {
  PaymentJwtStrategy,
} from './strategies/payment-jwt.strategy';

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: 'payment-jwt',
    }),
  ],

  providers: [
    PaymentJwtStrategy,
    PaymentJwtAuthGuard,
  ],

  exports: [
    PassportModule,
    PaymentJwtAuthGuard,
  ],
})
export class PaymentAuthModule {}
