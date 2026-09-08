import { Module } from '@nestjs/common';
import { WalletAuthModule } from '../wallet-auth/wallet-auth.module';
import { WalletsModule } from '../wallets/wallets.module';
import { CustomerFeaturesController } from './customer-features.controller';
import { CustomerFeaturesService } from './customer-features.service';
import { RegulatedPaymentsController } from './regulated-payments.controller';
import { RegulatedPaymentsService } from './regulated-payments.service';

@Module({ imports: [WalletAuthModule, WalletsModule], controllers: [CustomerFeaturesController, RegulatedPaymentsController], providers: [CustomerFeaturesService, RegulatedPaymentsService], exports: [CustomerFeaturesService, RegulatedPaymentsService] })
export class CustomerFeaturesModule {}
