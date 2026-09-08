import {
  Module,
} from '@nestjs/common';

import {
  OutboxProcessor,
} from './outbox.processor';

import {
  OutboxService,
} from './outbox.service';

import {
  RabbitMqModule,
} from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [
    RabbitMqModule,
  ],
  providers: [
    OutboxService,
    OutboxProcessor,
  ],
  exports: [
    RabbitMqModule,
  ],
})
export class OutboxModule {}
