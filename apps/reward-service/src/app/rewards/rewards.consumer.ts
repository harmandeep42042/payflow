import {
  Controller,
  Logger,
} from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import {
  PaymentCompletedEvent,
  PaymentEventPattern,
  PaymentEventVersion,
} from '@payflow/shared-events';

import { RewardsService } from './rewards.service';

type PaymentCompletedEnvelope =
  PaymentCompletedEvent & {
    eventId: string;
    occurredAt: string;
    aggregateType: string;
    aggregateId: string;
  };

type RetryChannel = {
  ack(message: unknown): void;
  nack(message: unknown, allUpTo: boolean, requeue: boolean): void;
  assertQueue(queue: string, options: Record<string, unknown>): Promise<unknown>;
  sendToQueue(queue: string, content: Buffer, options: Record<string, unknown>): boolean;
};

type RetryMessage = {
  content: Buffer;
  properties?: {
    headers?: Record<string, unknown>;
    contentType?: string;
    contentEncoding?: string;
  };
};

const MAX_REWARD_RETRIES = 3;
const REWARD_RETRY_DELAY_MS = 5_000;

@Controller()
export class RewardsConsumer {
  private readonly logger =
    new Logger(RewardsConsumer.name);

  constructor(
    private readonly rewardsService:
      RewardsService,
  ) {}

  @EventPattern(
    PaymentEventPattern.Completed,
  )
  async handlePaymentCompleted(
    @Payload()
    event: unknown,
    @Ctx()
    context: RmqContext,
  ): Promise<void> {
    this.logger.log(
      `PAYMENT_COMPLETED HANDLER ENTERED: ${JSON.stringify(event)}`,
    );

    const channel =
      context.getChannelRef() as RetryChannel;
    const message =
      context.getMessage() as unknown as RetryMessage;

    try {
      const validatedEvent =
        this.validateEvent(event);

      const result =
        await this.rewardsService
          .generateScratchCard(
            validatedEvent.userId,
            validatedEvent.walletId,
            validatedEvent.paymentId,
          );

      channel.ack(message);

      this.logger.log(
        `Payment reward processed: eventId=${validatedEvent.eventId} paymentId=${validatedEvent.paymentId} created=${result.created}`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to process PAYMENT_COMPLETED reward event',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      await this.routeFailure(channel, message);
    }
  }

  private async routeFailure(
    channel: RetryChannel,
    message: RetryMessage,
  ): Promise<void> {
    const primaryQueue =
      process.env['PAYMENT_RABBITMQ_QUEUE'] ?? 'payment_events';
    const retryQueue = `${primaryQueue}.retry`;
    const deadLetterQueue = `${primaryQueue}.dead`;
    const previousAttempts = Number(
      message.properties?.headers?.['x-payflow-retry-count'] ?? 0,
    );
    const nextAttempt = previousAttempts + 1;

    try {
      if (nextAttempt <= MAX_REWARD_RETRIES) {
        await channel.assertQueue(retryQueue, {
          durable: true,
          arguments: {
            'x-message-ttl': REWARD_RETRY_DELAY_MS,
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': primaryQueue,
          },
        });
        channel.sendToQueue(retryQueue, message.content, {
          persistent: true,
          contentType: message.properties?.contentType,
          contentEncoding: message.properties?.contentEncoding,
          headers: {
            ...message.properties?.headers,
            'x-payflow-retry-count': nextAttempt,
          },
        });
        channel.ack(message);
        return;
      }

      await channel.assertQueue(deadLetterQueue, { durable: true });
      channel.sendToQueue(deadLetterQueue, message.content, {
        persistent: true,
        contentType: message.properties?.contentType,
        contentEncoding: message.properties?.contentEncoding,
        headers: {
          ...message.properties?.headers,
          'x-payflow-retry-count': previousAttempts,
          'x-payflow-dead-letter-reason': 'reward-processing-failed',
        },
      });
      channel.ack(message);
    } catch (routingError) {
      this.logger.error(
        'Failed to route Reward message to retry/dead-letter queue',
        routingError instanceof Error ? routingError.stack : String(routingError),
      );
      channel.nack(message, false, true);
    }
  }

  private validateEvent(
    value: unknown,
  ): PaymentCompletedEnvelope {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      throw new Error(
        'PAYMENT_COMPLETED event must be an object',
      );
    }

    const event = value as
      Record<string, unknown>;

    if (
      event['type'] !==
      PaymentEventPattern.Completed
    ) {
      throw new Error(
        'PAYMENT_COMPLETED event type is invalid',
      );
    }

    if (
      event['version'] !==
      PaymentEventVersion.Completed
    ) {
      throw new Error(
        'PAYMENT_COMPLETED event version is unsupported',
      );
    }

    const validatedEvent = {
      type:
        PaymentEventPattern.Completed,
      version:
        PaymentEventVersion.Completed,
      eventId:
        this.requireString(
          event,
          'eventId',
        ),
      occurredAt:
        this.requireString(
          event,
          'occurredAt',
        ),
      aggregateType:
        this.requireString(
          event,
          'aggregateType',
        ),
      aggregateId:
        this.requireString(
          event,
          'aggregateId',
        ),
      paymentId:
        this.requireString(
          event,
          'paymentId',
        ),
      userId:
        this.requireString(
          event,
          'userId',
        ),
      walletId:
        this.requireString(
          event,
          'walletId',
        ),
      amount:
        this.requireString(
          event,
          'amount',
        ),
      currency:
        this.requireString(
          event,
          'currency',
        ),
    };

    if (
      validatedEvent.aggregateType !==
      'PAYMENT'
    ) {
      throw new Error(
        'PAYMENT_COMPLETED aggregateType must be PAYMENT',
      );
    }

    if (
      validatedEvent.aggregateId !==
      validatedEvent.paymentId
    ) {
      throw new Error(
        'PAYMENT_COMPLETED aggregateId must match paymentId',
      );
    }

    if (
      !Number.isFinite(
        Date.parse(
          validatedEvent.occurredAt,
        ),
      )
    ) {
      throw new Error(
        'PAYMENT_COMPLETED occurredAt is invalid',
      );
    }

    const amount = Number(
      validatedEvent.amount,
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new Error(
        'PAYMENT_COMPLETED amount must be positive',
      );
    }

    return validatedEvent;
  }

  private requireString(
    event: Record<string, unknown>,
    field: string,
  ): string {
    const value = event[field];

    if (
      typeof value !== 'string' ||
      !value.trim()
    ) {
      throw new Error(
        `PAYMENT_COMPLETED ${field} is required`,
      );
    }

    return value.trim();
  }
}
