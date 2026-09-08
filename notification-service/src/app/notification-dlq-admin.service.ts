import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, PrismaService } from '@payflow/database';

import type { ConfirmChannel, ChannelModel } from 'amqplib';

import { connect } from 'amqplib';

@Injectable()
export class NotificationDlqAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20, status?: string) {
    const safePage = Math.max(1, Math.floor(page));

    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    const where = status
      ? {
          status: status as
            | 'PENDING'
            | 'REPLAYING'
            | 'REPLAYED'
            | 'REPLAY_FAILED',
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationDeadLetter.findMany({
        where,

        orderBy: {
          createdAt: 'desc',
        },

        skip: (safePage - 1) * safeLimit,

        take: safeLimit,

        select: {
          id: true,
          eventId: true,
          messageKey: true,
          eventType: true,
          sourceQueue: true,
          deadLetterQueue: true,
          reason: true,
          retryCount: true,
          status: true,
          replayCount: true,
          replayedAt: true,
          replayedBy: true,
          lastReplayError: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      this.prisma.notificationDeadLetter.count({
        where,
      }),
    ]);

    return {
      items,

      pagination: {
        page: safePage,

        limit: safeLimit,

        total,

        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async getById(id: string) {
    const item = await this.prisma.notificationDeadLetter.findUnique({
      where: {
        id,
      },
    });

    if (!item) {
      throw new NotFoundException('Dead-letter record not found');
    }

    return item;
  }

  async replay(id: string, replayedBy: string) {
    const existing = await this.prisma.notificationDeadLetter.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Dead-letter record not found');
    }

    if (existing.status === 'REPLAYED') {
      throw new ConflictException('Dead-letter record already replayed');
    }

    if (existing.status === 'REPLAYING') {
      throw new ConflictException('Dead-letter record is already replaying');
    }

    const claim = await this.prisma.notificationDeadLetter.updateMany({
      where: {
        id,

        status: {
          in: ['PENDING', 'REPLAY_FAILED'],
        },
      },

      data: {
        status: 'REPLAYING',

        replayCount: {
          increment: 1,
        },

        replayedBy,

        replayedAt: new Date(),

        lastReplayError: null,
      },
    });

    if (claim.count !== 1) {
      throw new ConflictException(
        'Dead-letter record could not be claimed for replay',
      );
    }

    let connection: ChannelModel | null = null;

    let channel: ConfirmChannel | null = null;

    try {
      const rabbitUrl = process.env['RABBITMQ_URL'];

      if (!rabbitUrl) {
        throw new Error('RABBITMQ_URL is required for DLQ replay');
      }

      const current = await this.prisma.notificationDeadLetter.findUnique({
        where: {
          id,
        },
      });

      if (!current) {
        throw new Error('Dead-letter record disappeared after replay claim');
      }

      connection = await connect(rabbitUrl);

      channel = await connection.createConfirmChannel();

      await channel.assertQueue(current.sourceQueue, {
        durable: true,
      });

      const envelope = {
        pattern: current.eventType,

        data: current.payload,
      };

      const headers = this.buildReplayHeaders(current.headers, replayedBy);

      const published = channel.sendToQueue(
        current.sourceQueue,
        Buffer.from(JSON.stringify(envelope)),
        {
          persistent: true,

          contentType: 'application/json',

          messageId: `dlq-replay:${current.id}:${current.replayCount + 1}`,

          headers,
        },
      );

      if (!published) {
        await new Promise<void>((resolve) => {
          channel?.once('drain', () => resolve());
        });
      }

      /*
       * Do not mark the registry record REPLAYED until RabbitMQ
       * confirms that the replay message was accepted by the broker.
       */
      await channel.waitForConfirms();

      await this.prisma.notificationDeadLetter.update({
        where: {
          id,
        },

        data: {
          status: 'REPLAYED',

          lastReplayError: null,
        },
      });

      return this.getById(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.prisma.notificationDeadLetter.update({
        where: {
          id,
        },

        data: {
          status: 'REPLAY_FAILED',

          lastReplayError: message.slice(0, 2000),
        },
      });

      throw error;
    } finally {
      if (channel) {
        await channel.close();
      }

      if (connection) {
        await connection.close();
      }
    }
  }

  private buildReplayHeaders(
    value: Prisma.JsonValue | null,
    replayedBy: string,
  ): Record<string, unknown> {
    const base =
      value && typeof value === 'object' && !Array.isArray(value)
        ? {
            ...(value as Record<string, unknown>),
          }
        : {};

    delete base['x-death'];

    delete base['x-first-death-exchange'];

    delete base['x-first-death-queue'];

    delete base['x-first-death-reason'];

    delete base['x-last-death-exchange'];

    delete base['x-last-death-queue'];

    delete base['x-last-death-reason'];

    delete base['x-payflow-dead-letter-reason'];

    delete base['x-payflow-last-failure'];

    delete base['x-payflow-retry-count'];

    return {
      ...base,

      'x-payflow-replay': true,

      'x-payflow-replayed-by': replayedBy,

      'x-payflow-replayed-at': new Date().toISOString(),
    };
  }
}
