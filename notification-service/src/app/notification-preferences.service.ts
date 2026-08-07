import {
  Injectable,
} from '@nestjs/common';

import {
  PrismaService,
} from '@payflow/database';

export type UpdateNotificationPreferencesInput = {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  transfersEnabled?: boolean;
  depositsEnabled?: boolean;
  withdrawalsEnabled?: boolean;
  paymentsEnabled?: boolean;
};

@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async getOrCreate(
    userId: string,
  ) {
    return this.prisma
      .notificationPreference
      .upsert({
        where: {
          userId,
        },

        create: {
          userId,
        },

        update: {},
      });
  }

  async update(
    userId: string,
    input:
      UpdateNotificationPreferencesInput,
  ) {
    await this.getOrCreate(
      userId,
    );

    return this.prisma
      .notificationPreference
      .update({
        where: {
          userId,
        },

        data: {
          ...(typeof input.inAppEnabled ===
          'boolean'
            ? {
                inAppEnabled:
                  input.inAppEnabled,
              }
            : {}),

          ...(typeof input.emailEnabled ===
          'boolean'
            ? {
                emailEnabled:
                  input.emailEnabled,
              }
            : {}),

          ...(typeof input.transfersEnabled ===
          'boolean'
            ? {
                transfersEnabled:
                  input.transfersEnabled,
              }
            : {}),

          ...(typeof input.depositsEnabled ===
          'boolean'
            ? {
                depositsEnabled:
                  input.depositsEnabled,
              }
            : {}),

          ...(typeof input.withdrawalsEnabled ===
          'boolean'
            ? {
                withdrawalsEnabled:
                  input.withdrawalsEnabled,
              }
            : {}),

          ...(typeof input.paymentsEnabled ===
          'boolean'
            ? {
                paymentsEnabled:
                  input.paymentsEnabled,
              }
            : {}),
        },
      });
  }
}
