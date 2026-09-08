import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@payflow/database';

import { WalletsService } from '../wallets/wallets.service';

import * as QRCode from 'qrcode';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

@Injectable()
export class WalletQrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
  ) {}

  async generateMyQr(
    authenticatedUserId?: string,
    currency = 'INR',
    amountValue?: string,
    expiresInMinutesValue?: string,
  ) {
    if (!authenticatedUserId) {
      throw new ForbiddenException('Authenticated user identity is required');
    }

    const normalizedCurrency = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalizedCurrency))
      throw new BadRequestException('Currency must be a three-letter code');
    const amount = amountValue?.trim();
    if (
      amount &&
      (!/^\d+(\.\d{1,2})?$/.test(amount) || /^0+(\.0{1,2})?$/.test(amount))
    )
      throw new BadRequestException(
        'QR amount must be a positive exact decimal',
      );
    const expiresInMinutes =
      expiresInMinutesValue === undefined
        ? undefined
        : Number(expiresInMinutesValue);
    if (
      expiresInMinutes !== undefined &&
      (!Number.isInteger(expiresInMinutes) ||
        expiresInMinutes < 1 ||
        expiresInMinutes > 1440)
    )
      throw new BadRequestException(
        'QR expiry must be between 1 and 1440 minutes',
      );

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
      throw new NotFoundException('Active user account not found');
    }

    if (!user.vpa) {
      throw new NotFoundException('User does not have a VPA');
    }

    const wallet = user.wallets[0];

    if (!wallet || wallet.status !== 'ACTIVE') {
      throw new NotFoundException(
        `Active ${normalizedCurrency} wallet not found`,
      );
    }

    const fields = new URLSearchParams({
      version: '1',
      vpa: user.vpa,
      currency: normalizedCurrency,
      nonce: randomUUID(),
      ...(amount ? { amount } : {}),
      ...(expiresInMinutes
        ? {
            expiresAt: new Date(
              Date.now() + expiresInMinutes * 60_000,
            ).toISOString(),
          }
        : {}),
    });
    fields.set('signature', this.sign(fields));
    const payload = `payflow://pay?${fields.toString()}`;

    const qrDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400,
    });

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
        displayName: [user.firstName, user.lastName].filter(Boolean).join(' '),
        walletId: wallet.id,
        currency: wallet.currency,
        walletStatus: wallet.status,
      },
      payment: {
        amount: amount ?? null,
        expiresAt: fields.get('expiresAt'),
        idempotencyKey: `qr:${fields.get('nonce')}`,
      },
    };
  }

  async generateMerchantQr(
    authenticatedUserId?: string,
    currency = 'INR',
    amountValue?: string,
    expiresInMinutesValue?: string,
  ) {
    if (!authenticatedUserId) {
      throw new ForbiddenException('Authenticated user identity is required');
    }

    const normalizedCurrency = currency.trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      throw new BadRequestException('Currency must be a three-letter code');
    }

    const amount = amountValue?.trim();

    if (
      amount &&
      (!/^\d+(\.\d{1,2})?$/.test(amount) || /^0+(\.0{1,2})?$/.test(amount))
    ) {
      throw new BadRequestException(
        'QR amount must be a positive exact decimal',
      );
    }

    const expiresInMinutes =
      expiresInMinutesValue === undefined
        ? undefined
        : Number(expiresInMinutesValue);

    if (
      expiresInMinutes !== undefined &&
      (!Number.isInteger(expiresInMinutes) ||
        expiresInMinutes < 1 ||
        expiresInMinutes > 1440)
    ) {
      throw new BadRequestException(
        'QR expiry must be between 1 and 1440 minutes',
      );
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: {
        ownerUserId: authenticatedUserId,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
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
        },
      },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant profile not found');
    }

    if (merchant.onboardingStatus !== 'ACTIVE') {
      throw new ForbiddenException(
        'Merchant must be ACTIVE before generating payment QR',
      );
    }

    if (!merchant.owner || merchant.owner.status !== 'ACTIVE') {
      throw new NotFoundException('Active merchant owner account not found');
    }

    if (!merchant.owner.vpa) {
      throw new NotFoundException(
        'Merchant owner does not have a settlement VPA',
      );
    }

    const wallet = merchant.owner.wallets[0];

    if (!wallet || wallet.status !== 'ACTIVE') {
      throw new NotFoundException(
        `Active ${normalizedCurrency} merchant settlement wallet not found`,
      );
    }

    const fields = new URLSearchParams({
      version: '1',
      vpa: merchant.owner.vpa,
      currency: normalizedCurrency,
      nonce: randomUUID(),

      merchantId: merchant.id,
      merchantVpa: merchant.merchantVpa,
      qrIdentity: merchant.qrIdentity,

      ...(amount ? { amount } : {}),

      ...(expiresInMinutes
        ? {
            expiresAt: new Date(
              Date.now() + expiresInMinutes * 60_000,
            ).toISOString(),
          }
        : {}),
    });

    fields.set('signature', this.sign(fields));

    const payload = `payflow://pay?${fields.toString()}`;

    const dataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400,
    });

    return {
      qr: {
        payload,
        dataUrl,
      },

      merchant: {
        id: merchant.id,
        displayName: merchant.displayName,
        legalName: merchant.legalName,
        category: merchant.category,
        merchantVpa: merchant.merchantVpa,
        qrIdentity: merchant.qrIdentity,
        onboardingStatus: merchant.onboardingStatus,
        providerState: merchant.providerState,
      },

      settlement: {
        userId: merchant.owner.id,
        email: merchant.owner.email,
        vpa: merchant.owner.vpa,
        walletId: wallet.id,
        currency: wallet.currency,
      },

      payment: {
        amount: amount ?? null,
        expiresAt: fields.get('expiresAt'),
        idempotencyKey: `qr:${fields.get('nonce')}`,
      },
    };
  }
  verifyPayload(payload: string) {
    let url: URL;

    try {
      url = new URL(payload);
    } catch {
      throw new BadRequestException('Invalid Payflow QR');
    }

    if (
      url.protocol !== 'payflow:' ||
      url.hostname !== 'pay' ||
      url.searchParams.get('version') !== '1'
    ) {
      throw new BadRequestException('Invalid Payflow QR');
    }

    const signature = url.searchParams.get('signature');

    if (!signature) {
      throw new BadRequestException('Unsigned Payflow QR');
    }

    const fields = new URLSearchParams(url.searchParams);

    fields.delete('signature');

    const expectedSignatures = this.signaturesForVerification(fields);

    const supplied = Buffer.from(signature, 'hex');

    let signatureIsValid = false;

    for (const expectedSignature of expectedSignatures) {
      const authoritative = Buffer.from(expectedSignature, 'hex');

      if (
        supplied.length === authoritative.length &&
        timingSafeEqual(supplied, authoritative)
      ) {
        signatureIsValid = true;
      }
    }

    if (!signatureIsValid) {
      throw new BadRequestException('Payflow QR signature is invalid');
    }

    const expiresAt = fields.get('expiresAt');

    if (expiresAt && new Date(expiresAt) <= new Date()) {
      throw new BadRequestException('Payflow QR has expired');
    }

    const vpa = fields.get('vpa');

    const currency = fields.get('currency');

    const amount = fields.get('amount');

    const nonce = fields.get('nonce');

    const merchantId = fields.get('merchantId');

    const merchantVpa = fields.get('merchantVpa');

    const qrIdentity = fields.get('qrIdentity');

    if (
      !vpa ||
      !currency ||
      !nonce ||
      !/^[A-Z]{3}$/.test(currency) ||
      (amount && !/^\d+(\.\d{1,2})?$/.test(amount))
    ) {
      throw new BadRequestException('Payflow QR fields are invalid');
    }

    const merchantFieldCount = [merchantId, merchantVpa, qrIdentity].filter(
      Boolean,
    ).length;

    if (merchantFieldCount !== 0 && merchantFieldCount !== 3) {
      throw new BadRequestException('Merchant QR fields are incomplete');
    }

    return {
      valid: true,

      type: merchantId ? 'MERCHANT' : 'USER',

      vpa,
      currency,
      amount,
      expiresAt,

      idempotencyKey: `qr:${nonce}`,

      merchantId,
      merchantVpa,
      qrIdentity,
    };
  }
  async payVerifiedQr(
    payload: string,
    description: string | undefined,
    authenticatedUserId?: string,
  ) {
    if (!authenticatedUserId) {
      throw new ForbiddenException('Authenticated user identity is required');
    }

    const verified = this.verifyPayload(payload);

    if (!verified.amount) {
      throw new BadRequestException(
        'QR does not specify an exact payment amount',
      );
    }

    if (verified.type === 'MERCHANT') {
      return this.payMerchantQr(verified, description, authenticatedUserId);
    }
    return this.walletsService.transferByVpa(
      {
        vpa: verified.vpa,
        amount: verified.amount,
        currency: verified.currency,
        description: description?.trim() || 'QR payment',
        idempotencyKey: verified.idempotencyKey,
      },
      authenticatedUserId,
    );
  }

  private async payMerchantQr(
    verified: {
      valid: boolean;
      type: string;
      vpa: string;
      currency: string;
      amount: string | null;
      expiresAt: string | null;
      idempotencyKey: string;
      merchantId: string | null;
      merchantVpa: string | null;
      qrIdentity: string | null;
    },
    description: string | undefined,
    authenticatedUserId: string,
  ) {
    if (
      !verified.amount ||
      !verified.merchantId ||
      !verified.merchantVpa ||
      !verified.qrIdentity
    ) {
      throw new BadRequestException('Merchant QR identity is missing');
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: {
        id: verified.merchantId,
      },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    if (merchant.onboardingStatus !== 'ACTIVE') {
      throw new ForbiddenException('Merchant is not ACTIVE');
    }

    if (
      merchant.merchantVpa !== verified.merchantVpa ||
      merchant.qrIdentity !== verified.qrIdentity
    ) {
      throw new BadRequestException(
        'Merchant QR identity does not match merchant profile',
      );
    }

    const owner = await this.prisma.user.findUnique({
      where: {
        id: merchant.ownerUserId,
      },
      select: {
        vpa: true,
        status: true,
      },
    });

    if (!owner || owner.status !== 'ACTIVE') {
      throw new ForbiddenException('Merchant settlement account is not active');
    }

    const currentSettlementVpa = owner.vpa?.trim().toLowerCase() ?? null;

    const signedSettlementVpa = verified.vpa.trim().toLowerCase();

    if (!currentSettlementVpa || currentSettlementVpa !== signedSettlementVpa) {
      throw new ConflictException(
        'Merchant settlement VPA has changed; generate a new QR',
      );
    }
    const normalizeAmount = (value: string) => {
      const parts = value.split('.');
      const wholePart = parts[0] || '0';
      const fractionPart = (parts[1] || '').padEnd(2, '0').slice(0, 2);
      return wholePart + '.' + fractionPart;
    };

    const expectedAmount = normalizeAmount(verified.amount);

    const assertPaymentBinding = (payment: {
      userId: string;
      merchantId: string;
      amount: { toString(): string };
      currency: string;
    }) => {
      const storedAmount = normalizeAmount(payment.amount.toString());

      if (
        payment.userId !== authenticatedUserId ||
        payment.merchantId !== merchant.id ||
        payment.currency.toUpperCase() !== verified.currency.toUpperCase() ||
        storedAmount !== expectedAmount
      ) {
        throw new ConflictException(
          'QR idempotency key is already bound to a different merchant payment',
        );
      }
    };

    const provisionalTransactionReference =
      'MQR-CLAIM-' + verified.idempotencyKey;

    let merchantPayment;
    let claimCreated = false;

    try {
      merchantPayment = await this.prisma.merchantPayment.create({
        data: {
          userId: authenticatedUserId,
          merchantId: merchant.id,
          amount: verified.amount,
          currency: verified.currency,
          status: 'PROCESSING',
          providerState: 'NOT_CONFIGURED',
          transactionReference: provisionalTransactionReference,
          idempotencyKey: verified.idempotencyKey,
          processingStartedAt: new Date(),
          recoveryAttempts: 0,
          failureReason: null,
        },
        include: {
          merchant: true,
        },
      });

      claimCreated = true;
    } catch (error) {
      const prismaCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? (error as { code?: string }).code
          : undefined;

      if (prismaCode !== 'P2002') {
        throw error;
      }

      const existing =
        await this.prisma.merchantPayment.findUnique({
          where: {
            idempotencyKey: verified.idempotencyKey,
          },
          include: {
            merchant: true,
          },
        });

      if (!existing) {
        throw error;
      }

      merchantPayment = existing;
    }

    assertPaymentBinding(merchantPayment);

    if (!claimCreated) {
      return {
        merchantPayment,
        replayed: true,
      };
    }

    let transfer;

    try {
      transfer = await this.walletsService.transferByVpa(
        {
          vpa: verified.vpa,
          amount: verified.amount,
          currency: verified.currency,
          description:
            description?.trim() ||
            'Merchant QR payment to ' + merchant.displayName,
          idempotencyKey: verified.idempotencyKey,
        },
        authenticatedUserId,
      );
    } catch (error) {
      const failureReason =
        error instanceof Error
          ? error.message.slice(0, 1000)
          : 'Merchant transfer execution failed';

      await this.prisma.merchantPayment.updateMany({
        where: {
          id: merchantPayment.id,
          status: 'PROCESSING',
        },
        data: {
          failureReason,
        },
      });

      throw error;
    }

    merchantPayment = await this.prisma.merchantPayment.update({
      where: {
        id: merchantPayment.id,
      },
      data: {
        status: 'SUCCEEDED',
        transactionReference: transfer.id,
        receiptNumber: 'MQR-' + transfer.id,
        completedAt: new Date(),
        failureReason: null,
      },
      include: {
        merchant: true,
      },
    });

    return {
      merchantPayment,
      transfer,
      replayed: false,
    };
  }
  private qrSigningSecretsForVerification(): string[] {
    const current =
      process.env.QR_SIGNING_SECRET_CURRENT ??
      process.env.QR_SIGNING_SECRET;

    const previous = process.env.QR_SIGNING_SECRET_PREVIOUS;

    if (!current || current.length < 32) {
      throw new Error(
        'QR_SIGNING_SECRET_CURRENT or QR_SIGNING_SECRET must contain at least 32 characters',
      );
    }

    if (previous !== undefined && previous.length < 32) {
      throw new Error(
        'QR_SIGNING_SECRET_PREVIOUS must contain at least 32 characters when configured',
      );
    }

    // Avoid duplicate verification work during compatibility deployment,
    // where CURRENT may initially equal the legacy signing secret.
    return previous && previous !== current
      ? [current, previous]
      : [current];
  }

  private currentQrSigningSecret(): string {
    return this.qrSigningSecretsForVerification()[0];
  }

  private signWithSecret(fields: URLSearchParams, secret: string) {
    return createHmac('sha256', secret)
      .update(fields.toString())
      .digest('hex');
  }

  private signaturesForVerification(fields: URLSearchParams): string[] {
    return this.qrSigningSecretsForVerification().map((secret) =>
      this.signWithSecret(fields, secret),
    );
  }

  private sign(fields: URLSearchParams) {
    return this.signWithSecret(fields, this.currentQrSigningSecret());
  }
}
