import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@payflow/database';

import { OutboxModule } from './outbox/outbox.module';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module';
import { WalletsModule } from './wallets/wallets.module';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    RabbitMqModule,
    WalletsModule,
    OutboxModule,
  ],
})
export class AppModule {}