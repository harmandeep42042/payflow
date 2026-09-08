export type SplitCreationType =
  | 'EQUAL'
  | 'EXACT';

function moneyToCents(
  input: string,
): bigint | null {
  const value = input.trim();

  if (
    !/^\d+(?:\.\d{1,2})?$/.test(
      value,
    )
  ) {
    return null;
  }

  const [
    wholeRaw,
    fractionRaw = '',
  ] = value.split('.');

  const whole =
    wholeRaw.replace(
      /^0+(?=\d)/,
      '',
    ) || '0';

  const fraction =
    fractionRaw.padEnd(2, '0');

  const cents =
    BigInt(whole) * BigInt(100) +
    BigInt(fraction);

  return cents > BigInt(0)
    ? cents
    : null;
}

function centsToMoney(
  cents: bigint,
): string {
  return (
    `${cents / BigInt(100)}.` +
    String(
      cents % BigInt(100),
    ).padStart(2, '0')
  );
}

export function normalizeSplitAmount(
  input: string,
): string | null {
  const cents =
    moneyToCents(input);

  return cents === null
    ? null
    : centsToMoney(cents);
}

export function isSupportedSplitType(
  value: string,
): value is SplitCreationType {
  return (
    value === 'EQUAL' ||
    value === 'EXACT'
  );
}

export function calculateEqualSplitAmount(
  total: string,
  participantCount: number,
): string | null {
  if (
    !Number.isInteger(
      participantCount,
    ) ||
    participantCount < 1
  ) {
    return null;
  }

  const cents =
    moneyToCents(total);

  if (cents === null) {
    return null;
  }

  const count =
    BigInt(participantCount);

  if (
    cents % count !== BigInt(0)
  ) {
    return null;
  }

  return centsToMoney(
    cents / count,
  );
}

export function exactSplitAmountsMatch(
  total: string,
  amounts: string[],
): boolean {
  const totalCents =
    moneyToCents(total);

  if (
    totalCents === null ||
    amounts.length === 0
  ) {
    return false;
  }

  let sum = BigInt(0);

  for (
    const amount of amounts
  ) {
    const cents =
      moneyToCents(amount);

    if (cents === null) {
      return false;
    }

    sum += cents;
  }

  return sum === totalCents;
}

export function isSelectableSplitParticipant(
  participantUserId: string,
  creatorUserId?: string | null,
): boolean {
  const participant =
    participantUserId.trim();

  if (!participant) {
    return false;
  }

  return (
    !creatorUserId ||
    participant !==
      creatorUserId
  );
}

export function toLocalDateTimeInput(
  value: Date,
): string {
  const pad = (
    number: number,
  ) =>
    String(number).padStart(
      2,
      '0',
    );

  return [
    value.getFullYear(),
    '-',
    pad(
      value.getMonth() + 1,
    ),
    '-',
    pad(value.getDate()),
    'T',
    pad(value.getHours()),
    ':',
    pad(value.getMinutes()),
  ].join('');
}

export function defaultSplitDueAt(
  now = new Date(),
): string {
  const due =
    new Date(
      now.getTime(),
    );

  due.setHours(
    due.getHours() + 24,
  );

  return toLocalDateTimeInput(
    due,
  );
}

export function minimumSplitDueAt(
  now = new Date(),
): string {
  return toLocalDateTimeInput(
    new Date(
      now.getTime() +
        5 * 60 * 1000,
    ),
  );
}

export function isFutureSplitDueAt(
  input: string,
  now = new Date(),
): boolean {
  if (!input.trim()) {
    return false;
  }

  const due =
    new Date(input);

  return (
    !Number.isNaN(
      due.getTime(),
    ) &&
    due.getTime() >
      now.getTime()
  );
}
export function isSplitAllocationPayable(
  splitStatus: string,
  allocationStatus: string,
  dueAt: string,
  now = new Date(),
): boolean {
  if (
    allocationStatus !== 'PENDING'
  ) {
    return false;
  }

  if (
    splitStatus !== 'OPEN' &&
    splitStatus !==
      'PARTIALLY_PAID'
  ) {
    return false;
  }

  const due =
    new Date(dueAt);

  if (
    Number.isNaN(
      due.getTime(),
    )
  ) {
    return false;
  }

  return (
    due.getTime() >
    now.getTime()
  );
}
export type SplitHistoryView =
  | 'ALL'
  | 'CREATED'
  | 'INCOMING';

export type SplitHistoryStatusFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'PAID'
  | 'CANCELLED'
  | 'EXPIRED';

export function getEffectiveSplitStatus(
  status: string,
  dueAt: string,
  now = new Date(),
): string {
  if (
    status !== 'OPEN' &&
    status !== 'PARTIALLY_PAID'
  ) {
    return status;
  }

  const due =
    new Date(dueAt);

  if (
    !Number.isNaN(
      due.getTime(),
    ) &&
    due.getTime() <=
      now.getTime()
  ) {
    return 'EXPIRED';
  }

  return status;
}

export function matchesSplitHistoryView(
  view: SplitHistoryView,
  creatorUserId: string,
  participantUserIds: string[],
  userId?: string | null,
): boolean {
  if (!userId) {
    return false;
  }

  if (view === 'ALL') {
    return (
      creatorUserId === userId ||
      participantUserIds.includes(
        userId,
      )
    );
  }

  if (view === 'CREATED') {
    return (
      creatorUserId === userId
    );
  }

  return (
    creatorUserId !== userId &&
    participantUserIds.includes(
      userId,
    )
  );
}

export function matchesSplitHistoryStatus(
  filter: SplitHistoryStatusFilter,
  status: string,
): boolean {
  if (filter === 'ALL') {
    return true;
  }

  if (filter === 'ACTIVE') {
    return (
      status === 'OPEN' ||
      status ===
        'PARTIALLY_PAID'
    );
  }

  return status === filter;
}

export type SplitProgress = {
  total: number;
  paid: number;
  pending: number;
  cancelled: number;
  percent: number;
};

export function getSplitProgress(
  allocationStatuses: string[],
): SplitProgress {
  const total =
    allocationStatuses.length;

  const paid =
    allocationStatuses.filter(
      (status) =>
        status === 'PAID',
    ).length;

  const pending =
    allocationStatuses.filter(
      (status) =>
        status === 'PENDING',
    ).length;

  const cancelled =
    allocationStatuses.filter(
      (status) =>
        status === 'CANCELLED',
    ).length;

  const percent =
    total === 0
      ? 0
      : Math.round(
          (paid / total) * 100,
        );

  return {
    total,
    paid,
    pending,
    cancelled,
    percent,
  };
}
