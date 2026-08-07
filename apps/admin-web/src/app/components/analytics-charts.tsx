'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type DailyActivityItem = {
  date: string;
  deposits: number;
  withdrawals: number;
  transfers: number;
  depositAmount: string;
  withdrawalAmount: string;
  transferAmount: string;
  transactionVolume: string;
  newUsers?: number;
  newWallets?: number;
};

export type TransactionTypeItem = {
  type:
    | 'DEPOSIT'
    | 'WITHDRAWAL'
    | 'TRANSFER';
  count: number;
  amount: string;
};

export type TransactionStatusItem = {
  status: string;
  count: number;
};

type AnalyticsChartsProps = {
  dailyActivity: DailyActivityItem[];
  transactionTypes: TransactionTypeItem[];
  transactionStatuses: TransactionStatusItem[];
};

function formatChartDate(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
    },
  );
}

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    'en-IN',
    {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export function AnalyticsCharts({
  dailyActivity,
  transactionTypes,
  transactionStatuses,
}: AnalyticsChartsProps) {
  const dailyChartData =
    dailyActivity.map(
      (item) => ({
        ...item,

        label:
          formatChartDate(
            item.date,
          ),

        transactionVolume:
          Number(
            item.transactionVolume,
          ),

        depositAmount:
          Number(
            item.depositAmount,
          ),

        withdrawalAmount:
          Number(
            item.withdrawalAmount,
          ),

        transferAmount:
          Number(
            item.transferAmount,
          ),

        newUsers:
          Number(
            item.newUsers ?? 0,
          ),

        newWallets:
          Number(
            item.newWallets ?? 0,
          ),
      }),
    );

  const typeChartData =
    transactionTypes.map(
      (item) => ({
        ...item,

        amount:
          Number(item.amount),
      }),
    );

  const statusChartData =
    transactionStatuses.filter(
      (item) =>
        item.count > 0,
    );

  return (
    <section className="mt-8 grid gap-6 xl:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            Daily transaction volume
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Total payment activity during the selected period.
          </p>
        </div>

        <div className="mt-6 h-80">
          {dailyChartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              No daily activity available.
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart
                data={dailyChartData}
                margin={{
                  top: 10,
                  right: 20,
                  left: 15,
                  bottom: 5,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="label"
                />

                <YAxis
                  tickFormatter={
                    formatCurrency
                  }
                />

                <Tooltip
                  formatter={(
                    value,
                  ) =>
                    formatCurrency(
                      Number(value),
                    )
                  }
                />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="transactionVolume"
                  name="Transaction Volume"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  activeDot={{
                    r: 6,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>


      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            User and wallet growth
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            New users and wallets created during the selected period.
          </p>
        </div>

        <div className="mt-6 h-80">
          {dailyChartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              No growth activity available.
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart
                data={dailyChartData}
                margin={{
                  top: 10,
                  right: 20,
                  left: 5,
                  bottom: 5,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="label"
                />

                <YAxis
                  allowDecimals={false}
                />

                <Tooltip />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="newUsers"
                  name="New Users"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  activeDot={{
                    r: 6,
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="newWallets"
                  name="New Wallets"
                  stroke="#10b981"
                  strokeWidth={3}
                  activeDot={{
                    r: 6,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            Transaction type amounts
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Deposit, withdrawal and transfer comparison.
          </p>
        </div>

        <div className="mt-6 h-80">
          {typeChartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              No transaction data available.
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={typeChartData}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="type"
                />

                <YAxis
                  tickFormatter={
                    formatCurrency
                  }
                />

                <Tooltip
                  formatter={(
                    value,
                  ) =>
                    formatCurrency(
                      Number(value),
                    )
                  }
                />

                <Bar
                  dataKey="amount"
                  name="Amount"
                  radius={[
                    8,
                    8,
                    0,
                    0,
                  ]}
                >
                  {typeChartData.map(
                    (entry) => (
                      <Cell
                        key={entry.type}
                        fill={
                          entry.type ===
                          'DEPOSIT'
                            ? '#10b981'
                            : entry.type ===
                                'WITHDRAWAL'
                              ? '#f59e0b'
                              : '#8b5cf6'
                        }
                      />
                    ),
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            Transaction statuses
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Completed, failed, pending and reversed activity.
          </p>
        </div>

        <div className="mt-6 h-80">
          {statusChartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              No transaction statuses available.
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={4}
                  label
                >
                  {statusChartData.map(
                    (entry) => {
                      const fill =
                        entry.status ===
                        'COMPLETED'
                          ? '#10b981'
                          : entry.status ===
                              'FAILED'
                            ? '#ef4444'
                            : entry.status ===
                                'PENDING'
                              ? '#f59e0b'
                              : '#64748b';

                      return (
                        <Cell
                          key={
                            entry.status
                          }
                          fill={fill}
                        />
                      );
                    },
                  )}
                </Pie>

                <Tooltip />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>
    </section>
  );
}