import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@payflow/database';

import { WalletsService } from '../wallets/wallets.service';
import { MetricsService } from '../observability/metrics.service';

import { SettleExternalPaymentDto } from './dto/settle-external-payment.dto';

@Injectable()
export class InternalSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
    private readonly metrics?: MetricsService,
  ) {}

  async settleExternalPayment(dto: SettleExternalPaymentDto) {
    const startedAt = Date.now();

    try {
      const result =
        await this.executeSettlement(dto);

      this.metrics?.recordWalletOperation(
        'settlement',
        result.replayed === true
          ? 'replay'
          : 'success',
        (Date.now() - startedAt) / 1000,
      );

      return result;
    } catch (error) {
      this.metrics?.recordWalletOperation(
        'settlement',
        'failure',
        (Date.now() - startedAt) / 1000,
      );

      throw error;
    }
  }
  private amountsEqual(actual: unknown, expected: string): boolean {
    if (actual === null || actual === undefined) {
      return false;
    }

    const actualNumber = Number(actual.toString());
    const expectedNumber = Number(expected);

    return (
      Number.isFinite(actualNumber) &&
      Number.isFinite(expectedNumber) &&
      actualNumber === expectedNumber
    );
  }

  private async executeSettlement(dto: SettleExternalPaymentDto) {
    const currency = dto.currency.trim().toUpperCase();

    const amount = (dto.amountInPaise / 100).toFixed(2);

    const idempotencyKey = 'payment:' + dto.paymentId;

    const reference = 'EXTERNAL-PAYMENT-' + dto.paymentId;

    /*
     * Payload binding must happen BEFORE invoking
     * the wallet money-movement core.
     */
    const existing = await this.prisma.deposit.findUnique({
      where: {
        idempotencyKey,
      },

      include: {
        wallet: true,
      },
    });

    if (existing) {
      const basePayloadMatches =
        existing.walletId === dto.walletId &&
        this.amountsEqual(existing.amount, amount) &&
        existing.currency === currency &&
        existing.reference === reference;

      const settlementBindingMatches =
        (existing.settlementPaymentId === null ||
          existing.settlementPaymentId === dto.paymentId) &&
        (existing.settlementProviderPaymentId === null ||
          existing.settlementProviderPaymentId === dto.providerPaymentId);

      if (!basePayloadMatches || !settlementBindingMatches) {
        throw new ConflictException(
          'Settlement idempotency key is already bound to a different payload',
        );
      }

      /*
       * Legacy/crash-window deposits may exist without the durable
       * settlement columns populated. Bind them exactly once.
       *
       * updateMany provides a compare-and-set boundary:
       * another request can win the binding, but cannot overwrite it.
       */
      if (
        existing.settlementPaymentId === null ||
        existing.settlementProviderPaymentId === null
      ) {
        const bound = await this.prisma.deposit.updateMany({
          where: {
            id: existing.id,
            settlementPaymentId: existing.settlementPaymentId,
            settlementProviderPaymentId:
              existing.settlementProviderPaymentId,
          },

          data: {
            settlementPaymentId: dto.paymentId,
            settlementProviderPaymentId: dto.providerPaymentId,
          },
        });

        if (bound.count !== 1) {
          const concurrent = await this.prisma.deposit.findUnique({
            where: {
              id: existing.id,
            },

            include: {
              wallet: true,
            },
          });

          if (
            !concurrent ||
            concurrent.settlementPaymentId !== dto.paymentId ||
            concurrent.settlementProviderPaymentId !==
              dto.providerPaymentId
          ) {
            throw new ConflictException(
              'Settlement binding changed concurrently',
            );
          }

          return {
            id: concurrent.id,
            paymentId: concurrent.settlementPaymentId,
            providerPaymentId:
              concurrent.settlementProviderPaymentId,
            idempotencyKey: concurrent.idempotencyKey,
            walletId: concurrent.walletId,
            amount: concurrent.amount.toString(),
            currency: concurrent.currency,
            reference: concurrent.reference,
            status: concurrent.status,
            completedAt: concurrent.completedAt,
            walletBalance: concurrent.wallet.balance.toString(),
            replayed: true,
          };
        }
      }

      return {
        id: existing.id,
        paymentId: dto.paymentId,
        providerPaymentId: dto.providerPaymentId,
        idempotencyKey: existing.idempotencyKey,
        walletId: existing.walletId,
        amount: existing.amount.toString(),
        currency: existing.currency,
        reference: existing.reference,
        status: existing.status,
        completedAt: existing.completedAt,
        walletBalance: existing.wallet.balance.toString(),
        replayed: true,
      };
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: {
        id: dto.walletId,
      },

      select: {
        id: true,
        userId: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Settlement wallet not found');
    }

    /*
     * Reuse the existing audited money-movement core.
     */
    const result = await this.walletsService.depositWallet(
      {
        walletId: dto.walletId,
        amount,
        currency,
        reference,
        idempotencyKey,
      },

      wallet.userId,
    );

    /*
     * Decimal-safe evidence validation.
     *
     * Prisma Decimal may serialize 1.00 as "1", therefore
     * numeric equality is required rather than string equality.
     */
    if (
      result.walletId !== dto.walletId ||
      !this.amountsEqual(result.amount, amount) ||
      result.currency !== currency ||
      result.reference !== reference ||
      result.status !== 'COMPLETED'
    ) {
      throw new ConflictException(
        'Wallet settlement evidence does not match the external payment intent',
      );
    }

    /*
     * Bind the committed Deposit to both external identifiers.
     *
     * The idempotency key identifies the exact Deposit created/replayed
     * by WalletsService. Existing conflicting bindings are never
     * overwritten.
     */
    const bound = await this.prisma.deposit.updateMany({
      where: {
        idempotencyKey,
        OR: [
          {
            settlementPaymentId: null,
            settlementProviderPaymentId: null,
          },
          {
            settlementPaymentId: dto.paymentId,
            settlementProviderPaymentId: dto.providerPaymentId,
          },
        ],
      },

      data: {
        settlementPaymentId: dto.paymentId,
        settlementProviderPaymentId: dto.providerPaymentId,
      },
    });

    if (bound.count !== 1) {
      throw new ConflictException(
        'Settlement deposit could not be durably bound to the external payment',
      );
    }

    return {
      ...result,
      paymentId: dto.paymentId,
      providerPaymentId: dto.providerPaymentId,
    };
  }
}