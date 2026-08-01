import { Module } from '@nestjs/common';
import { RabbitMqModule } from '../rabbitmq/rabbitmq.module';
import { OutboxProcessor } from './outbox.processor';
import { OutboxService } from './outbox.service';

@Module({
  imports: [RabbitMqModule],
  providers: [
    OutboxService,
    OutboxProcessor,
  ],
  exports: [OutboxService],
})
export class OutboxModule {}