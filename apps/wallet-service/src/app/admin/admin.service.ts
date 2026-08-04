import { Injectable } from '@nestjs/common';
import { PrismaService } from '@payflow/database';

type RecentTransaction = {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  amount: string;
  currency: string;
  status: string;
  reference: string | null;
  description: string | null;
  walletId: string | null;
  sourceWalletId: string | null;
  destinationWalletId: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

export type AdminUserStatus =
  | 'ALL'
  | 'ACTIVE'
  | 'BLOCKED'
  | 'SUSPENDED';

export type AdminUserRole =
  | 'ALL'
  | 'USER'
  | 'ADMIN';

export type GetAdminUsersInput = {
  page?: number;
  limit?: number;
  search?: string;
  status?: AdminUserStatus;
  role?: AdminUserRole;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getDashboard() {
    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      suspendedUsers,
      totalWallets,
      activeWallets,
      frozenWallets,
      closedWallets,
      walletBalanceAggregate,
      totalDeposits,
      totalWithdrawals,
      totalTransfers,
      depositAmountAggregate,
      withdrawalAmountAggregate,
      transferAmountAggregate,
      recentUsers,
      recentDeposits,
      recentWithdrawals,
      recentTransfers,
    ] = await Promise.all([
      this.prisma.user.count(),

      this.prisma.user.count({
        where: {
          status: 'ACTIVE',
        },
      }),

      this.prisma.user.count({
        where: {
          status: 'BLOCKED',
        },
      }),

      this.prisma.user.count({
        where: {
          status: 'SUSPENDED',
        },
      }),

      this.prisma.wallet.count(),

      this.prisma.wallet.count({
        where: {
          status: 'ACTIVE',
        },
      }),

      this.prisma.wallet.count({
        where: {
          status: 'FROZEN',
        },
      }),

      this.prisma.wallet.count({
        where: {
          status: 'CLOSED',
        },
      }),

      this.prisma.wallet.aggregate({
        _sum: {
          balance: true,
        },
      }),

      this.prisma.deposit.count(),

      this.prisma.withdrawal.count(),

      this.prisma.transfer.count(),

      this.prisma.deposit.aggregate({
        where: {
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),

      this.prisma.withdrawal.aggregate({
        where: {
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),

      this.prisma.transfer.aggregate({
        where: {
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),

      this.prisma.user.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),

      this.prisma.deposit.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          walletId: true,
          amount: true,
          currency: true,
          reference: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      }),

      this.prisma.withdrawal.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          walletId: true,
          amount: true,
          currency: true,
          reference: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      }),

      this.prisma.transfer.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          sourceWalletId: true,
          destinationWalletId: true,
          amount: true,
          currency: true,
          description: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      }),
    ]);

    const recentTransactions: RecentTransaction[] = [
      ...recentDeposits.map((deposit) => ({
        id: deposit.id,
        type: 'DEPOSIT' as const,
        amount: deposit.amount.toString(),
        currency: deposit.currency,
        status: deposit.status,
        reference: deposit.reference,
        description: null,
        walletId: deposit.walletId,
        sourceWalletId: null,
        destinationWalletId: null,
        createdAt: deposit.createdAt,
        completedAt: deposit.completedAt,
      })),

      ...recentWithdrawals.map((withdrawal) => ({
        id: withdrawal.id,
        type: 'WITHDRAWAL' as const,
        amount: withdrawal.amount.toString(),
        currency: withdrawal.currency,
        status: withdrawal.status,
        reference: withdrawal.reference,
        description: null,
        walletId: withdrawal.walletId,
        sourceWalletId: null,
        destinationWalletId: null,
        createdAt: withdrawal.createdAt,
        completedAt: withdrawal.completedAt,
      })),

      ...recentTransfers.map((transfer) => ({
        id: transfer.id,
        type: 'TRANSFER' as const,
        amount: transfer.amount.toString(),
        currency: transfer.currency,
        status: transfer.status,
        reference: null,
        description: transfer.description,
        walletId: null,
        sourceWalletId: transfer.sourceWalletId,
        destinationWalletId:
          transfer.destinationWalletId,
        createdAt: transfer.createdAt,
        completedAt: transfer.completedAt,
      })),
    ]
      .sort(
        (first, second) =>
          second.createdAt.getTime() -
          first.createdAt.getTime(),
      )
      .slice(0, 10);

    const transactionCount =
      totalDeposits +
      totalWithdrawals +
      totalTransfers;

    return {
      stats: {
        totalUsers,
        activeUsers,
        blockedUsers,
        suspendedUsers,

        totalWallets,
        activeWallets,
        frozenWallets,
        closedWallets,

        totalTransactions:
          transactionCount,
        totalDeposits,
        totalWithdrawals,
        totalTransfers,

        totalBalance:
          walletBalanceAggregate
            ._sum
            .balance
            ?.toString() ?? '0',

        totalDepositAmount:
          depositAmountAggregate
            ._sum
            .amount
            ?.toString() ?? '0',

        totalWithdrawalAmount:
          withdrawalAmountAggregate
            ._sum
            .amount
            ?.toString() ?? '0',

        totalTransferAmount:
          transferAmountAggregate
            ._sum
            .amount
            ?.toString() ?? '0',
      },

      recentUsers,

      recentTransactions,
    };
  }

  async getUsers(
    input: GetAdminUsersInput = {},
  ) {
    const requestedPage =
      Number(input.page ?? 1);

    const requestedLimit =
      Number(input.limit ?? 10);

    const page =
      Number.isFinite(requestedPage) &&
      requestedPage > 0
        ? Math.floor(requestedPage)
        : 1;

    const limit =
      Number.isFinite(requestedLimit) &&
      requestedLimit > 0
        ? Math.min(
            Math.floor(requestedLimit),
            100,
          )
        : 10;

    const search =
      input.search
        ?.trim() ?? '';

    const status:
      AdminUserStatus =
        input.status ?? 'ALL';

    const role:
      AdminUserRole =
        input.role ?? 'ALL';

    const where = {
      ...(search
        ? {
            OR: [
              {
                email: {
                  contains: search,
                  mode:
                    'insensitive' as const,
                },
              },
              {
                firstName: {
                  contains: search,
                  mode:
                    'insensitive' as const,
                },
              },
              {
                lastName: {
                  contains: search,
                  mode:
                    'insensitive' as const,
                },
              },
              {
                phone: {
                  contains: search,
                },
              },
            ],
          }
        : {}),

      ...(status !== 'ALL'
        ? {
            status,
          }
        : {}),

      ...(role !== 'ALL'
        ? {
            role,
          }
        : {}),
    };

    const skip =
      (page - 1) * limit;

    const [
      users,
      total,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where,

        orderBy: {
          createdAt: 'desc',
        },

        skip,
        take: limit,

        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,

          wallets: {
            select: {
              id: true,
              currency: true,
              balance: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),

      this.prisma.user.count({
        where,
      }),
    ]);

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(total / limit);

    return {
      users: users.map((user) => ({
        ...user,

        wallets: user.wallets.map(
          (wallet) => ({
            ...wallet,
            balance:
              wallet.balance.toString(),
          }),
        ),

        walletCount:
          user.wallets.length,

        totalWalletBalance:
          user.wallets
            .reduce(
              (
                sum,
                wallet,
              ) =>
                sum +
                Number(
                  wallet.balance,
                ),
              0,
            )
            .toFixed(2),
      })),

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
        search,
        status,
        role,
      },
    };
  }

  async getWallets(
    input: {
      page?: number;
      limit?: number;
      search?: string;
      status?:
        | 'ALL'
        | 'ACTIVE'
        | 'FROZEN'
        | 'CLOSED';
      currency?: string;
    } = {},
  ) {
    const requestedPage =
      Number(input.page ?? 1);

    const requestedLimit =
      Number(input.limit ?? 10);

    const page =
      Number.isFinite(requestedPage) &&
      requestedPage > 0
        ? Math.floor(requestedPage)
        : 1;

    const limit =
      Number.isFinite(requestedLimit) &&
      requestedLimit > 0
        ? Math.min(
            Math.floor(requestedLimit),
            100,
          )
        : 10;

    const search =
      input.search?.trim() ?? '';

    const status =
      input.status ?? 'ALL';

    const currency =
      input.currency?.trim().toUpperCase() ??
      'ALL';

    const where = {
      ...(search
        ? {
            OR: [
              {
                id: {
                  contains: search,
                  mode:
                    'insensitive' as const,
                },
              },
              {
                user: {
                  email: {
                    contains: search,
                    mode:
                      'insensitive' as const,
                  },
                },
              },
              {
                user: {
                  firstName: {
                    contains: search,
                    mode:
                      'insensitive' as const,
                  },
                },
              },
              {
                user: {
                  lastName: {
                    contains: search,
                    mode:
                      'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),

      ...(status !== 'ALL'
        ? {
            status,
          }
        : {}),

      ...(currency !== 'ALL'
        ? {
            currency,
          }
        : {}),
    };

    const skip =
      (page - 1) * limit;

    const [
      wallets,
      total,
    ] = await Promise.all([
      this.prisma.wallet.findMany({
        where,

        orderBy: {
          createdAt: 'desc',
        },

        skip,
        take: limit,

        select: {
          id: true,
          userId: true,
          currency: true,
          balance: true,
          version: true,
          status: true,
          createdAt: true,
          updatedAt: true,

          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
              role: true,
              status: true,
            },
          },

          ledgerAccount: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              status: true,
            },
          },

          _count: {
            select: {
              deposits: true,
              withdrawals: true,
              outgoingTransfers: true,
              incomingTransfers: true,
            },
          },
        },
      }),

      this.prisma.wallet.count({
        where,
      }),
    ]);

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(total / limit);

    return {
      wallets: wallets.map(
        (wallet) => ({
          ...wallet,

          balance:
            wallet.balance.toString(),

          transactionCount:
            wallet._count.deposits +
            wallet._count.withdrawals +
            wallet._count
              .outgoingTransfers +
            wallet._count
              .incomingTransfers,
        }),
      ),

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
        search,
        status,
        currency,
      },
    };
  }

  async updateWalletStatus(
    walletId: string,
    status:
      | 'ACTIVE'
      | 'FROZEN'
      | 'CLOSED',
  ) {
    const wallet =
      await this.prisma.wallet.findUnique({
        where: {
          id: walletId,
        },

        select: {
          id: true,
          status: true,
          userId: true,
          currency: true,
          balance: true,
        },
      });

    if (!wallet) {
      throw new Error(
        'Wallet not found',
      );
    }

    if (
      wallet.status === 'CLOSED'
    ) {
      throw new Error(
        'Closed wallet status cannot be changed',
      );
    }

    if (
      status === 'CLOSED' &&
      Number(wallet.balance) !== 0
    ) {
      throw new Error(
        'Wallet balance must be zero before closing',
      );
    }

    const updatedWallet =
      await this.prisma.wallet.update({
        where: {
          id: walletId,
        },

        data: {
          status,
        },

        select: {
          id: true,
          userId: true,
          currency: true,
          balance: true,
          version: true,
          status: true,
          createdAt: true,
          updatedAt: true,

          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

    return {
      message:
        `Wallet status changed to ${status}`,

      wallet: {
        ...updatedWallet,
        balance:
          updatedWallet.balance.toString(),
      },
    };
  }

  async getTransactions(
    input: {
      page?: number;
      limit?: number;
      search?: string;
      type?:
        | 'ALL'
        | 'DEPOSIT'
        | 'WITHDRAWAL'
        | 'TRANSFER';
      status?: string;
    } = {},
  ) {
    const requestedPage =
      Number(input.page ?? 1);

    const requestedLimit =
      Number(input.limit ?? 10);

    const page =
      Number.isFinite(requestedPage) &&
      requestedPage > 0
        ? Math.floor(requestedPage)
        : 1;

    const limit =
      Number.isFinite(requestedLimit) &&
      requestedLimit > 0
        ? Math.min(
            Math.floor(requestedLimit),
            100,
          )
        : 10;

    const search =
      input.search?.trim() ?? '';

    const type =
      input.type ?? 'ALL';

    const status =
      input.status?.trim() ?? 'ALL';

    const commonSearch = search
      ? {
          OR: [
            {
              id: {
                contains: search,
                mode:
                  'insensitive' as const,
              },
            },
            {
              walletId: {
                contains: search,
                mode:
                  'insensitive' as const,
              },
            },
            {
              reference: {
                contains: search,
                mode:
                  'insensitive' as const,
              },
            },
          ],
        }
      : {};

    const depositWhere = {
      ...commonSearch,

      ...(status !== 'ALL'
        ? {
            status:
              status as
                | 'PENDING'
                | 'PROCESSING'
                | 'COMPLETED'
                | 'FAILED'
                | 'REVERSED',
          }
        : {}),
    };

    const withdrawalWhere = {
      ...commonSearch,

      ...(status !== 'ALL'
        ? {
            status:
              status as
                | 'PENDING'
                | 'PROCESSING'
                | 'COMPLETED'
                | 'FAILED'
                | 'REVERSED',
          }
        : {}),
    };

    const transferSearch = search
      ? {
          OR: [
            {
              id: {
                contains: search,
                mode:
                  'insensitive' as const,
              },
            },
            {
              sourceWalletId: {
                contains: search,
                mode:
                  'insensitive' as const,
              },
            },
            {
              destinationWalletId: {
                contains: search,
                mode:
                  'insensitive' as const,
              },
            },
            {
              description: {
                contains: search,
                mode:
                  'insensitive' as const,
              },
            },
          ],
        }
      : {};

    const transferWhere = {
      ...transferSearch,

      ...(status !== 'ALL'
        ? {
            status:
              status as
                | 'PENDING'
                | 'PROCESSING'
                | 'COMPLETED'
                | 'FAILED'
                | 'REVERSED',
          }
        : {}),
    };

    const [
      deposits,
      withdrawals,
      transfers,
    ] = await Promise.all([
      type === 'ALL' ||
      type === 'DEPOSIT'
        ? this.prisma.deposit.findMany({
            where: depositWhere,

            orderBy: {
              createdAt: 'desc',
            },

            select: {
              id: true,
              walletId: true,
              amount: true,
              currency: true,
              reference: true,
              status: true,
              failureReason: true,
              createdAt: true,
              completedAt: true,

              wallet: {
                select: {
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
          })
        : Promise.resolve([]),

      type === 'ALL' ||
      type === 'WITHDRAWAL'
        ? this.prisma.withdrawal.findMany({
            where: withdrawalWhere,

            orderBy: {
              createdAt: 'desc',
            },

            select: {
              id: true,
              walletId: true,
              amount: true,
              currency: true,
              reference: true,
              status: true,
              failureReason: true,
              createdAt: true,
              completedAt: true,

              wallet: {
                select: {
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
          })
        : Promise.resolve([]),

      type === 'ALL' ||
      type === 'TRANSFER'
        ? this.prisma.transfer.findMany({
            where: transferWhere,

            orderBy: {
              createdAt: 'desc',
            },

            select: {
              id: true,
              sourceWalletId: true,
              destinationWalletId: true,
              amount: true,
              currency: true,
              description: true,
              status: true,
              failureReason: true,
              createdAt: true,
              completedAt: true,

              sourceWallet: {
                select: {
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
          })
        : Promise.resolve([]),
    ]);

    const transactions = [
      ...deposits.map((deposit) => ({
        id: deposit.id,
        type: 'DEPOSIT' as const,
        amount: deposit.amount.toString(),
        currency: deposit.currency,
        status: deposit.status,
        reference: deposit.reference,
        description: null,
        failureReason:
          deposit.failureReason,
        walletId: deposit.walletId,
        sourceWalletId: null,
        destinationWalletId: null,
        user: deposit.wallet.user,
        destinationUser: null,
        createdAt: deposit.createdAt,
        completedAt:
          deposit.completedAt,
      })),

      ...withdrawals.map(
        (withdrawal) => ({
          id: withdrawal.id,
          type:
            'WITHDRAWAL' as const,
          amount:
            withdrawal.amount.toString(),
          currency:
            withdrawal.currency,
          status:
            withdrawal.status,
          reference:
            withdrawal.reference,
          description: null,
          failureReason:
            withdrawal.failureReason,
          walletId:
            withdrawal.walletId,
          sourceWalletId: null,
          destinationWalletId: null,
          user:
            withdrawal.wallet.user,
          destinationUser: null,
          createdAt:
            withdrawal.createdAt,
          completedAt:
            withdrawal.completedAt,
        }),
      ),

      ...transfers.map((transfer) => ({
        id: transfer.id,
        type: 'TRANSFER' as const,
        amount:
          transfer.amount.toString(),
        currency:
          transfer.currency,
        status:
          transfer.status,
        reference: null,
        description:
          transfer.description,
        failureReason:
          transfer.failureReason,
        walletId: null,
        sourceWalletId:
          transfer.sourceWalletId,
        destinationWalletId:
          transfer.destinationWalletId,
        user:
          transfer.sourceWallet.user,
        destinationUser:
          transfer.destinationWallet.user,
        createdAt:
          transfer.createdAt,
        completedAt:
          transfer.completedAt,
      })),
    ].sort(
      (first, second) =>
        second.createdAt.getTime() -
        first.createdAt.getTime(),
    );

    const total =
      transactions.length;

    const skip =
      (page - 1) * limit;

    const paginatedTransactions =
      transactions.slice(
        skip,
        skip + limit,
      );

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(total / limit);

    return {
      transactions:
        paginatedTransactions,

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
        search,
        type,
        status,
      },
    };
  }

  async getTransactionById(
    transactionId: string,
  ) {
    const [
      deposit,
      withdrawal,
      transfer,
    ] = await Promise.all([
      this.prisma.deposit.findUnique({
        where: {
          id: transactionId,
        },

        select: {
          id: true,
          walletId: true,
          amount: true,
          currency: true,
          reference: true,
          status: true,
          failureReason: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,

          wallet: {
            select: {
              id: true,
              userId: true,
              currency: true,
              balance: true,
              status: true,

              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  status: true,
                },
              },

              ledgerAccount: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                  currency: true,
                  status: true,
                },
              },
            },
          },

          ledgerEntries: {
            orderBy: {
              createdAt: 'asc',
            },

            select: {
              id: true,
              ledgerAccountId: true,
              entryType: true,
              amount: true,
              currency: true,
              createdAt: true,

              ledgerAccount: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                  status: true,
                },
              },
            },
          },
        },
      }),

      this.prisma.withdrawal.findUnique({
        where: {
          id: transactionId,
        },

        select: {
          id: true,
          walletId: true,
          amount: true,
          currency: true,
          reference: true,
          status: true,
          failureReason: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,

          wallet: {
            select: {
              id: true,
              userId: true,
              currency: true,
              balance: true,
              status: true,

              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  status: true,
                },
              },

              ledgerAccount: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                  currency: true,
                  status: true,
                },
              },
            },
          },

          ledgerEntries: {
            orderBy: {
              createdAt: 'asc',
            },

            select: {
              id: true,
              ledgerAccountId: true,
              entryType: true,
              amount: true,
              currency: true,
              createdAt: true,

              ledgerAccount: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                  status: true,
                },
              },
            },
          },
        },
      }),

      this.prisma.transfer.findUnique({
        where: {
          id: transactionId,
        },

        select: {
          id: true,
          sourceWalletId: true,
          destinationWalletId: true,
          amount: true,
          currency: true,
          description: true,
          status: true,
          failureReason: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,

          sourceWallet: {
            select: {
              id: true,
              userId: true,
              currency: true,
              balance: true,
              status: true,

              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  status: true,
                },
              },

              ledgerAccount: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                  currency: true,
                  status: true,
                },
              },
            },
          },

          destinationWallet: {
            select: {
              id: true,
              userId: true,
              currency: true,
              balance: true,
              status: true,

              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  status: true,
                },
              },

              ledgerAccount: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                  currency: true,
                  status: true,
                },
              },
            },
          },

          ledgerEntries: {
            orderBy: {
              createdAt: 'asc',
            },

            select: {
              id: true,
              ledgerAccountId: true,
              entryType: true,
              amount: true,
              currency: true,
              createdAt: true,

              ledgerAccount: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (deposit) {
      return {
        type: 'DEPOSIT',

        transaction: {
          ...deposit,
          amount:
            deposit.amount.toString(),

          wallet: {
            ...deposit.wallet,
            balance:
              deposit.wallet.balance.toString(),
          },

          ledgerEntries:
            deposit.ledgerEntries.map(
              (entry) => ({
                ...entry,
                amount:
                  entry.amount.toString(),
              }),
            ),
        },
      };
    }

    if (withdrawal) {
      return {
        type: 'WITHDRAWAL',

        transaction: {
          ...withdrawal,
          amount:
            withdrawal.amount.toString(),

          wallet: {
            ...withdrawal.wallet,
            balance:
              withdrawal.wallet.balance.toString(),
          },

          ledgerEntries:
            withdrawal.ledgerEntries.map(
              (entry) => ({
                ...entry,
                amount:
                  entry.amount.toString(),
              }),
            ),
        },
      };
    }

    if (transfer) {
      return {
        type: 'TRANSFER',

        transaction: {
          ...transfer,
          amount:
            transfer.amount.toString(),

          sourceWallet: {
            ...transfer.sourceWallet,
            balance:
              transfer.sourceWallet.balance.toString(),
          },

          destinationWallet: {
            ...transfer.destinationWallet,
            balance:
              transfer.destinationWallet.balance.toString(),
          },

          ledgerEntries:
            transfer.ledgerEntries.map(
              (entry) => ({
                ...entry,
                amount:
                  entry.amount.toString(),
              }),
            ),
        },
      };
    }

    throw new Error(
      'Transaction not found',
    );
  }

  async getAnalytics(
    input: {
      days?: number;
    } = {},
  ) {
    const requestedDays =
      Number(input.days ?? 7);

    const days =
      Number.isFinite(requestedDays) &&
      requestedDays > 0
        ? Math.min(
            Math.floor(requestedDays),
            90,
          )
        : 7;

    const startDate = new Date();

    startDate.setHours(
      0,
      0,
      0,
      0,
    );

    startDate.setDate(
      startDate.getDate() -
        (days - 1),
    );

    const [
      deposits,
      withdrawals,
      transfers,
      newUsers,
      newWallets,
    ] = await Promise.all([
      this.prisma.deposit.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },

        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      }),

      this.prisma.withdrawal.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },

        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      }),

      this.prisma.transfer.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },

        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      }),

      this.prisma.user.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },

        select: {
          id: true,
          createdAt: true,
        },
      }),

      this.prisma.wallet.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },

        select: {
          id: true,
          createdAt: true,
        },
      }),
    ]);

    function getDateKey(
      value: Date,
    ): string {
      return value
        .toISOString()
        .slice(0, 10);
    }

    const dailyMap =
      new Map<
        string,
        {
          date: string;
          deposits: number;
          withdrawals: number;
          transfers: number;
          transactionCount: number;
          depositAmount: number;
          withdrawalAmount: number;
          transferAmount: number;
          transactionVolume: number;
          newUsers: number;
          newWallets: number;
        }
      >();

    for (
      let index = 0;
      index < days;
      index += 1
    ) {
      const currentDate =
        new Date(startDate);

      currentDate.setDate(
        startDate.getDate() +
          index,
      );

      const date =
        getDateKey(currentDate);

      dailyMap.set(date, {
        date,
        deposits: 0,
        withdrawals: 0,
        transfers: 0,
        transactionCount: 0,
        depositAmount: 0,
        withdrawalAmount: 0,
        transferAmount: 0,
        transactionVolume: 0,
        newUsers: 0,
        newWallets: 0,
      });
    }

    for (const deposit of deposits) {
      const date =
        getDateKey(
          deposit.createdAt,
        );

      const daily =
        dailyMap.get(date);

      if (!daily) {
        continue;
      }

      daily.deposits += 1;
      daily.transactionCount += 1;

      if (
        deposit.status ===
        'COMPLETED'
      ) {
        const amount =
          Number(deposit.amount);

        daily.depositAmount +=
          amount;

        daily.transactionVolume +=
          amount;
      }
    }

    for (
      const withdrawal
      of withdrawals
    ) {
      const date =
        getDateKey(
          withdrawal.createdAt,
        );

      const daily =
        dailyMap.get(date);

      if (!daily) {
        continue;
      }

      daily.withdrawals += 1;
      daily.transactionCount += 1;

      if (
        withdrawal.status ===
        'COMPLETED'
      ) {
        const amount =
          Number(
            withdrawal.amount,
          );

        daily.withdrawalAmount +=
          amount;

        daily.transactionVolume +=
          amount;
      }
    }

    for (const transfer of transfers) {
      const date =
        getDateKey(
          transfer.createdAt,
        );

      const daily =
        dailyMap.get(date);

      if (!daily) {
        continue;
      }

      daily.transfers += 1;
      daily.transactionCount += 1;

      if (
        transfer.status ===
        'COMPLETED'
      ) {
        const amount =
          Number(transfer.amount);

        daily.transferAmount +=
          amount;

        daily.transactionVolume +=
          amount;
      }
    }

    for (const user of newUsers) {
      const date =
        getDateKey(
          user.createdAt,
        );

      const daily =
        dailyMap.get(date);

      if (daily) {
        daily.newUsers += 1;
      }
    }

    for (const wallet of newWallets) {
      const date =
        getDateKey(
          wallet.createdAt,
        );

      const daily =
        dailyMap.get(date);

      if (daily) {
        daily.newWallets += 1;
      }
    }

    const allTransactions = [
      ...deposits,
      ...withdrawals,
      ...transfers,
    ];

    const completedTransactions =
      allTransactions.filter(
        (transaction) =>
          transaction.status ===
          'COMPLETED',
      ).length;

    const failedTransactions =
      allTransactions.filter(
        (transaction) =>
          transaction.status ===
          'FAILED',
      ).length;

    const pendingTransactions =
      allTransactions.filter(
        (transaction) =>
          transaction.status ===
            'PENDING' ||
          transaction.status ===
            'PROCESSING',
      ).length;

    const reversedTransactions =
      allTransactions.filter(
        (transaction) =>
          transaction.status ===
          'REVERSED',
      ).length;

    const totalDepositAmount =
      deposits
        .filter(
          (deposit) =>
            deposit.status ===
            'COMPLETED',
        )
        .reduce(
          (sum, deposit) =>
            sum +
            Number(
              deposit.amount,
            ),
          0,
        );

    const totalWithdrawalAmount =
      withdrawals
        .filter(
          (withdrawal) =>
            withdrawal.status ===
            'COMPLETED',
        )
        .reduce(
          (
            sum,
            withdrawal,
          ) =>
            sum +
            Number(
              withdrawal.amount,
            ),
          0,
        );

    const totalTransferAmount =
      transfers
        .filter(
          (transfer) =>
            transfer.status ===
            'COMPLETED',
        )
        .reduce(
          (sum, transfer) =>
            sum +
            Number(
              transfer.amount,
            ),
          0,
        );

    const totalVolume =
      totalDepositAmount +
      totalWithdrawalAmount +
      totalTransferAmount;

    const successRate =
      allTransactions.length === 0
        ? 0
        : Number(
            (
              completedTransactions /
              allTransactions.length *
              100
            ).toFixed(2),
          );

    return {
      period: {
        days,
        startDate:
          startDate.toISOString(),
        endDate:
          new Date().toISOString(),
      },

      summary: {
        totalTransactions:
          allTransactions.length,

        completedTransactions,
        failedTransactions,
        pendingTransactions,
        reversedTransactions,

        totalDeposits:
          deposits.length,

        totalWithdrawals:
          withdrawals.length,

        totalTransfers:
          transfers.length,

        totalDepositAmount:
          totalDepositAmount.toFixed(
            2,
          ),

        totalWithdrawalAmount:
          totalWithdrawalAmount.toFixed(
            2,
          ),

        totalTransferAmount:
          totalTransferAmount.toFixed(
            2,
          ),

        totalVolume:
          totalVolume.toFixed(2),

        successRate,

        newUsers:
          newUsers.length,

        newWallets:
          newWallets.length,
      },

      transactionTypes: [
        {
          type: 'DEPOSIT',
          count: deposits.length,
          amount:
            totalDepositAmount.toFixed(
              2,
            ),
        },
        {
          type: 'WITHDRAWAL',
          count:
            withdrawals.length,
          amount:
            totalWithdrawalAmount.toFixed(
              2,
            ),
        },
        {
          type: 'TRANSFER',
          count: transfers.length,
          amount:
            totalTransferAmount.toFixed(
              2,
            ),
        },
      ],

      transactionStatuses: [
        {
          status: 'COMPLETED',
          count:
            completedTransactions,
        },
        {
          status: 'FAILED',
          count:
            failedTransactions,
        },
        {
          status: 'PENDING',
          count:
            pendingTransactions,
        },
        {
          status: 'REVERSED',
          count:
            reversedTransactions,
        },
      ],

      dailyActivity:
        Array.from(
          dailyMap.values(),
        ).map((daily) => ({
          ...daily,

          depositAmount:
            daily.depositAmount.toFixed(
              2,
            ),

          withdrawalAmount:
            daily.withdrawalAmount.toFixed(
              2,
            ),

          transferAmount:
            daily.transferAmount.toFixed(
              2,
            ),

          transactionVolume:
            daily.transactionVolume.toFixed(
              2,
            ),
        })),
    };
  }
}