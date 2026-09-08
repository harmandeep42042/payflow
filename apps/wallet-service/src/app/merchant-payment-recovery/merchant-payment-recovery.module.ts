import { Module } from '@nestjs/common';

import { PrismaModule } from '@payflow/database';

import { MerchantPaymentRecoveryService } from './merchant-payment-recovery.service';

@Module({
  imports: [PrismaModule],
  providers: [MerchantPaymentRecoveryService],
})
export class MerchantPaymentRecoveryModule {}