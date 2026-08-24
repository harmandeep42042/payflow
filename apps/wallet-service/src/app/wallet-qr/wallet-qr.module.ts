import { Module } from '@nestjs/common';

import {
  WalletQrController,
} from './wallet-qr.controller';

import {
  WalletQrService,
} from './wallet-qr.service';

@Module({
  controllers: [
    WalletQrController,
  ],
  providers: [
    WalletQrService,
  ],
  exports: [
    WalletQrService,
  ],
})
export class WalletQrModule {}
