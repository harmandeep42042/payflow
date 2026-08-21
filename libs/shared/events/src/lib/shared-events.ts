export const WalletEventPattern = {
  DepositCompleted:
    'wallet.deposit.completed',

  WithdrawalCompleted:
    'wallet.withdrawal.completed',

  TransferCompleted:
    'wallet.transfer.completed',

  TransactionFailed:
    'wallet.transaction.failed',
} as const;

export const PaymentEventPattern = {
  Completed: 'PAYMENT_COMPLETED',
} as const;

export const OutboxEventProducer = {
  Wallet: 'WALLET',
  Payment: 'PAYMENT',
} as const;

export const PaymentEventVersion = {
  Completed: 1,
} as const;

export type PaymentEventPatternValue =
  (typeof PaymentEventPattern)[keyof typeof PaymentEventPattern];

export type PaymentCompletedEventPayload = {
  version: typeof PaymentEventVersion.Completed;
  paymentId: string;
  userId: string;
  walletId: string;
  amount: string;
  currency: string;
};

export type PaymentCompletedEvent =
  PaymentCompletedEventPayload & {
    type: typeof PaymentEventPattern.Completed;
  };

export type WalletEventPatternValue =
  (typeof WalletEventPattern)[keyof typeof WalletEventPattern];

export type WalletEventUser = {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName?: string | null;
};

export type WalletEventBase = {
  eventId: string;
  occurredAt: string;
  currency: string;
  amount: string;
};

export type WalletDepositCompletedEvent =
  WalletEventBase & {
    type:
      typeof WalletEventPattern.DepositCompleted;

    depositId: string;
    walletId: string;
    reference: string;
    user: WalletEventUser;
  };

export type WalletWithdrawalCompletedEvent =
  WalletEventBase & {
    type:
      typeof WalletEventPattern.WithdrawalCompleted;

    withdrawalId: string;
    walletId: string;
    reference: string;
    user: WalletEventUser;
  };

export type WalletTransferCompletedEvent =
  WalletEventBase & {
    type:
      typeof WalletEventPattern.TransferCompleted;

    transferId: string;
    sourceWalletId: string;
    destinationWalletId: string;
    description?: string | null;

    sender: WalletEventUser;
    receiver: WalletEventUser;
  };

export type WalletTransactionFailedEvent =
  WalletEventBase & {
    type:
      typeof WalletEventPattern.TransactionFailed;

    transactionId: string;
    transactionType:
      | 'DEPOSIT'
      | 'WITHDRAWAL'
      | 'TRANSFER';

    failureReason: string;
    user?: WalletEventUser;
  };

export type WalletEvent =
  | WalletDepositCompletedEvent
  | WalletWithdrawalCompletedEvent
  | WalletTransferCompletedEvent
  | WalletTransactionFailedEvent;
