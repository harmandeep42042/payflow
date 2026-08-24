export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
export type TransactionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export type TransactionUser = {
  id: string; email: string; phone: string | null; firstName: string;
  lastName: string | null; role: string; status: string;
};
export type TransactionWallet = {
  id: string; userId: string; currency: string; balance: string; status: string;
  user: TransactionUser;
  ledgerAccount: { id: string; code: string; name: string; type: string; currency: string; status: string } | null;
};
export type LedgerEntry = {
  id: string; ledgerAccountId: string; entryType: 'DEBIT' | 'CREDIT';
  amount: string; currency: string; createdAt: string;
  ledgerAccount: { id: string; code: string; name: string; type: string; status: string };
};
type BaseListTransaction = {
  id: string; amount: string; currency: string; status: string;
  failureReason: string | null; createdAt: string; completedAt: string | null;
  user: TransactionUser; destinationUser: TransactionUser | null;
};
export type DepositListTransaction = BaseListTransaction & {
  type: 'DEPOSIT'; walletId: string; reference: string | null;
  description: null; sourceWalletId: null; destinationWalletId: null;
};
export type WithdrawalListTransaction = BaseListTransaction & {
  type: 'WITHDRAWAL'; walletId: string; reference: string | null;
  description: null; sourceWalletId: null; destinationWalletId: null;
};
export type TransferListTransaction = BaseListTransaction & {
  type: 'TRANSFER'; walletId: null; reference: null; description: string | null;
  sourceWalletId: string; destinationWalletId: string;
};
export type AdminTransaction = DepositListTransaction | WithdrawalListTransaction | TransferListTransaction;
export type TransactionsResponse = { transactions?: unknown; pagination?: Record<string, unknown> };
export type TransactionFilters = { search: string; type: string; status: string; page: number; limit: number };

export type TransactionDetail = {
  type: TransactionType;
  transaction: {
    id: string; amount: string; currency: string; status: string;
    reference: string | null; description: string | null; failureReason: string | null;
    createdAt: string; updatedAt: string; completedAt: string | null;
    wallet: TransactionWallet | null; sourceWallet: TransactionWallet | null;
    destinationWallet: TransactionWallet | null; ledgerEntries: LedgerEntry[];
  };
};
