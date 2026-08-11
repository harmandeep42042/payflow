import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '@payflow/database';
import {
  NotificationsGateway,
} from './notifications.gateway';

export type NotificationEvent = {
  eventId?: string;
  userId?: string;
  email?: string;
  walletId?: string;
  sourceWalletId?: string;
  destinationWalletId?: string;
  amount?: string | number;
  currency?: string;
  reference?: string;
  description?: string;
  occurredAt?: string;
  [key: string]: unknown;
};

type NotificationContent = {
  title: string;
  message: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger =
    new Logger(
      NotificationsService.name,
    );

  private readonly mailEnabled =
    (
      process.env['MAIL_ENABLED'] ??
      'false'
    ).toLowerCase() === 'true';

  constructor(
    private readonly prisma:
      PrismaService,

    private readonly notificationsGateway:
      NotificationsGateway,
  ) {}

  async process(
    eventName: string,
    event: NotificationEvent,
  ): Promise<void> {
    const preferences =
      event.userId
        ? await this.prisma
            .notificationPreference
            .findUnique({
              where: {
                userId: event.userId,
              },
            })
        : null;

    if (preferences) {
      const normalizedEvent =
        eventName.toLowerCase();

      const disabledCategory =
        (normalizedEvent.includes('transfer') &&
          !preferences.transfersEnabled) ||
        (normalizedEvent.includes('deposit') &&
          !preferences.depositsEnabled) ||
        (normalizedEvent.includes('withdraw') &&
          !preferences.withdrawalsEnabled) ||
        (normalizedEvent.includes('payment') &&
          !preferences.paymentsEnabled);

      if (disabledCategory) {
        this.logger.log(
          '[NOTIFICATION SKIPPED] event=' + eventName + ' | userId=' + (event.userId ?? 'unknown') + ' | reason=category-preference',
        );

        return;
      }
    }

    const inAppEnabled =
      preferences?.inAppEnabled ??
      true;

    const emailEnabled =
      (preferences?.emailEnabled ?? true) &&
      this.mailEnabled;

    if (
      !inAppEnabled &&
      !emailEnabled
    ) {
      this.logger.log(
        '[NOTIFICATION SKIPPED] event=' + eventName + ' | userId=' + (event.userId ?? 'unknown') + ' | reason=no-enabled-channel',
      );

      return;
    }

    const nestedUser =
      event['user'];

    const nestedUserEmail =
      nestedUser &&
      typeof nestedUser === 'object'
        ? (
            nestedUser as
              Record<string, unknown>
          )['email']
        : undefined;

    const notificationEmail =
      typeof event.email === 'string'
        ? event.email
        : typeof nestedUserEmail === 'string'
          ? nestedUserEmail
          : undefined;

    const content =
      this.createContent(
        eventName,
        event,
      );

    const notification =
      await this.prisma.notification.create({
        data: {
          userId:
            event.userId ??
            null,

          email:
            notificationEmail ??
            null,

          type:
            eventName,

          title:
            content.title,

          message:
            content.message,

          channel:
            inAppEnabled
              ? 'IN_APP'
              : 'EMAIL',

          status:
            emailEnabled && !inAppEnabled
              ? 'QUEUED'
              : 'CREATED',

          metadata:
            event as never,
        },
      });

    if (inAppEnabled) {
      this.notificationsGateway
        .emitNotificationCreated(
          notification,
        );
    }

    if (emailEnabled) {
      this.logger.log(
        '[EMAIL QUEUED] id=' + notification.id + ' | event=' + eventName + ' | email=' + (notificationEmail ?? 'unavailable'),
      );
    }

    this.logger.log(
      [
        '[NOTIFICATION PROCESSED]',
        'id=' + notification.id,
        'event=' + eventName,
        'userId=' + (event.userId ?? 'unknown'),
        'inApp=' + String(inAppEnabled),
        'email=' + String(emailEnabled),
      ].join(' | '),
    );
  }

  async findAll(
    input: {
      userId: string;
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      type?: string;
    },
  ) {
    const page =
      Number.isFinite(input.page) &&
      Number(input.page) > 0
        ? Math.floor(
            Number(input.page),
          )
        : 1;

    const limit =
      Number.isFinite(input.limit) &&
      Number(input.limit) > 0
        ? Math.min(
            Math.floor(
              Number(input.limit),
            ),
            100,
          )
        : 20;

    const where = {
      userId:
        input.userId,

      ...(input.unreadOnly
        ? {
            isRead:
              false,
          }
        : {}),

      ...(input.type
        ? {
            type:
              input.type,
          }
        : {}),
    };

    const [
      total,
      unreadCount,
      notifications,
    ] = await Promise.all([
      this.prisma.notification.count({
        where,
      }),

      this.prisma.notification.count({
        where: {
          userId:
            input.userId,

          isRead:
            false,
        },
      }),

      this.prisma.notification.findMany({
        where,

        orderBy: {
          createdAt:
            'desc',
        },

        skip:
          (page - 1) *
          limit,

        take:
          limit,
      }),
    ]);

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(
            total / limit,
          );

    return {
      notifications,

      summary: {
        total,
        unreadCount,
      },

      pagination: {
        total,
        page,
        limit,
        totalPages,

        hasNextPage:
          page < totalPages,

        hasPreviousPage:
          page > 1,
      },

      filters: {
        userId:
          input.userId,

        unreadOnly:
          Boolean(
            input.unreadOnly,
          ),

        type:
          input.type ?? '',
      },
    };
  }

  async findByIdForUser(
    notificationId: string,
    userId: string,
  ) {
    const notification =
      await this.prisma.notification
        .findFirst({
          where: {
            id:
              notificationId,

            userId,
          },
        });

    if (!notification) {
      throw new NotFoundException(
        'Notification not found',
      );
    }

    return notification;
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ) {
    const notification =
      await this.findByIdForUser(
        notificationId,
        userId,
      );

    if (notification.isRead) {
      return {
        message:
          'Notification is already read',

        notification,
      };
    }

    const updatedNotification =
      await this.prisma.notification
        .update({
          where: {
            id:
              notificationId,
          },

          data: {
            isRead:
              true,

            readAt:
              new Date(),
          },
        });

    return {
      message:
        'Notification marked as read',

      notification:
        updatedNotification,
    };
  }

  async markAllAsRead(
    userId: string,
  ) {
    const result =
      await this.prisma.notification
        .updateMany({
          where: {
            userId,

            isRead:
              false,
          },

          data: {
            isRead:
              true,

            readAt:
              new Date(),
          },
        });

    return {
      message:
        'All notifications marked as read',

      updatedCount:
        result.count,
    };
  }


  async deleteForUser(
    notificationId: string,
    userId: string,
  ) {
    const notification =
      await this.prisma.notification
        .findFirst({
          where: {
            id:
              notificationId,

            userId,
          },
        });

    if (!notification) {
      throw new NotFoundException(
        'Notification not found',
      );
    }

    await this.prisma.notification
      .delete({
        where: {
          id:
            notificationId,
        },
      });

    return {
      message:
        'Notification deleted',

      notificationId,
    };
  }

  async deleteAllForUser(
    userId: string,
  ) {
    const result =
      await this.prisma.notification
        .deleteMany({
          where: {
            userId,
          },
        });

    return {
      message:
        'Notification history cleared',

      deletedCount:
        result.count,
    };
  }
  private createContent(
    eventName: string,
    event: NotificationEvent,
  ): NotificationContent {
    const amount =
      event.amount ?? '0';

    const currency =
      event.currency ?? 'INR';

    if (
      eventName ===
      'wallet.deposit.completed'
    ) {
      return {
        title:
          'Money added successfully',

        message:
          `${currency} ${amount} was added to your wallet.`,
      };
    }

    if (
      eventName ===
      'wallet.withdrawal.completed'
    ) {
      return {
        title:
          'Withdrawal completed',

        message:
          `${currency} ${amount} was withdrawn from your wallet.`,
      };
    }

    if (
      eventName ===
      'wallet.transfer.completed'
    ) {
      return {
        title:
          'Money transfer completed',

        message:
          `${currency} ${amount} was transferred successfully.`,
      };
    }

    if (
      eventName ===
      'payment.completed'
    ) {
      return {
        title:
          'Payment completed',

        message:
          `Your payment of ${currency} ${amount} was successful.`,
      };
    }

    if (
      eventName ===
      'user.registered'
    ) {
      return {
        title:
          'Welcome to Payflow',

        message:
          'Your Payflow account was created successfully.',
      };
    }

    return {
      title:
        'Payflow notification',

      message:
        event.description ??
        `A new ${eventName} event was received.`,
    };
  }
}

