import { InternalSettlementModule } from './internal-settlement/internal-settlement.module';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { AuditLogModule } from './audit-log/audit-log.module';
import { Module } from '@nestjs/common';
import { RecipientLookupModule } from './recipient-lookup/recipient-lookup.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@payflow/database';

import { AdminModule } from './admin/admin.module';
import { OutboxModule } from './outbox/outbox.module';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module';
import { WalletsModule } from './wallets/wallets.module';
import { WalletQrModule } from './wallet-qr/wallet-qr.module';
import { TransferRecoveryModule } from './transfer-recovery/transfer-recovery.module';
import { MerchantPaymentRecoveryModule } from './merchant-payment-recovery/merchant-payment-recovery.module';
import { CustomerFeaturesModule } from './customer-features/customer-features.module';
import { MetricsModule } from './observability/metrics.module';

@Module({
  imports: [
    MetricsModule,
    InternalSettlementModule,
    AuditLogModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    RabbitMqModule,
    WalletsModule,
    TransferRecoveryModule,
    MerchantPaymentRecoveryModule,
    OutboxModule,
    AdminModule,
    RecipientLookupModule,
    WalletQrModule,
    CustomerFeaturesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
