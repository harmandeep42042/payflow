import {
  Injectable,
  Logger,
} from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import {
  PrismaService,
} from '@payflow/database';

import {
  WalletEventPattern,
} from '@payflow/shared-events';

import {
  RabbitMqPublisher,
} from '../rabbitmq/rabbitmq.publisher';

import {
  OutboxService,
} from './outbox.service';

type StoredPayload =
  Record<string, unknown>;

type EventUser = {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string | null;
};

@Injectable()
export class OutboxProcessor {
  private readonly logger =
    new Logger(
      OutboxProcessor.name,
    );

  private isProcessing = false;

  constructor(
    private readonly outboxService:
      OutboxService,

    private readonly rabbitMqPublisher:
      RabbitMqPublisher,

    private readonly prisma:
      PrismaService,
  ) {}

  @Cron('*/10 * * * * *')
  async processPendingEvents():
    Promise<void> {
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
            `Publishing event ${event.id}: ${event.eventType}`,
          );

          const storedPayload =
            this.getStoredPayload(
              event.payload,
            );

          const enrichedPayload =
            await this.enrichPayload(
              event.eventType,
              storedPayload,
            );

          await this.rabbitMqPublisher.publish(
            event.eventType,
            {
              ...enrichedPayload,

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
            `Event published successfully: ${event.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to publish event: ${event.id}`,

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

  private getStoredPayload(
    payload: unknown,
  ): StoredPayload {
    if (
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload)
    ) {
      return payload as StoredPayload;
    }

    return {};
  }

  private async enrichPayload(
    eventType: string,
    payload: StoredPayload,
  ): Promise<StoredPayload> {
    if (
      eventType ===
        WalletEventPattern
          .DepositCompleted ||
      eventType ===
        WalletEventPattern
          .WithdrawalCompleted
    ) {
      return this.enrichSingleUserEvent(
        payload,
      );
    }

    if (
      eventType ===
      WalletEventPattern
        .TransferCompleted
    ) {
      return this.enrichTransferEvent(
        payload,
      );
    }

    return payload;
  }

  private async enrichSingleUserEvent(
    payload: StoredPayload,
  ): Promise<StoredPayload> {
    const userId =
      this.getStringValue(
        payload.userId,
      );

    if (!userId) {
      this.logger.warn(
        'Outbox event does not contain userId',
      );

      return payload;
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      });

    if (!user) {
      this.logger.warn(
        `User not found for notification event: ${userId}`,
      );

      return payload;
    }

    return {
      ...payload,
      user:
        this.mapEventUser(user),
    };
  }

  private async enrichTransferEvent(
    payload: StoredPayload,
  ): Promise<StoredPayload> {
    const sourceWalletId =
      this.getStringValue(
        payload.sourceWalletId,
      );

    const destinationWalletId =
      this.getStringValue(
        payload.destinationWalletId,
      );

    if (
      !sourceWalletId ||
      !destinationWalletId
    ) {
      this.logger.warn(
        'Transfer event does not contain both wallet IDs',
      );

      return payload;
    }

    const [
      sourceWallet,
      destinationWallet,
    ] = await Promise.all([
      this.prisma.wallet.findUnique({
        where: {
          id: sourceWalletId,
        },

        select: {
          id: true,

          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),

      this.prisma.wallet.findUnique({
        where: {
          id:
            destinationWalletId,
        },

        select: {
          id: true,

          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    if (
      !sourceWallet ||
      !destinationWallet
    ) {
      this.logger.warn(
        'Source or destination wallet was not found while enriching transfer event',
      );

      return payload;
    }

    return {
      ...payload,

      sender:
        this.mapEventUser(
          sourceWallet.user,
        ),

      receiver:
        this.mapEventUser(
          destinationWallet.user,
        ),
    };
  }

  private mapEventUser(
    user: EventUser,
  ): EventUser {
    return {
      id:
        user.id,

      email:
        user.email,

      phone:
        user.phone,

      firstName:
        user.firstName,

      lastName:
        user.lastName,
    };
  }

  private getStringValue(
    value: unknown,
  ): string | null {
    if (
      typeof value !== 'string'
    ) {
      return null;
    }

    const normalized =
      value.trim();

    return normalized
      ? normalized
      : null;
  }
}