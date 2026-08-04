'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Transaction = {
  direction: 'CREDIT' | 'DEBIT';
  amount: string;
  createdAt: string;
};

type TransactionChartProps = {
  transactions: Transaction[];
};

type DailyTransactionData = {
  date: string;
  credits: number;
  debits: number;
};

export default function TransactionChart({
  transactions,
}: TransactionChartProps) {
  const dailyData = transactions.reduce<
    Record<string, DailyTransactionData>
  >((result, transaction) => {
    const date = new Date(
      transaction.createdAt,
    ).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });

    if (!result[date]) {
      result[date] = {
        date,
        credits: 0,
        debits: 0,
      };
    }

    const amount = Number(transaction.amount);

    if (transaction.direction === 'CREDIT') {
      result[date].credits += amount;
    } else {
      result[date].debits += amount;
    }

    return result;
  }, {});

  const chartData = Object.values(
    dailyData,
  ).slice(-7);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-xl font-bold text-slate-900">
          Transaction overview
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Credits and debits from recent activity.
        </p>
      </div>

      {chartData.length === 0 ? (
        <div className="mt-8 flex h-80 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
          No transaction data available.
        </div>
      ) : (
        <div className="mt-8 h-80 w-full">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
              />

              <Tooltip
                formatter={(value) => {
                  const amount =
                    typeof value === 'number' ||
                    typeof value === 'string'
                      ? Number(value)
                      : 0;

                  return `INR ${amount.toLocaleString(
                    'en-IN',
                  )}`;
                }}
              />

              <Bar
                dataKey="credits"
                name="Credits"
                fill="#10b981"
                radius={[8, 8, 0, 0]}
              />

              <Bar
                dataKey="debits"
                name="Debits"
                fill="#f43f5e"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}