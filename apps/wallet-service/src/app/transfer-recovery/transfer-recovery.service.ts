import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { PrismaService } from '@payflow/database';

import { OutboxEventProducer } from '@payflow/shared-events';
import { MetricsService } from '../observability/metrics.service';

@Injectable()
export class TransferRecoveryService {
  private readonly logger = new Logger(TransferRecoveryService.name);

  private isRecovering = false;

  private readonly staleAfterMs = Number(
    process.env.TRANSFER_PROCESSING_TIMEOUT_MS ?? 120000,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics?: MetricsService,
  ) {}

  @Cron('*/30 * * * * *')
  async recoverStaleTransfers(): Promise<void> {
    if (this.isRecovering) {
      return;
    }

    this.isRecovering = true;

    try {
      const timeoutMs =
        Number.isFinite(this.staleAfterMs) && this.staleAfterMs >= 30000
          ? this.staleAfterMs
          : 120000;

      const cutoff = new Date(Date.now() - timeoutMs);

      const staleTransfers = await this.prisma.transfer.findMany({
        where: {
          status: 'PROCESSING',
          updatedAt: {
            lt: cutoff,
          },
        },
        orderBy: {
          updatedAt: 'asc',
        },
        take: 20,
      });

      if (staleTransfers.length === 0) {
        return;
      }

      this.logger.warn(
        `Found ${staleTransfers.length} stale PROCESSING transfer(s)`,
      );

      for (const transfer of staleTransfers) {
        try {
          await this.recoverTransfer(transfer.id);
        } catch (error) {
          this.logger.error(
            `Recovery failed for transfer ${transfer.id}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    } finally {
      this.isRecovering = false;
    }
  }

  private async recoverTransfer(transferId: string): Promise<void> {
    const transfer = await this.prisma.transfer.findUnique({
      where: {
        id: transferId,
      },
      include: {
        ledgerEntries: true,
      },
    });

    if (!transfer || transfer.status !== 'PROCESSING') {
      return;
    }

    const ledgerEntries = transfer.ledgerEntries;

    /*
     * No ledger evidence means the atomic
     * money transaction did not commit.
     *
     * Safe action:
     * PROCESSING -> FAILED.
     */
    if (ledgerEntries.length === 0) {
      const result = await this.prisma.transfer.updateMany({
        where: {
          id: transfer.id,
          status: 'PROCESSING',
          updatedAt: transfer.updatedAt,
        },
        data: {
          status: 'FAILED',
          failureReason:
            'Transfer processing timed out before funds were committed',
        },
      });

      if (result.count === 1) {
        this.metrics?.recordRecoveryEvent(
          'transfer_recovery',
          'failed_no_ledger',
        );

        this.logger.warn(`Stale transfer marked FAILED: ${transfer.id}`);
      } else {
        this.metrics?.recordRecoveryEvent(
          'transfer_recovery',
          'skipped_concurrent',
        );
      }

      return;
    }

    const debitEntries = ledgerEntries.filter(
      (entry) => entry.entryType === 'DEBIT',
    );

    const creditEntries = ledgerEntries.filter(
      (entry) => entry.entryType === 'CREDIT',
    );

    /*
     * If durable ledger evidence exists, NEVER
     * mutate wallet balances during recovery.
     *
     * The original money transaction may already
     * have committed. Recovery only repairs the
     * transfer/outbox state.
     */

    const sourceLedgerAccount = await this.prisma.ledgerAccount.findUnique({
      where: {
        walletId: transfer.sourceWalletId,
      },
    });

    const destinationLedgerAccount = await this.prisma.ledgerAccount.findUnique(
      {
        where: {
          walletId: transfer.destinationWalletId,
        },
      },
    );

    if (!sourceLedgerAccount || !destinationLedgerAccount) {
      this.logger.error(
        `Accounting recovery blocked for transfer ${transfer.id}: wallet ledger account missing`,
      );
      return;
    }

    const validDebit =
      debitEntries.length === 1 &&
      debitEntries[0].ledgerAccountId === sourceLedgerAccount.id &&
      debitEntries[0].amount.equals(transfer.amount) &&
      debitEntries[0].currency === transfer.currency;

    const validCredit =
      creditEntries.length === 1 &&
      creditEntries[0].ledgerAccountId === destinationLedgerAccount.id &&
      creditEntries[0].amount.equals(transfer.amount) &&
      creditEntries[0].currency === transfer.currency;

    const isBalancedCommittedTransfer =
      ledgerEntries.length === 2 && validDebit && validCredit;

    if (!isBalancedCommittedTransfer) {
      const reviewReason = [
        'Manual accounting review required',
        `ledgerEntries=${ledgerEntries.length}`,
        `debits=${debitEntries.length}`,
        `credits=${creditEntries.length}`,
      ].join(' ');

      const reviewClaim = await this.prisma.transfer.updateMany({
        where: {
          id: transfer.id,
          status: 'PROCESSING',
          updatedAt: transfer.updatedAt,
        },
        data: {
          status: 'NEEDS_REVIEW',
          failureReason: reviewReason,
        },
      });

      if (reviewClaim.count === 1) {
        this.metrics?.recordRecoveryEvent(
          'transfer_recovery',
          'needs_review',
        );

        this.logger.error(
          `Transfer moved to NEEDS_REVIEW: ${transfer.id} ${reviewReason}`,
        );
      } else {
        this.metrics?.recordRecoveryEvent(
          'transfer_recovery',
          'skipped_concurrent',
        );
      }

      return;
    }
    /*
     * A valid DEBIT/CREDIT pair proves that the
     * atomic transfer transaction committed.
     *
     * Do NOT move money again.
     *
     * Atomically repair:
     *   PROCESSING -> COMPLETED
     *   completion outbox event if missing.
     */

    const recovered = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.transfer.updateMany({
        where: {
          id: transfer.id,
          status: 'PROCESSING',
          updatedAt: transfer.updatedAt,
        },
        data: {
          status: 'COMPLETED',
          completedAt: transfer.completedAt ?? new Date(),
          failureReason: null,
        },
      });

      if (claim.count !== 1) {
        return false;
      }

      const existingEvent = await tx.outboxEvent.findFirst({
        where: {
          aggregateId: transfer.id,
          eventType: 'wallet.transfer.completed',
        },
      });

      if (!existingEvent) {
        await tx.outboxEvent.create({
          data: {
            producer: OutboxEventProducer.Wallet,
            aggregateType: 'TRANSFER',
            aggregateId: transfer.id,
            eventType: 'wallet.transfer.completed',
            payload: {
              transferId: transfer.id,
              sourceWalletId: transfer.sourceWalletId,
              destinationWalletId: transfer.destinationWalletId,
              amount: transfer.amount.toString(),
              currency: transfer.currency,
              recovered: true,
              completedAt: (transfer.completedAt ?? new Date()).toISOString(),
            },
            status: 'PENDING',
          },
        });
      }

      return true;
    });

    if (recovered) {
      this.metrics?.recordRecoveryEvent(
        'transfer_recovery',
        'recovered_completed',
      );

      this.logger.warn(
        `Stale committed transfer recovered as COMPLETED: ${transfer.id}`,
      );
    } else {
      this.metrics?.recordRecoveryEvent(
        'transfer_recovery',
        'skipped_concurrent',
      );
    }
  }
}
