export type UserRole =
  | 'USER'
  | 'ADMIN';

export type UserStatus =
  | 'ACTIVE'
  | 'BLOCKED'
  | 'SUSPENDED';

export type WalletStatus =
  | 'ACTIVE'
  | 'FROZEN'
  | 'CLOSED';

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER';

export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REVERSED';

export type LedgerEntryType =
  | 'DEBIT'
  | 'CREDIT';

export type CurrencyCode =
  | 'INR'
  | 'USD'
  | 'EUR'
  | string;

export type PayflowUser = {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName?: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type PayflowWallet = {
  id: string;
  userId: string;
  currency: CurrencyCode;
  balance: string;
  version: number;
  status: WalletStatus;
  createdAt: string;
  updatedAt: string;
};

export type PayflowTransaction = {
  id: string;
  type: TransactionType;
  amount: string;
  currency: CurrencyCode;
  status: TransactionStatus;
  reference?: string | null;
  description?: string | null;
  failureReason?: string | null;
  walletId?: string | null;
  sourceWalletId?: string | null;
  destinationWalletId?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: Pagination;
};

export type ApiErrorResponse = {
  success?: false;
  statusCode?: number;
  message: string | string[];
  error?: string;
  timestamp?: string;
  path?: string;
};

export type ApiSuccessResponse<T> = {
  success?: true;
  data: T;
  message?: string;
};

export type ApiResponse<T> =
  | T
  | ApiSuccessResponse<T>;

export type AdminLoginResponse = {
  message?: string;
  tokenType?: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn?: string;
  refreshTokenExpiresIn?: string;
  user: PayflowUser;
};