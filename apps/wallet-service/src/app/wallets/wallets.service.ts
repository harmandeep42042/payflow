import { WalletEventPattern } from '@payflow/shared-events';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransferWalletDto } from './dto/transfer-wallet.dto';
import { PrismaService } from '@payflow/database';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { DepositWalletDto } from './dto/deposit-wallet.dto';
import { WithdrawWalletDto } from './dto/withdraw-wallet.dto';
import { TransactionHistoryQueryDto } from './dto/transaction-history-query.dto';

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  getStatus() {
    return {
      status: 'ok',
      feature: 'wallets',
      message: 'Wallet module is working',
    };
  }

  async createWallet(dto: CreateWalletDto) {
    const userId = dto.userId.trim();
    const currency = dto.currency.trim().toUpperCase();

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('User is not active');
    }

    const existingWallet = await this.prisma.wallet.findUnique({
      where: {
        userId_currency: {
          userId,
          currency,
        },
      },
    });

    if (existingWallet) {
      throw new ConflictException(
        `Wallet already exists for currency ${currency}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.create({
        data: {
          userId,
          currency,
        },
      });

      const ledgerAccount = await tx.ledgerAccount.create({
        data: {
          walletId: wallet.id,
          code: `WALLET-${wallet.id}`,
          name: `${currency} Customer Wallet`,
          type: 'CUSTOMER',
          currency,
        },
      });

      return {
        wallet,
        ledgerAccount,
      };
    });

    return {
      id: result.wallet.id,
      userId: result.wallet.userId,
      currency: result.wallet.currency,
      balance: result.wallet.balance.toString(),
      status: result.wallet.status,
      version: result.wallet.version,
      createdAt: result.wallet.createdAt,
      updatedAt: result.wallet.updatedAt,
      ledgerAccount: {
        id: result.ledgerAccount.id,
        walletId: result.ledgerAccount.walletId,
        code: result.ledgerAccount.code,
        name: result.ledgerAccount.name,
        type: result.ledgerAccount.type,
        currency: result.ledgerAccount.currency,
        status: result.ledgerAccount.status,
      },
    };
  }

  async depositWallet(dto: DepositWalletDto) {
    const walletId = dto.walletId.trim();
    const currency = dto.currency.trim().toUpperCase();
    const amount = dto.amount.trim();
    const idempotencyKey = dto.idempotencyKey.trim();
    const reference = dto.reference.trim();

    const existingDeposit = await this.prisma.deposit.findUnique({
      where: {
        idempotencyKey,
      },
      include: {
        wallet: true,
      },
    });

    if (existingDeposit) {
      return {
        id: existingDeposit.id,
        idempotencyKey: existingDeposit.idempotencyKey,
        walletId: existingDeposit.walletId,
        amount: existingDeposit.amount.toString(),
        currency: existingDeposit.currency,
        reference: existingDeposit.reference,
        status: existingDeposit.status,
        completedAt: existingDeposit.completedAt,
        walletBalance: existingDeposit.wallet.balance.toString(),
        replayed: true,
      };
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: {
        id: walletId,
      },
      include: {
        ledgerAccount: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.status !== 'ACTIVE') {
      throw new BadRequestException('Wallet is not active');
    }

    if (wallet.currency !== currency) {
      throw new BadRequestException(
        `Wallet currency is ${wallet.currency}, but request currency is ${currency}`,
      );
    }

    if (!wallet.ledgerAccount) {
      throw new NotFoundException(
        'Customer ledger account not found for this wallet',
      );
    }

    const customerLedgerAccountId = wallet.ledgerAccount.id;

    const result = await this.prisma.$transaction(async (tx) => {
      const systemLedgerAccount = await tx.ledgerAccount.upsert({
        where: {
          code: `SYSTEM-CASH-${currency}`,
        },
        update: {},
        create: {
          code: `SYSTEM-CASH-${currency}`,
          name: `${currency} System Cash Account`,
          type: 'SYSTEM',
          currency,
          status: 'ACTIVE',
        },
      });

      const deposit = await tx.deposit.create({
        data: {
          idempotencyKey,
          walletId,
          amount,
          currency,
          reference,
          status: 'PROCESSING',
        },
      });

      const walletUpdate = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          version: wallet.version,
          status: 'ACTIVE',
        },
        data: {
          balance: {
            increment: amount,
          },
          version: {
            increment: 1,
          },
        },
      });

      if (walletUpdate.count !== 1) {
        throw new ConflictException(
          'Wallet was updated by another transaction. Please retry.',
        );
      }

      const systemDebitEntry = await tx.ledgerEntry.create({
        data: {
          depositId: deposit.id,
          ledgerAccountId: systemLedgerAccount.id,
          entryType: 'DEBIT',
          amount,
          currency,
        },
      });

      const customerCreditEntry = await tx.ledgerEntry.create({
        data: {
          depositId: deposit.id,
          ledgerAccountId: customerLedgerAccountId,
          entryType: 'CREDIT',
          amount,
          currency,
        },
      });

      const updatedDeposit = await tx.deposit.update({
        where: {
          id: deposit.id,
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      const updatedWallet = await tx.wallet.findUnique({
        where: {
          id: walletId,
        },
      });

      if (!updatedWallet) {
        throw new NotFoundException('Updated wallet not found');
      }

      const outboxEvent = await tx.outboxEvent.create({
        data: {
          aggregateType: 'DEPOSIT',
          aggregateId: updatedDeposit.id,
          eventType: WalletEventPattern.DepositCompleted,
          payload: {
            depositId: updatedDeposit.id,
            walletId,
            userId: updatedWallet.userId,
            amount,
            currency,
            reference,
            idempotencyKey,
            newBalance: updatedWallet.balance.toString(),
            completedAt: updatedDeposit.completedAt?.toISOString(),
          },
          status: 'PENDING',
        },
      });

      return {
        deposit: updatedDeposit,
        wallet: updatedWallet,
        systemDebitEntry,
        customerCreditEntry,
        outboxEvent,
      };
    });

    return {
      id: result.deposit.id,
      idempotencyKey: result.deposit.idempotencyKey,
      walletId: result.deposit.walletId,
      amount: result.deposit.amount.toString(),
      currency: result.deposit.currency,
      reference: result.deposit.reference,
      status: result.deposit.status,
      completedAt: result.deposit.completedAt,
      wallet: {
        id: result.wallet.id,
        balance: result.wallet.balance.toString(),
        currency: result.wallet.currency,
        version: result.wallet.version,
      },
      ledgerEntries: {
        debit: {
          id: result.systemDebitEntry.id,
          ledgerAccountId: result.systemDebitEntry.ledgerAccountId,
          entryType: result.systemDebitEntry.entryType,
          amount: result.systemDebitEntry.amount.toString(),
        },
        credit: {
          id: result.customerCreditEntry.id,
          ledgerAccountId: result.customerCreditEntry.ledgerAccountId,
          entryType: result.customerCreditEntry.entryType,
          amount: result.customerCreditEntry.amount.toString(),
        },
      },
      outboxEvent: {
        id: result.outboxEvent.id,
        eventType: result.outboxEvent.eventType,
        status: result.outboxEvent.status,
      },
      replayed: false,
    };
  }

  async withdrawWallet(dto: WithdrawWalletDto) {
    const walletId = dto.walletId.trim();
    const currency = dto.currency.trim().toUpperCase();
    const amount = dto.amount.trim();
    const idempotencyKey = dto.idempotencyKey.trim();
    const reference = dto.reference.trim();

    const existingWithdrawal = await this.prisma.withdrawal.findUnique({
      where: {
        idempotencyKey,
      },
      include: {
        wallet: true,
      },
    });

    if (existingWithdrawal) {
      return {
        id: existingWithdrawal.id,
        idempotencyKey: existingWithdrawal.idempotencyKey,
        walletId: existingWithdrawal.walletId,
        amount: existingWithdrawal.amount.toString(),
        currency: existingWithdrawal.currency,
        reference: existingWithdrawal.reference,
        status: existingWithdrawal.status,
        completedAt: existingWithdrawal.completedAt,
        walletBalance: existingWithdrawal.wallet.balance.toString(),
        replayed: true,
      };
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: {
        id: walletId,
      },
      include: {
        ledgerAccount: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.status !== 'ACTIVE') {
      throw new BadRequestException('Wallet is not active');
    }

    if (wallet.currency !== currency) {
      throw new BadRequestException(
        `Wallet currency is ${wallet.currency}, but request currency is ${currency}`,
      );
    }

    if (!wallet.ledgerAccount) {
      throw new NotFoundException(
        'Customer ledger account not found for this wallet',
      );
    }

    const requestedAmount = Number(amount);
    const currentBalance = Number(wallet.balance.toString());

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new BadRequestException(
        'Withdrawal amount must be greater than zero',
      );
    }

    if (currentBalance < requestedAmount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const customerLedgerAccountId = wallet.ledgerAccount.id;

    const result = await this.prisma.$transaction(async (tx) => {
      const systemLedgerAccount = await tx.ledgerAccount.upsert({
        where: {
          code: `SYSTEM-CASH-${currency}`,
        },
        update: {},
        create: {
          code: `SYSTEM-CASH-${currency}`,
          name: `${currency} System Cash Account`,
          type: 'SYSTEM',
          currency,
          status: 'ACTIVE',
        },
      });

      const withdrawal = await tx.withdrawal.create({
        data: {
          idempotencyKey,
          walletId,
          amount,
          currency,
          reference,
          status: 'PROCESSING',
        },
      });

      const walletUpdate = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          version: wallet.version,
          status: 'ACTIVE',
          balance: {
            gte: amount,
          },
        },
        data: {
          balance: {
            decrement: amount,
          },
          version: {
            increment: 1,
          },
        },
      });

      if (walletUpdate.count !== 1) {
        throw new ConflictException(
          'Wallet balance or version changed. Please retry the withdrawal.',
        );
      }

      const customerDebitEntry = await tx.ledgerEntry.create({
        data: {
          withdrawalId: withdrawal.id,
          ledgerAccountId: customerLedgerAccountId,
          entryType: 'DEBIT',
          amount,
          currency,
        },
      });

      const systemCreditEntry = await tx.ledgerEntry.create({
        data: {
          withdrawalId: withdrawal.id,
          ledgerAccountId: systemLedgerAccount.id,
          entryType: 'CREDIT',
          amount,
          currency,
        },
      });

      const updatedWithdrawal = await tx.withdrawal.update({
        where: {
          id: withdrawal.id,
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      const updatedWallet = await tx.wallet.findUnique({
        where: {
          id: walletId,
        },
      });

      if (!updatedWallet) {
        throw new NotFoundException('Updated wallet not found');
      }

      const outboxEvent = await tx.outboxEvent.create({
        data: {
          aggregateType: 'WITHDRAWAL',
          aggregateId: updatedWithdrawal.id,
          eventType: WalletEventPattern.WithdrawalCompleted,
          payload: {
            withdrawalId: updatedWithdrawal.id,
            walletId,
            userId: updatedWallet.userId,
            amount,
            currency,
            reference,
            idempotencyKey,
            newBalance: updatedWallet.balance.toString(),
            completedAt: updatedWithdrawal.completedAt?.toISOString(),
          },
          status: 'PENDING',
        },
      });

      return {
        withdrawal: updatedWithdrawal,
        wallet: updatedWallet,
        customerDebitEntry,
        systemCreditEntry,
        outboxEvent,
      };
    });

    return {
      id: result.withdrawal.id,
      idempotencyKey: result.withdrawal.idempotencyKey,
      walletId: result.withdrawal.walletId,
      amount: result.withdrawal.amount.toString(),
      currency: result.withdrawal.currency,
      reference: result.withdrawal.reference,
      status: result.withdrawal.status,
      completedAt: result.withdrawal.completedAt,
      wallet: {
        id: result.wallet.id,
        balance: result.wallet.balance.toString(),
        currency: result.wallet.currency,
        version: result.wallet.version,
      },
      ledgerEntries: {
        debit: {
          id: result.customerDebitEntry.id,
          ledgerAccountId: result.customerDebitEntry.ledgerAccountId,
          entryType: result.customerDebitEntry.entryType,
          amount: result.customerDebitEntry.amount.toString(),
        },
        credit: {
          id: result.systemCreditEntry.id,
          ledgerAccountId: result.systemCreditEntry.ledgerAccountId,
          entryType: result.systemCreditEntry.entryType,
          amount: result.systemCreditEntry.amount.toString(),
        },
      },
      outboxEvent: {
        id: result.outboxEvent.id,
        eventType: result.outboxEvent.eventType,
        status: result.outboxEvent.status,
      },
      replayed: false,
    };
  }

  async transferWallet(dto: TransferWalletDto) {
    const sourceWalletId = dto.sourceWalletId.trim();
    const destinationWalletId = dto.destinationWalletId.trim();
    const currency = dto.currency.trim().toUpperCase();
    const amount = dto.amount.trim();
    const idempotencyKey = dto.idempotencyKey.trim();
    const description = dto.description?.trim();

    if (sourceWalletId === destinationWalletId) {
      throw new BadRequestException(
        'Source and destination wallet cannot be the same',
      );
    }

    const requestedAmount = Number(amount);

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new BadRequestException(
        'Transfer amount must be greater than zero',
      );
    }

    const existingTransfer = await this.prisma.transfer.findUnique({
      where: {
        idempotencyKey,
      },
      include: {
        sourceWallet: true,
        destinationWallet: true,
      },
    });

    if (existingTransfer) {
      return {
        id: existingTransfer.id,
        idempotencyKey: existingTransfer.idempotencyKey,
        sourceWalletId: existingTransfer.sourceWalletId,
        destinationWalletId: existingTransfer.destinationWalletId,
        amount: existingTransfer.amount.toString(),
        currency: existingTransfer.currency,
        description: existingTransfer.description,
        status: existingTransfer.status,
        completedAt: existingTransfer.completedAt,
        sourceWallet: {
          id: existingTransfer.sourceWallet.id,
          balance: existingTransfer.sourceWallet.balance.toString(),
          currency: existingTransfer.sourceWallet.currency,
          version: existingTransfer.sourceWallet.version,
        },
        destinationWallet: {
          id: existingTransfer.destinationWallet.id,
          balance: existingTransfer.destinationWallet.balance.toString(),
          currency: existingTransfer.destinationWallet.currency,
          version: existingTransfer.destinationWallet.version,
        },
        replayed: true,
      };
    }

    const [sourceWallet, destinationWallet] = await Promise.all([
      this.prisma.wallet.findUnique({
        where: {
          id: sourceWalletId,
        },
        include: {
          ledgerAccount: true,
        },
      }),
      this.prisma.wallet.findUnique({
        where: {
          id: destinationWalletId,
        },
        include: {
          ledgerAccount: true,
        },
      }),
    ]);

    if (!sourceWallet) {
      throw new NotFoundException('Source wallet not found');
    }

    if (!destinationWallet) {
      throw new NotFoundException('Destination wallet not found');
    }

    if (sourceWallet.status !== 'ACTIVE') {
      throw new BadRequestException('Source wallet is not active');
    }

    if (destinationWallet.status !== 'ACTIVE') {
      throw new BadRequestException('Destination wallet is not active');
    }

    if (
      sourceWallet.currency !== currency ||
      destinationWallet.currency !== currency
    ) {
      throw new BadRequestException(
        'Source wallet, destination wallet, and request currency must match',
      );
    }

    if (!sourceWallet.ledgerAccount) {
      throw new NotFoundException(
        'Source wallet ledger account not found',
      );
    }

    if (!destinationWallet.ledgerAccount) {
      throw new NotFoundException(
        'Destination wallet ledger account not found',
      );
    }

    if (Number(sourceWallet.balance.toString()) < requestedAmount) {
      throw new BadRequestException(
        'Insufficient source wallet balance',
      );
    }

    const sourceLedgerAccountId = sourceWallet.ledgerAccount.id;
    const destinationLedgerAccountId =
      destinationWallet.ledgerAccount.id;

    const result = await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          idempotencyKey,
          sourceWalletId,
          destinationWalletId,
          amount,
          currency,
          description,
          status: 'PROCESSING',
        },
      });

      const sourceUpdate = await tx.wallet.updateMany({
        where: {
          id: sourceWallet.id,
          version: sourceWallet.version,
          status: 'ACTIVE',
          balance: {
            gte: amount,
          },
        },
        data: {
          balance: {
            decrement: amount,
          },
          version: {
            increment: 1,
          },
        },
      });

      if (sourceUpdate.count !== 1) {
        throw new ConflictException(
          'Source wallet balance or version changed. Please retry.',
        );
      }

      const destinationUpdate = await tx.wallet.updateMany({
        where: {
          id: destinationWallet.id,
          version: destinationWallet.version,
          status: 'ACTIVE',
        },
        data: {
          balance: {
            increment: amount,
          },
          version: {
            increment: 1,
          },
        },
      });

      if (destinationUpdate.count !== 1) {
        throw new ConflictException(
          'Destination wallet version changed. Please retry.',
        );
      }

      const debitEntry = await tx.ledgerEntry.create({
        data: {
          transferId: transfer.id,
          ledgerAccountId: sourceLedgerAccountId,
          entryType: 'DEBIT',
          amount,
          currency,
        },
      });

      const creditEntry = await tx.ledgerEntry.create({
        data: {
          transferId: transfer.id,
          ledgerAccountId: destinationLedgerAccountId,
          entryType: 'CREDIT',
          amount,
          currency,
        },
      });

      const updatedTransfer = await tx.transfer.update({
        where: {
          id: transfer.id,
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      const [updatedSourceWallet, updatedDestinationWallet] =
        await Promise.all([
          tx.wallet.findUnique({
            where: {
              id: sourceWalletId,
            },
          }),
          tx.wallet.findUnique({
            where: {
              id: destinationWalletId,
            },
          }),
        ]);

      if (!updatedSourceWallet || !updatedDestinationWallet) {
        throw new NotFoundException(
          'Updated wallet records not found',
        );
      }

      const outboxEvent = await tx.outboxEvent.create({
        data: {
          aggregateType: 'TRANSFER',
          aggregateId: updatedTransfer.id,
          eventType: WalletEventPattern.TransferCompleted,
          payload: {
            transferId: updatedTransfer.id,
            sourceWalletId,
            destinationWalletId,
            amount,
            currency,
            description: description ?? null,
            idempotencyKey,
            sourceWalletBalance:
              updatedSourceWallet.balance.toString(),
            destinationWalletBalance:
              updatedDestinationWallet.balance.toString(),
            completedAt:
              updatedTransfer.completedAt?.toISOString() ?? null,
          },
          status: 'PENDING',
        },
      });

      return {
        transfer: updatedTransfer,
        sourceWallet: updatedSourceWallet,
        destinationWallet: updatedDestinationWallet,
        debitEntry,
        creditEntry,
        outboxEvent,
      };
    });

    return {
      id: result.transfer.id,
      idempotencyKey: result.transfer.idempotencyKey,
      sourceWalletId: result.transfer.sourceWalletId,
      destinationWalletId: result.transfer.destinationWalletId,
      amount: result.transfer.amount.toString(),
      currency: result.transfer.currency,
      description: result.transfer.description,
      status: result.transfer.status,
      completedAt: result.transfer.completedAt,
      sourceWallet: {
        id: result.sourceWallet.id,
        balance: result.sourceWallet.balance.toString(),
        currency: result.sourceWallet.currency,
        version: result.sourceWallet.version,
      },
      destinationWallet: {
        id: result.destinationWallet.id,
        balance: result.destinationWallet.balance.toString(),
        currency: result.destinationWallet.currency,
        version: result.destinationWallet.version,
      },
      ledgerEntries: {
        debit: {
          id: result.debitEntry.id,
          ledgerAccountId: result.debitEntry.ledgerAccountId,
          entryType: result.debitEntry.entryType,
          amount: result.debitEntry.amount.toString(),
        },
        credit: {
          id: result.creditEntry.id,
          ledgerAccountId: result.creditEntry.ledgerAccountId,
          entryType: result.creditEntry.entryType,
          amount: result.creditEntry.amount.toString(),
        },
      },
      outboxEvent: {
        id: result.outboxEvent.id,
        eventType: result.outboxEvent.eventType,
        status: result.outboxEvent.status,
      },
      replayed: false,
    };
  }

  async getWalletById(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: {
        id: walletId,
      },
      include: {
        ledgerAccount: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return {
      id: wallet.id,
      userId: wallet.userId,
      currency: wallet.currency,
      balance: wallet.balance.toString(),
      status: wallet.status,
      version: wallet.version,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
      ledgerAccount: wallet.ledgerAccount,
    };
  }

  async getUserWallets(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wallets = await this.prisma.wallet.findMany({
      where: {
        userId,
      },
      include: {
        ledgerAccount: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return wallets.map((wallet) => ({
      id: wallet.id,
      userId: wallet.userId,
      currency: wallet.currency,
      balance: wallet.balance.toString(),
      status: wallet.status,
      version: wallet.version,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
      ledgerAccount: wallet.ledgerAccount,
    }));
  }
  async getTransactionHistory(
    walletId: string,
    query: TransactionHistoryQueryDto,
  ) {
    const normalizedWalletId = walletId.trim();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const type = query.type ?? 'ALL';
    const skip = (page - 1) * limit;

    const wallet = await this.prisma.wallet.findUnique({
      where: {
        id: normalizedWalletId,
      },
      select: {
        id: true,
        userId: true,
        currency: true,
        balance: true,
        status: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const depositItems =
      type === 'ALL' || type === 'DEPOSIT'
        ? await this.prisma.deposit.findMany({
            where: {
              walletId: normalizedWalletId,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
        : [];

    const withdrawalItems =
      type === 'ALL' || type === 'WITHDRAWAL'
        ? await this.prisma.withdrawal.findMany({
            where: {
              walletId: normalizedWalletId,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
        : [];

    const transferItems =
      type === 'ALL' || type === 'TRANSFER'
        ? await this.prisma.transfer.findMany({
            where: {
              OR: [
                {
                  sourceWalletId: normalizedWalletId,
                },
                {
                  destinationWalletId: normalizedWalletId,
                },
              ],
            },
            include: {
              sourceWallet: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
              destinationWallet: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
        : [];

    const transactions = [
      ...depositItems.map((deposit) => ({
        id: deposit.id,
        type: 'DEPOSIT' as const,
        direction: 'CREDIT' as const,
        walletId: deposit.walletId,
        counterpartyWalletId: null,
        amount: deposit.amount.toString(),
        currency: deposit.currency,
        status: deposit.status,
        reference: deposit.reference,
        description: null,
        idempotencyKey: deposit.idempotencyKey,
        createdAt: deposit.createdAt,
        completedAt: deposit.completedAt,
      })),

      ...withdrawalItems.map((withdrawal) => ({
        id: withdrawal.id,
        type: 'WITHDRAWAL' as const,
        direction: 'DEBIT' as const,
        walletId: withdrawal.walletId,
        counterpartyWalletId: null,
        amount: withdrawal.amount.toString(),
        currency: withdrawal.currency,
        status: withdrawal.status,
        reference: withdrawal.reference,
        description: null,
        idempotencyKey: withdrawal.idempotencyKey,
        createdAt: withdrawal.createdAt,
        completedAt: withdrawal.completedAt,
      })),

      ...transferItems.map((transfer) => {
        const outgoing =
          transfer.sourceWalletId === normalizedWalletId;

        return {
          id: transfer.id,
          type: 'TRANSFER' as const,
          direction: outgoing
            ? ('DEBIT' as const)
            : ('CREDIT' as const),
          walletId: normalizedWalletId,
          counterpartyWalletId: outgoing
            ? transfer.destinationWalletId
            : transfer.sourceWalletId,
          sourceWalletId: transfer.sourceWalletId,
          destinationWalletId:
            transfer.destinationWalletId,

          counterparty: outgoing
            ? {
                walletId:
                  transfer.destinationWallet.id,
                userId:
                  transfer.destinationWallet.user.id,
                firstName:
                  transfer.destinationWallet.user.firstName,
                lastName:
                  transfer.destinationWallet.user.lastName,
                email:
                  transfer.destinationWallet.user.email,
              }
            : {
                walletId:
                  transfer.sourceWallet.id,
                userId:
                  transfer.sourceWallet.user.id,
                firstName:
                  transfer.sourceWallet.user.firstName,
                lastName:
                  transfer.sourceWallet.user.lastName,
                email:
                  transfer.sourceWallet.user.email,
              },

          amount: transfer.amount.toString(),
          currency: transfer.currency,
          status: transfer.status,
          reference: null,
          description: transfer.description,
          idempotencyKey: transfer.idempotencyKey,
          createdAt: transfer.createdAt,
          completedAt: transfer.completedAt,
        };
      }),
    ].sort(
      (first, second) =>
        second.createdAt.getTime() -
        first.createdAt.getTime(),
    );

    const total = transactions.length;
    const paginatedTransactions =
      transactions.slice(skip, skip + limit);

    return {
      wallet: {
        id: wallet.id,
        userId: wallet.userId,
        currency: wallet.currency,
        balance: wallet.balance.toString(),
        status: wallet.status,
      },

      filters: {
        type,
        page,
        limit,
      },

      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },

      transactions: paginatedTransactions,
    };
  }
}


