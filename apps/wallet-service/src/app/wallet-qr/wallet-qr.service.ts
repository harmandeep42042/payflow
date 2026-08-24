import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@payflow/database';

import * as QRCode from 'qrcode';

@Injectable()
export class WalletQrService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async generateMyQr(
    authenticatedUserId?: string,
    currency = 'INR',
  ) {
    if (!authenticatedUserId) {
      throw new ForbiddenException(
        'Authenticated user identity is required',
      );
    }

    const normalizedCurrency = currency
      .trim()
      .toUpperCase();

    const user = await this.prisma.user.findUnique({
      where: {
        id: authenticatedUserId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        vpa: true,
        status: true,
        wallets: {
          where: {
            currency: normalizedCurrency,
          },
          select: {
            id: true,
            currency: true,
            status: true,
          },
          take: 1,
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new NotFoundException(
        'Active user account not found',
      );
    }

    if (!user.vpa) {
      throw new NotFoundException(
        'User does not have a VPA',
      );
    }

    const wallet = user.wallets[0];

    if (!wallet || wallet.status !== 'ACTIVE') {
      throw new NotFoundException(
        `Active ${normalizedCurrency} wallet not found`,
      );
    }

    const payload = `payflow://pay?vpa=${encodeURIComponent(
      user.vpa,
    )}&currency=${encodeURIComponent(
      normalizedCurrency,
    )}`;

    const qrDataUrl = await QRCode.toDataURL(
      payload,
      {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 400,
      },
    );

    return {
      qr: {
        payload,
        dataUrl: qrDataUrl,
      },
      recipient: {
        userId: user.id,
        vpa: user.vpa,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: [
          user.firstName,
          user.lastName,
        ]
          .filter(Boolean)
          .join(' '),
        walletId: wallet.id,
        currency: wallet.currency,
        walletStatus: wallet.status,
      },
    };
  }
}
