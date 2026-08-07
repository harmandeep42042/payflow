import {
  AuditLogModule,
} from './audit-log/audit-log.module';
import { Module } from '@nestjs/common';
import {
  RecipientLookupModule,
} from './recipient-lookup/recipient-lookup.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@payflow/database';

import { AdminModule } from './admin/admin.module';
import { OutboxModule } from './outbox/outbox.module';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module';
import { WalletsModule } from './wallets/wallets.module';

@Module({
  imports: [
    AuditLogModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    RabbitMqModule,
    WalletsModule,
    OutboxModule,
    AdminModule,
    RecipientLookupModule,
  ],
})
export class AppModule {}