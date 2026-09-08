import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '@payflow/database';

type BeginNotificationInput = {
  eventId: string;
  dedupeKey: string;
  eventType: string;
  recipient: string;
  subject: string;
};

export type NotificationClaimResult =
  | {
      action: 'PROCESS';
    }
  | {
      action: 'SKIP_SENT';
    }
  | {
      action: 'BUSY';
    };

@Injectable()
export class NotificationIdempotencyService {
  private readonly logger = new Logger(NotificationIdempotencyService.name);

  private readonly stalePendingMs = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async begin(input: BeginNotificationInput): Promise<NotificationClaimResult> {
    const eventId = input.eventId.trim();

    const dedupeKey = input.dedupeKey.trim();

    if (!eventId) {
      throw new Error('Notification eventId is required');
    }

    if (!dedupeKey) {
      throw new Error('Notification dedupeKey is required');
    }

    /*
     * Fast path:
     * create() + UNIQUE(dedupeKey) is the
     * concurrency-safe initial claim.
     */
    try {
      await this.prisma.notificationLog.create({
        data: {
          eventId,
          dedupeKey,
          eventType: input.eventType,
          recipient: input.recipient,
          subject: input.subject,
          status: 'PENDING',
          attempts: 1,
        },
      });

      return {
        action: 'PROCESS',
      };
    } catch (error) {
      const existing = await this.prisma.notificationLog.findUnique({
        where: {
          dedupeKey,
        },
      });

      if (!existing) {
        throw error;
      }

      if (existing.status === 'SENT') {
        this.logger.log(`Duplicate notification skipped: ${dedupeKey}`);

        return {
          action: 'SKIP_SENT',
        };
      }

      /*
       * FAILED is explicitly retryable.
       */
      if (existing.status === 'FAILED') {
        const retry = await this.prisma.notificationLog.updateMany({
          where: {
            id: existing.id,

            status: 'FAILED',
          },

          data: {
            status: 'PENDING',

            attempts: {
              increment: 1,
            },

            errorMessage: null,
          },
        });

        return {
          action: retry.count === 1 ? 'PROCESS' : 'BUSY',
        };
      }

      /*
       * PENDING means another consumer may
       * currently be executing this side effect.
       *
       * Only reclaim it when stale.
       */
      const staleBefore = new Date(Date.now() - this.stalePendingMs);

      if (existing.status === 'PENDING' && existing.updatedAt < staleBefore) {
        const reclaim = await this.prisma.notificationLog.updateMany({
          where: {
            id: existing.id,

            status: 'PENDING',

            updatedAt: existing.updatedAt,
          },

          data: {
            attempts: {
              increment: 1,
            },

            errorMessage: null,
          },
        });

        if (reclaim.count === 1) {
          this.logger.warn(`Recovered stale notification claim: ${dedupeKey}`);

          return {
            action: 'PROCESS',
          };
        }
      }

      return {
        action: 'BUSY',
      };
    }
  }

  async markSent(dedupeKey: string, providerMessageId?: string): Promise<void> {
    await this.prisma.notificationLog.update({
      where: {
        dedupeKey,
      },

      data: {
        status: 'SENT',

        sentAt: new Date(),

        errorMessage: null,

        providerMessageId: providerMessageId ?? null,
      },
    });
  }

  async markFailed(dedupeKey: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);

    await this.prisma.notificationLog.update({
      where: {
        dedupeKey,
      },

      data: {
        status: 'FAILED',

        errorMessage: message.slice(0, 2000),
      },
    });
  }

  async getByDedupeKey(dedupeKey: string) {
    return this.prisma.notificationLog.findUnique({
      where: {
        dedupeKey,
      },
    });
  }
  async checkDatabaseReadiness(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
