export type CurrencyTrendPoint = {
  date: string;
  incoming: string;
  outgoing: string;
};

export type CategoryTotal = {
  category: string;
  currencies: Array<{
    currency: string;
    amount: string;
  }>;
};

export type CategoryBreakdownRow = {
  category: string;
  amount: string;
  percentage: number;
};

export type SpendingTrendRow = {
  date: string;
  amount: string;
  percentage: number;
};

export type PeriodComparison = {
  direction: 'UP' | 'DOWN' | 'FLAT' | 'NEW';
  label: string;
};

const MONEY_PATTERN = /^-?\d+(?:\.\d{1,2})?$/;

export function moneyToMinorUnits(
  input: string,
): bigint | null {
  const value = input.trim();

  if (!MONEY_PATTERN.test(value)) {
    return null;
  }

  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;

  const [wholeRaw, fractionRaw = ''] =
    unsigned.split('.');

  const whole =
    wholeRaw.replace(/^0+(?=\d)/, '') || '0';

  const fraction =
    fractionRaw.padEnd(2, '0');

  const units =
    BigInt(whole) * BigInt(100) +
    BigInt(fraction);

  return negative ? -units : units;
}

export function minorUnitsToMoney(
  units: bigint,
): string {
  const negative = units < BigInt(0);
  const absolute = negative ? -units : units;

  const whole =
    absolute / BigInt(100);

  const fraction =
    absolute % BigInt(100);

  return `${negative ? '-' : ''}${whole}.${String(
    fraction,
  ).padStart(2, '0')}`;
}

function groupIndianDigits(
  value: string,
): string {
  if (value.length <= 3) {
    return value;
  }

  const lastThree =
    value.slice(-3);

  let remaining =
    value.slice(0, -3);

  const groups: string[] = [];

  while (remaining.length > 2) {
    groups.unshift(
      remaining.slice(-2),
    );

    remaining =
      remaining.slice(0, -2);
  }

  if (remaining) {
    groups.unshift(remaining);
  }

  return `${groups.join(',')},${lastThree}`;
}

export function formatMoneyString(
  input: string,
  currency: string,
): string {
  const units =
    moneyToMinorUnits(input);

  if (units === null) {
    return `${currency.toUpperCase()} ${input}`;
  }

  const normalized =
    minorUnitsToMoney(units);

  const negative =
    normalized.startsWith('-');

  const unsigned =
    negative
      ? normalized.slice(1)
      : normalized;

  const [whole, fraction = '00'] =
    unsigned.split('.');

  const symbolByCurrency: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };

  const code =
    currency.toUpperCase();

  const prefix =
    symbolByCurrency[code] ??
    `${code} `;

  return `${negative ? '-' : ''}${prefix}${groupIndianDigits(
    whole,
  )}.${fraction.padEnd(2, '0')}`;
}

export function humanizeCategory(
  value: string,
): string {
  const text =
    value
      .toLowerCase()
      .replace(/_/g, ' ');

  return text.replace(
    /\b\w/g,
    (letter) => letter.toUpperCase(),
  );
}

export function buildCategoryBreakdown(
  totals: CategoryTotal[],
  currency: string,
): CategoryBreakdownRow[] {
  const values = totals
    .map((item) => {
      const entry =
        item.currencies.find(
          (candidate) =>
            candidate.currency === currency,
        );

      const units =
        moneyToMinorUnits(
          entry?.amount ?? '0',
        ) ?? BigInt(0);

      return {
        category: item.category,
        amount:
          entry?.amount ?? '0',
        units,
      };
    })
    .filter(
      (item) =>
        item.units > BigInt(0),
    )
    .sort((first, second) => {
      if (first.units === second.units) {
        return first.category.localeCompare(
          second.category,
        );
      }

      return first.units > second.units
        ? -1
        : 1;
    });

  const total =
    values.reduce(
      (sum, item) => sum + item.units,
      BigInt(0),
    );

  return values.map((item) => {
    const basisPoints =
      total > BigInt(0)
        ? (item.units * BigInt(10000)) /
          total
        : BigInt(0);

    return {
      category: item.category,
      amount: item.amount,
      percentage:
        Number(basisPoints) / 100,
    };
  });
}

export function buildSpendingTrend(
  points: CurrencyTrendPoint[],
  limit = 14,
): SpendingTrendRow[] {
  const selected =
    points.slice(
      Math.max(
        0,
        points.length - limit,
      ),
    );

  const parsed =
    selected.map((point) => ({
      date: point.date,
      amount: point.outgoing,
      units:
        moneyToMinorUnits(
          point.outgoing,
        ) ?? BigInt(0),
    }));

  const maximum =
    parsed.reduce(
      (max, item) =>
        item.units > max
          ? item.units
          : max,
      BigInt(0),
    );

  return parsed.map((item) => ({
    date: item.date,
    amount: item.amount,
    percentage:
      maximum > BigInt(0)
        ? Number(
            (item.units *
              BigInt(100)) /
              maximum,
          )
        : 0,
  }));
}

export function comparePeriods(
  currentValue: string,
  previousValue: string,
): PeriodComparison {
  const current =
    moneyToMinorUnits(
      currentValue,
    ) ?? BigInt(0);

  const previous =
    moneyToMinorUnits(
      previousValue,
    ) ?? BigInt(0);

  if (
    previous === BigInt(0) &&
    current === BigInt(0)
  ) {
    return {
      direction: 'FLAT',
      label: '0.00%',
    };
  }

  if (
    previous === BigInt(0)
  ) {
    return {
      direction: 'NEW',
      label: 'New activity',
    };
  }

  const difference =
    current - previous;

  if (difference === BigInt(0)) {
    return {
      direction: 'FLAT',
      label: '0.00%',
    };
  }

  const absolute =
    difference < BigInt(0)
      ? -difference
      : difference;

  const basisPoints =
    (absolute * BigInt(10000)) /
    previous;

  const whole =
    basisPoints / BigInt(100);

  const fraction =
    basisPoints % BigInt(100);

  const sign =
    difference > BigInt(0)
      ? '+'
      : '-';

  return {
    direction:
      difference > BigInt(0)
        ? 'UP'
        : 'DOWN',
    label: `${sign}${whole}.${String(
      fraction,
    ).padStart(2, '0')}%`,
  };
}