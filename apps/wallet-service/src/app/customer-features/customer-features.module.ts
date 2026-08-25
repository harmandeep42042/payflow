import { Module } from '@nestjs/common';
import { WalletAuthModule } from '../wallet-auth/wallet-auth.module';
import { WalletsModule } from '../wallets/wallets.module';
import { CustomerFeaturesController } from './customer-features.controller';
import { CustomerFeaturesService } from './customer-features.service';

@Module({ imports: [WalletAuthModule, WalletsModule], controllers: [CustomerFeaturesController], providers: [CustomerFeaturesService], exports: [CustomerFeaturesService] })
export class CustomerFeaturesModule {}
