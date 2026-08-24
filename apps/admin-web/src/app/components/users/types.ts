export type UserStatus = 'ACTIVE' | 'BLOCKED' | 'SUSPENDED';
export type UserRole = 'USER' | 'ADMIN';

export type UserWallet = {
  id: string;
  currency: string;
  balance: string;
  status: string;
  version?: number;
  createdAt: string;
  updatedAt?: string;
  ledgerAccount?: {
    id: string;
    code: string;
    name: string;
    type: string;
    currency: string;
    status: string;
  } | null;
  transactionCounts?: {
    deposits: number;
    withdrawals: number;
    outgoingTransfers: number;
    incomingTransfers: number;
    total: number;
  };
};

export type AdminUserItem = {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName?: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  wallets: UserWallet[];
  walletCount: number;
  totalWalletBalance: string;
};

export type AdminUserDetails = AdminUserItem;

export type UsersResponse = {
  users: AdminUserItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filters: { search: string; status: string; role: string };
};

export type UsersFilters = {
  search: string;
  status: string;
  role: string;
  page: number;
  limit: number;
};
