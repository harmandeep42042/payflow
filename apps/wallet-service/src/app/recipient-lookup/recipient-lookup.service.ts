import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '@payflow/database';

@Injectable()
export class RecipientLookupService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async resolveRecipient(input: {
    email: string;
    currency?: string;
    excludeUserId?: string;
  }) {
    const email =
      input.email
        .trim()
        .toLowerCase();

    const currency =
      (
        input.currency ??
        'INR'
      )
        .trim()
        .toUpperCase();

    if (!email) {
      throw new BadRequestException(
        'Recipient email is required',
      );
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          email,
        },

        select: {
          id:
            true,

          email:
            true,

          firstName:
            true,

          lastName:
            true,

          status:
            true,

          wallets: {
            where: {
              currency,
            },

            select: {
              id:
                true,

              currency:
                true,

              status:
                true,
            },

            take:
              1,
          },
        },
      });

    if (
      !user ||
      user.status !== 'ACTIVE'
    ) {
      throw new NotFoundException(
        'Active recipient account not found',
      );
    }

    if (
      input.excludeUserId &&
      user.id === input.excludeUserId
    ) {
      throw new BadRequestException(
        'You cannot transfer money to your own account',
      );
    }

    const wallet =
      user.wallets[0];

    if (
      !wallet ||
      wallet.status !== 'ACTIVE'
    ) {
      throw new NotFoundException(
        `Recipient does not have an active ${currency} wallet`,
      );
    }

    return {
      recipient: {
        userId:
          user.id,

        email:
          user.email,

        firstName:
          user.firstName,

        lastName:
          user.lastName,

        displayName:
          [
            user.firstName,
            user.lastName,
          ]
            .filter(Boolean)
            .join(' '),

        walletId:
          wallet.id,

        currency:
          wallet.currency,

        walletStatus:
          wallet.status,
      },
    };
  }
}