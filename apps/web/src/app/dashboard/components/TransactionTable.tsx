'use client';

export type WalletTransaction = {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  direction: 'CREDIT' | 'DEBIT';
  walletId: string;
  counterpartyWalletId?: string | null;
  amount: string;
  currency: string;
  status: string;
  reference?: string | null;
  description?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

type TransactionTableProps = {
  transactions: WalletTransaction[];
  filter: string;
  isLoading: boolean;
  onFilterChange: (value: string) => void;
};

export default function TransactionTable({
  transactions,
  filter,
  isLoading,
  onFilterChange,
}: TransactionTableProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            Transaction history
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Latest activity for the selected wallet.
          </p>
        </div>

        <select
          value={filter}
          onChange={(event) =>
            onFilterChange(event.target.value)
          }
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-800"
        >
          <option value="ALL">
            All
          </option>

          <option value="DEPOSIT">
            Deposits
          </option>

          <option value="WITHDRAWAL">
            Withdrawals
          </option>

          <option value="TRANSFER">
            Transfers
          </option>
        </select>
      </div>

      {isLoading ? (
        <p className="mt-8 text-slate-500">
          Loading transactions...
        </p>
      ) : transactions.length === 0 ? (
        <div className="mt-8 rounded-xl bg-slate-50 p-8 text-center text-slate-500">
          No transactions found.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">
                  Type
                </th>

                <th className="px-4 py-3">
                  Amount
                </th>

                <th className="px-4 py-3">
                  Status
                </th>

                <th className="px-4 py-3">
                  Details
                </th>

                <th className="px-4 py-3">
                  Date
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {transactions.map((transaction) => {
                const isCredit =
                  transaction.direction === 'CREDIT';

                const details =
                  transaction.reference ??
                  transaction.description ??
                  transaction.counterpartyWalletId ??
                  '-';

                return (
                  <tr
                    key={transaction.id}
                    className="text-sm"
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">
                        {transaction.type}
                      </div>

                      <div
                        className={
                          isCredit
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }
                      >
                        {transaction.direction}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`font-bold ${
                          isCredit
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {isCredit ? '+' : '-'}
                        {transaction.currency}{' '}
                        {Number(
                          transaction.amount,
                        ).toLocaleString(
                          'en-IN',
                          {
                            minimumFractionDigits: 2,
                          },
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {transaction.status}
                      </span>
                    </td>

                    <td className="max-w-xs px-4 py-4 text-slate-600">
                      {details}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                      {new Date(
                        transaction.createdAt,
                      ).toLocaleString(
                        'en-IN',
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}