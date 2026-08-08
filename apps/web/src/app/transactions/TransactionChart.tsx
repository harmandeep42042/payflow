'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type WalletTransaction = {
  id: string;
  type:
    | 'DEPOSIT'
    | 'WITHDRAWAL'
    | 'TRANSFER';
  direction:
    | 'CREDIT'
    | 'DEBIT';
  amount: string;
  currency: string;
  createdAt: string;
};

type Props = {
  transactions: WalletTransaction[];
};

type ChartRow = {
  label: string;
  moneyIn: number;
  moneyOut: number;
};

export default function TransactionChart({
  transactions,
}: Props) {
  const grouped =
    new Map<
      string,
      ChartRow
    >();

  for (
    const transaction
    of transactions
  ) {
    const date =
      new Date(
        transaction.createdAt,
      );

    const key =
      date.toISOString()
        .slice(
          0,
          10,
        );

    const label =
      date.toLocaleDateString(
        'en-IN',
        {
          day: '2-digit',
          month: 'short',
        },
      );

    if (
      !grouped.has(
        key,
      )
    ) {
      grouped.set(
        key,
        {
          label,
          moneyIn: 0,
          moneyOut: 0,
        },
      );
    }

    const row =
      grouped.get(
        key,
      );

    if (!row) {
      continue;
    }

    const amount =
      Number(
        transaction.amount,
      ) || 0;

    if (
      transaction.direction ===
      'CREDIT'
    ) {
      row.moneyIn +=
        amount;
    }
    else {
      row.moneyOut +=
        amount;
    }
  }

  const data =
    Array.from(
      grouped.entries(),
    )
      .sort(
        (
          [firstDate],
          [secondDate],
        ) =>
          firstDate.localeCompare(
            secondDate,
          ),
      )
      .slice(-10)
      .map(
        ([
          ,
          row,
        ]) => row,
      );

  if (
    data.length === 0
  ) {
    return (
      <div className="flex h-72 items-center justify-center text-slate-500">
        No transaction data available.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <BarChart
          data={data}
          margin={{
            top: 10,
            right: 20,
            left: 10,
            bottom: 5,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
          />

          <XAxis
            dataKey="label"
          />

          <YAxis />

          <Tooltip
            formatter={(
              value,
            ) => [
              `₹${Number(
                value,
              ).toLocaleString(
                'en-IN',
                {
                  maximumFractionDigits:
                    2,
                },
              )}`,
              '',
            ]}
          />

          <Legend />

          <Bar
            dataKey="moneyIn"
            name="Money In"
            fill="#10b981"
          />

          <Bar
            dataKey="moneyOut"
            name="Money Out"
            fill="#ef4444"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
