import { Module } from '@nestjs/common';

import {
  TransferRecoveryService,
} from './transfer-recovery.service';

@Module({
  providers: [
    TransferRecoveryService,
  ],
})
export class TransferRecoveryModule {}
