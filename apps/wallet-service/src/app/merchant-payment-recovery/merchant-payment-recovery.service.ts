import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '@payflow/database';
import { MetricsService } from '../observability/metrics.service';

@Injectable()
export class MerchantPaymentRecoveryService {
  private readonly logger = new Logger(
    MerchantPaymentRecoveryService.name,
  );

  private isRecovering = false;

  /*
   * Transfer recovery defaults to 120 seconds.
   *
   * Merchant payment recovery deliberately waits
   * longer so TransferRecoveryService receives the
   * first opportunity to repair a stale transfer.
   */
  private readonly staleAfterMs = Number(
    process.env.MERCHANT_PAYMENT_PROCESSING_TIMEOUT_MS ??
      180000,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics?: MetricsService,
  ) {}

  @Cron('*/30 * * * * *')
  async recoverStaleMerchantPayments(): Promise<void> {
    if (this.isRecovering) {
      return;
    }

    this.isRecovering = true;

    try {
      const timeoutMs =
        Number.isFinite(this.staleAfterMs) &&
        this.staleAfterMs >= 60000
          ? this.staleAfterMs
          : 180000;

      const cutoff = new Date(
        Date.now() - timeoutMs,
      );

      const stalePayments =
        await this.prisma.merchantPayment.findMany({
          where: {
            status: 'PROCESSING',
            processingStartedAt: {
              lt: cutoff,
            },
          },
          include: {
            merchant: true,
          },
          orderBy: {
            processingStartedAt: 'asc',
          },
          take: 20,
        });

      if (stalePayments.length === 0) {
        return;
      }

      this.logger.warn(
        'Found ' +
          stalePayments.length +
          ' stale PROCESSING merchant payment(s)',
      );

      for (const payment of stalePayments) {
        try {
          await this.recoverMerchantPayment(
            payment.id,
          );
        } catch (error) {
          this.logger.error(
            'Merchant payment recovery failed for ' +
              payment.id,
            error instanceof Error
              ? error.stack
              : String(error),
          );
        }
      }
    } finally {
      this.isRecovering = false;
    }
  }

  private async recoverMerchantPayment(
    paymentId: string,
  ): Promise<void> {
    const payment =
      await this.prisma.merchantPayment.findUnique({
        where: {
          id: paymentId,
        },
        include: {
          merchant: true,
        },
      });

    if (
      !payment ||
      payment.status !== 'PROCESSING'
    ) {
      return;
    }

    /*
     * Merchant QR and Transfer use the same stable
     * idempotency key.
     *
     * This is the durable link between the
     * PROCESSING MerchantPayment claim and the
     * actual money movement.
     */
    const transfer =
      await this.prisma.transfer.findUnique({
        where: {
          idempotencyKey:
            payment.idempotencyKey,
        },
        include: {
          sourceWallet: true,
          destinationWallet: true,
          ledgerEntries: true,
        },
      });

    /*
     * Claim existed but transfer was never created.
     *
     * This represents a crash after merchant claim
     * creation but before transfer execution.
     *
     * No transfer evidence means recovery MUST NOT
     * attempt to send money.
     */
    if (!transfer) {
      await this.markFailed(
        payment.id,
        'Merchant payment claim timed out before transfer was created',
      );

      return;
    }

    /*
     * Verify that the transfer found by the stable
     * idempotency key belongs to this exact payment.
     *
     * Any mismatch is accounting-sensitive and must
     * never be automatically repaired as success.
     */
    const bindingValid =
      transfer.sourceWallet.userId ===
        payment.userId &&
      transfer.destinationWallet.userId ===
        payment.merchant.ownerUserId &&
      transfer.amount.equals(payment.amount) &&
      transfer.currency === payment.currency;

    if (!bindingValid) {
      await this.markNeedsReview(
        payment.id,
        'Merchant payment transfer binding mismatch',
      );

      return;
    }

    /*
     * Transfer recovery has not resolved the money
     * movement yet.
     *
     * Leave MerchantPayment in PROCESSING.
     * Do not call transferByVpa().
     */
    if (
      transfer.status === 'PENDING' ||
      transfer.status === 'PROCESSING'
    ) {
      await this.recordRecoveryAttempt(
        payment.id,
      );

      this.logger.warn(
        'Merchant payment remains PROCESSING while transfer ' +
          transfer.id +
          ' is ' +
          transfer.status,
      );

      return;
    }

    /*
     * TransferRecoveryService only marks a transfer
     * FAILED safely when no committed ledger evidence
     * exists.
     *
     * Still verify this independently here.
     */
    if (transfer.status === 'FAILED') {
      if (transfer.ledgerEntries.length !== 0) {
        await this.markNeedsReview(
          payment.id,
          'FAILED transfer contains ledger evidence',
        );

        return;
      }

      await this.markFailed(
        payment.id,
        transfer.failureReason ??
          'Underlying transfer failed',
      );

      return;
    }

    /*
     * Any transfer already escalated for accounting
     * review must escalate the merchant payment too.
     */
    if (transfer.status === 'NEEDS_REVIEW') {
      await this.markNeedsReview(
        payment.id,
        transfer.failureReason ??
          'Underlying transfer requires manual review',
      );

      return;
    }

    /*
     * Only a COMPLETED transfer is eligible for
     * automatic MerchantPayment success recovery.
     */
    if (transfer.status !== 'COMPLETED') {
      await this.markNeedsReview(
        payment.id,
        'Unsupported transfer state during merchant recovery: ' +
          transfer.status,
      );

      return;
    }

    /*
     * COMPLETED alone is not enough.
     *
     * Independently prove that exactly one source
     * DEBIT and one destination CREDIT were committed
     * for the expected amount and currency.
     */

    const sourceLedgerAccount =
      await this.prisma.ledgerAccount.findUnique({
        where: {
          walletId:
            transfer.sourceWalletId,
        },
      });

    const destinationLedgerAccount =
      await this.prisma.ledgerAccount.findUnique({
        where: {
          walletId:
            transfer.destinationWalletId,
        },
      });

    if (
      !sourceLedgerAccount ||
      !destinationLedgerAccount
    ) {
      await this.markNeedsReview(
        payment.id,
        'Wallet ledger account missing during merchant recovery',
      );

      return;
    }

    const debitEntries =
      transfer.ledgerEntries.filter(
        (entry) =>
          entry.entryType === 'DEBIT',
      );

    const creditEntries =
      transfer.ledgerEntries.filter(
        (entry) =>
          entry.entryType === 'CREDIT',
      );

    const validDebit =
      debitEntries.length === 1 &&
      debitEntries[0].ledgerAccountId ===
        sourceLedgerAccount.id &&
      debitEntries[0].amount.equals(
        payment.amount,
      ) &&
      debitEntries[0].currency ===
        payment.currency;

    const validCredit =
      creditEntries.length === 1 &&
      creditEntries[0].ledgerAccountId ===
        destinationLedgerAccount.id &&
      creditEntries[0].amount.equals(
        payment.amount,
      ) &&
      creditEntries[0].currency ===
        payment.currency;

    const balanced =
      transfer.ledgerEntries.length === 2 &&
      validDebit &&
      validCredit;

    if (!balanced) {
      await this.markNeedsReview(
        payment.id,
        [
          'Merchant payment accounting evidence invalid',
          'ledgerEntries=' +
            transfer.ledgerEntries.length,
          'debits=' +
            debitEntries.length,
          'credits=' +
            creditEntries.length,
        ].join(' '),
      );

      return;
    }

    /*
     * Durable transfer + balanced ledger proves the
     * money transaction already committed.
     *
     * IMPORTANT:
     * This updates ONLY MerchantPayment metadata.
     * Wallet balances and ledger are never touched.
     */
    const completedAt =
      transfer.completedAt ?? new Date();

    const recovered =
      await this.prisma.merchantPayment.updateMany({
        where: {
          id: payment.id,
          status: 'PROCESSING',
        },
        data: {
          status: 'SUCCEEDED',
          transactionReference:
            transfer.id,
          receiptNumber:
            'MQR-' + transfer.id,
          completedAt,
          lastRecoveryAt: new Date(),
          recoveryAttempts: {
            increment: 1,
          },
          failureReason: null,
        },
      });

    if (recovered.count === 1) {
      this.metrics?.recordRecoveryEvent(
        'merchant_payment_recovery',
        'recovered_succeeded',
      );

      this.logger.warn(
        'Recovered merchant payment as SUCCEEDED: ' +
          payment.id +
          ' transfer=' +
          transfer.id,
      );
    } else {
      this.metrics?.recordRecoveryEvent(
        'merchant_payment_recovery',
        'skipped_concurrent',
      );
    }
  }

  private async recordRecoveryAttempt(
    paymentId: string,
  ): Promise<void> {
    const result =
      await this.prisma.merchantPayment.updateMany({
        where: {
          id: paymentId,
          status: 'PROCESSING',
        },
        data: {
          lastRecoveryAt: new Date(),
          recoveryAttempts: {
            increment: 1,
          },
        },
      });

    if (result.count === 1) {
      this.metrics?.recordRecoveryEvent(
        'merchant_payment_recovery',
        'still_processing',
      );
    } else {
      this.metrics?.recordRecoveryEvent(
        'merchant_payment_recovery',
        'skipped_concurrent',
      );
    }
  }

  private async markFailed(
    paymentId: string,
    reason: string,
  ): Promise<void> {
    const result =
      await this.prisma.merchantPayment.updateMany({
        where: {
          id: paymentId,
          status: 'PROCESSING',
        },
        data: {
          status: 'FAILED',
          lastRecoveryAt: new Date(),
          recoveryAttempts: {
            increment: 1,
          },
          failureReason:
            reason.slice(0, 1000),
        },
      });

    if (result.count === 1) {
      this.metrics?.recordRecoveryEvent(
        'merchant_payment_recovery',
        'failed',
      );

      this.logger.warn(
        'Merchant payment recovered as FAILED: ' +
          paymentId +
          ' reason=' +
          reason,
      );
    } else {
      this.metrics?.recordRecoveryEvent(
        'merchant_payment_recovery',
        'skipped_concurrent',
      );
    }
  }

  private async markNeedsReview(
    paymentId: string,
    reason: string,
  ): Promise<void> {
    const result =
      await this.prisma.merchantPayment.updateMany({
        where: {
          id: paymentId,
          status: 'PROCESSING',
        },
        data: {
          status: 'NEEDS_REVIEW',
          lastRecoveryAt: new Date(),
          recoveryAttempts: {
            increment: 1,
          },
          failureReason:
            reason.slice(0, 1000),
        },
      });

    if (result.count === 1) {
      this.metrics?.recordRecoveryEvent(
        'merchant_payment_recovery',
        'needs_review',
      );

      this.logger.error(
        'Merchant payment moved to NEEDS_REVIEW: ' +
          paymentId +
          ' reason=' +
          reason,
      );
    } else {
      this.metrics?.recordRecoveryEvent(
        'merchant_payment_recovery',
        'skipped_concurrent',
      );
    }
  }
}