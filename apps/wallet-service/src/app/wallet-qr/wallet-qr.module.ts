import { Module } from '@nestjs/common';

import {
  WalletsModule,
} from '../wallets/wallets.module';

import {
  WalletQrController,
} from './wallet-qr.controller';

import {
  WalletQrService,
} from './wallet-qr.service';

@Module({
  imports: [
    WalletsModule,
  ],
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
