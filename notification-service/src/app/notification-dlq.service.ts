import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { Prisma, PrismaService } from '@payflow/database';

import { createHash } from 'crypto';

import type { Channel, ChannelModel, ConsumeMessage } from 'amqplib';

import { connect } from 'amqplib';

type NestEventEnvelope = {
  pattern?: unknown;
  data?: unknown;
};

type StoredPayload = Record<string, unknown>;

@Injectable()
export class NotificationDlqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDlqService.name);

  private connection: ChannelModel | null = null;

  private channel: Channel | null = null;

  private readonly sourceQueue =
    process.env['RABBITMQ_QUEUE'] ?? 'wallet_events';

  private readonly deadLetterQueue = `${this.sourceQueue}.dead`;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.startConsumer();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  private async startConsumer(): Promise<void> {
    const rabbitUrl = process.env['RABBITMQ_URL'];

    if (!rabbitUrl) {
      throw new Error('RABBITMQ_URL is required for DLQ ingestion');
    }

    this.connection = await connect(rabbitUrl);

    this.channel = await this.connection.createChannel();

    await this.channel.assertQueue(this.deadLetterQueue, {
      durable: true,
    });

    await this.channel.prefetch(1);

    await this.channel.consume(
      this.deadLetterQueue,
      async (message) => {
        if (!message) {
          return;
        }

        await this.handleMessage(message);
      },
      {
        noAck: false,
      },
    );

    this.logger.log(`DLQ ingestor consuming ${this.deadLetterQueue}`);
  }

  private async handleMessage(message: ConsumeMessage): Promise<void> {
    const channel = this.channel;

    if (!channel) {
      return;
    }

    try {
      const raw = message.content.toString('utf8');

      const parsed = this.parseJson(raw);

      const envelope = this.getEnvelope(parsed);

      const eventType =
        this.getStringValue(envelope.pattern) ??
        this.getStringValue(
          message.properties.headers?.['x-payflow-event-name'],
        ) ??
        'unknown';

      const payload = this.getPayload(envelope.data);

      const eventId = this.getStringValue(payload.eventId);

      const retryCount = this.getRetryCount(
        message.properties.headers?.['x-payflow-retry-count'],
      );

      const reason =
        this.getStringValue(
          message.properties.headers?.['x-payflow-dead-letter-reason'],
        ) ?? 'notification-processing-failed';

      const messageKey = this.buildMessageKey(message, raw);

      await this.prisma.notificationDeadLetter.upsert({
        where: {
          messageKey,
        },

        create: {
          eventId,
          messageKey,
          eventType,
          sourceQueue: this.sourceQueue,
          deadLetterQueue: this.deadLetterQueue,
          payload: payload as Prisma.InputJsonValue,
          headers: this.toJsonObject(
            message.properties.headers,
          ) as Prisma.InputJsonValue,
          reason,
          retryCount,
          status: 'PENDING',
        },

        update: {},
      });

      channel.ack(message);

      this.logger.log(
        [
          '[DLQ INGESTED]',
          `eventId=${eventId ?? 'unknown'}`,
          `event=${eventType}`,
          `messageKey=${messageKey}`,
        ].join(' | '),
      );
    } catch (error) {
      this.logger.error(
        '[DLQ INGEST FAILED]',
        error instanceof Error ? error.stack : String(error),
      );

      channel.nack(message, false, true);
    }
  }

  private getEnvelope(value: unknown): NestEventEnvelope {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as NestEventEnvelope;
    }

    return {};
  }

  private getPayload(value: unknown): StoredPayload {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as StoredPayload;
    }

    return {};
  }

  private parseJson(raw: string): unknown {
    return JSON.parse(raw);
  }

  private getStringValue(value: unknown): string | null {
    if (typeof value === 'string') {
      const normalized = value.trim();

      return normalized.length > 0 ? normalized : null;
    }

    return null;
  }

  private getRetryCount(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.floor(value));
    }

    if (typeof value === 'string') {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.floor(parsed));
      }
    }

    return 0;
  }

  private buildMessageKey(message: ConsumeMessage, raw: string): string {
    const messageId = this.getStringValue(message.properties.messageId);

    if (messageId) {
      return messageId;
    }

    const eventId = this.getStringValue(
      this.getPayload(this.getEnvelope(this.parseJson(raw)).data).eventId,
    );

    if (eventId) {
      return `event:${eventId}`;
    }

    return createHash('sha256')
      .update(raw)
      .update(JSON.stringify(message.properties.headers ?? {}))
      .digest('hex');
  }

  private toJsonObject(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }
}
