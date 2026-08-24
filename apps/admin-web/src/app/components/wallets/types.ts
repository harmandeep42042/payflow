export type WalletStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export type WalletOwner = {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string | null;
  role: string;
  status: string;
};

export type LedgerAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
};

export type WalletCounts = {
  deposits: number;
  withdrawals: number;
  outgoingTransfers: number;
  incomingTransfers: number;
};

export type AdminWallet = {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  version: number | null;
  status: WalletStatus;
  createdAt: string;
  updatedAt: string;
  user: WalletOwner;
  ledgerAccount: LedgerAccount | null;
  counts: WalletCounts;
  transactionCount: number;
};

export type WalletsResponse = {
  wallets?: unknown;
  pagination?: {
    total?: unknown;
    page?: unknown;
    limit?: unknown;
    totalPages?: unknown;
    hasNextPage?: unknown;
    hasPreviousPage?: unknown;
  };
};

export type WalletFilters = {
  search: string;
  status: string;
  currency: string;
  page: number;
  limit: number;
};
