import { Module } from '@nestjs/common';

import { WalletAuthModule } from '../wallet-auth/wallet-auth.module';

import { RecipientLookupModule } from '../recipient-lookup/recipient-lookup.module';

import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { WalletTransferRiskService } from './security/wallet-transfer-risk.service';

@Module({
  imports: [WalletAuthModule, RecipientLookupModule],

  controllers: [WalletsController],

  providers: [WalletsService, WalletTransferRiskService],

  exports: [WalletsService],
})
export class WalletsModule {}
