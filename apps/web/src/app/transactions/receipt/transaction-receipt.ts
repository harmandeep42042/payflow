const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReceiptCounterparty = {
  walletId?: string;
  userId?: string;
  firstName?: string;
  lastName?: string | null;
  email?: string;
  vpa?: string;
};

export type ReceiptTransaction = {
  id: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  createdAt: string;
  description?: string | null;
  sourceWalletId?: string | null;
  destinationWalletId?: string | null;
  counterparty?: ReceiptCounterparty;
};

type ReceiptHistoryEnvelope = {
  transactions?: unknown;
  items?: unknown;
  data?: unknown;
};

function recordValue(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<
    string,
    unknown
  >;
}

function optionalString(
  value: unknown,
): string | undefined {
  return typeof value === 'string' &&
    value.trim()
    ? value
    : undefined;
}

function optionalNullableString(
  value: unknown,
): string | null | undefined {
  if (value === null) {
    return null;
  }

  return optionalString(value);
}

function normalizeCounterparty(
  value: unknown,
): ReceiptCounterparty | undefined {
  const record =
    recordValue(value);

  if (!record) {
    return undefined;
  }

  const counterparty = {
    walletId:
      optionalString(
        record.walletId,
      ),

    userId:
      optionalString(
        record.userId,
      ),

    firstName:
      optionalString(
        record.firstName,
      ),

    lastName:
      optionalNullableString(
        record.lastName,
      ),

    email:
      optionalString(
        record.email,
      ),

    vpa:
      optionalString(
        record.vpa,
      ),
  };

  if (
    !counterparty.walletId &&
    !counterparty.userId &&
    !counterparty.firstName &&
    !counterparty.lastName &&
    !counterparty.email &&
    !counterparty.vpa
  ) {
    return undefined;
  }

  return counterparty;
}

export function normalizeReceiptTransaction(
  value: unknown,
): ReceiptTransaction | null {
  const record =
    recordValue(value);

  if (!record) {
    return null;
  }

  const id =
    optionalString(record.id);

  const type =
    optionalString(record.type);

  const status =
    optionalString(record.status);

  const amount =
    optionalString(record.amount);

  const currency =
    optionalString(record.currency);

  const createdAt =
    optionalString(
      record.createdAt,
    );

  if (
    !id ||
    !type ||
    !status ||
    !amount ||
    !currency ||
    !createdAt
  ) {
    return null;
  }

  return {
    id,
    type,
    status,
    amount,
    currency,
    createdAt,

    description:
      optionalNullableString(
        record.description,
      ),

    sourceWalletId:
      optionalNullableString(
        record.sourceWalletId,
      ),

    destinationWalletId:
      optionalNullableString(
        record.destinationWalletId,
      ),

    counterparty:
      normalizeCounterparty(
        record.counterparty,
      ),
  };
}

export function normalizeReceiptHistory(
  value: unknown,
): ReceiptTransaction[] {
  let source: unknown = value;

  if (!Array.isArray(source)) {
    const envelope =
      recordValue(value) as
        ReceiptHistoryEnvelope | null;

    source =
      envelope?.transactions ??
      envelope?.items ??
      envelope?.data ??
      [];
  }

  if (!Array.isArray(source)) {
    return [];
  }

  return source.flatMap(
    (item) => {
      const transaction =
        normalizeReceiptTransaction(
          item,
        );

      return transaction
        ? [transaction]
        : [];
    },
  );
}

export function getReceiptTransactionId(
  params: URLSearchParams,
): string | null {
  const value =
    params
      .get('transactionId')
      ?.trim();

  if (
    !value ||
    !UUID.test(value)
  ) {
    return null;
  }

  return value;
}

export function findReceiptTransaction(
  transactions: ReceiptTransaction[],
  transactionId: string,
): ReceiptTransaction | null {
  return (
    transactions.find(
      (transaction) =>
        transaction.id ===
        transactionId,
    ) ?? null
  );
}

export function getReceiptDirection(
  transaction: ReceiptTransaction,
  walletIds: string[],
): string {
  if (
    transaction.type ===
    'DEPOSIT'
  ) {
    return 'Money added';
  }

  if (
    transaction.type ===
    'WITHDRAWAL'
  ) {
    return 'Money withdrawn';
  }

  const sourceOwned =
    Boolean(
      transaction.sourceWalletId &&
        walletIds.includes(
          transaction.sourceWalletId,
        ),
    );

  const destinationOwned =
    Boolean(
      transaction.destinationWalletId &&
        walletIds.includes(
          transaction.destinationWalletId,
        ),
    );

  if (
    sourceOwned &&
    destinationOwned
  ) {
    return 'Between your wallets';
  }

  if (sourceOwned) {
    return 'Sent';
  }

  if (destinationOwned) {
    return 'Received';
  }

  return 'Wallet activity';
}

export function getReceiptCounterpartyLabel(
  counterparty:
    | ReceiptCounterparty
    | undefined,
): string | null {
  if (!counterparty) {
    return null;
  }

  const name = [
    counterparty.firstName,
    counterparty.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    name ||
    counterparty.email ||
    null
  );
}
export function buildReceiptShareText(
  transaction: ReceiptTransaction,
): string {
  const lines = [
    'Payflow transaction receipt',
    `Amount: ${transaction.currency} ${transaction.amount}`,
    `Status: ${transaction.status}`,
    `Transaction ID: ${transaction.id}`,
    `Date: ${transaction.createdAt}`,
  ];

  if (transaction.description) {
    lines.push(
      `Description: ${transaction.description}`,
    );
  }

  return lines.join('\n');
}

export function buildRepeatPaymentHref(
  counterparty:
    | ReceiptCounterparty
    | undefined,
): string | null {
  const vpa =
    counterparty?.vpa?.trim();

  if (
    !vpa ||
    !/^[^\s@]+@[^\s@]+$/.test(vpa)
  ) {
    return null;
  }

  return (
    '/send-money?vpa=' +
    encodeURIComponent(vpa)
  );
}
