import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  Cron,
} from '@nestjs/schedule';

import {
  RabbitMqPublisher,
} from '../rabbitmq/rabbitmq.publisher';

import {
  OutboxService,
} from './outbox.service';

@Injectable()
export class OutboxProcessor {
  private readonly logger =
    new Logger(OutboxProcessor.name);

  private isProcessing = false;

  constructor(
    private readonly outboxService:
      OutboxService,
    private readonly rabbitMqPublisher:
      RabbitMqPublisher,
  ) {}

  @Cron('*/10 * * * * *')
  async processPendingEvents(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const events =
        await this.outboxService
          .getPendingEvents();

      if (events.length === 0) {
        return;
      }

      for (const event of events) {
        try {
          this.logger.log(
            `Publishing payment event ${event.id}: ${event.eventType}`,
          );

          const payload =
            event.payload &&
            typeof event.payload === 'object' &&
            !Array.isArray(event.payload)
              ? event.payload
              : {};

          await this.rabbitMqPublisher.publish(
            event.eventType,
            {
              ...payload,

              type:
                event.eventType,

              eventId:
                event.id,

              occurredAt:
                event.createdAt.toISOString(),

              aggregateType:
                event.aggregateType,

              aggregateId:
                event.aggregateId,
            },
          );

          await this.outboxService
            .markPublished(event.id);

          this.logger.log(
            `Payment event published successfully: ${event.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to publish payment event: ${event.id}`,
            error instanceof Error
              ? error.stack
              : String(error),
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
