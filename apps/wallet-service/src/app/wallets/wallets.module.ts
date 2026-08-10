import { Module } from '@nestjs/common';

import {
  WalletAuthModule,
} from '../wallet-auth/wallet-auth.module';

import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [
    WalletAuthModule,
  ],

  controllers: [
    WalletsController,
  ],

  providers: [
    WalletsService,
  ],

  exports: [
    WalletsService,
  ],
})
export class WalletsModule {}
