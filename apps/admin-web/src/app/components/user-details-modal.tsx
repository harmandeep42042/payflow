'use client';

type UserStatus =
  | 'ACTIVE'
  | 'BLOCKED'
  | 'SUSPENDED';

type UserWallet = {
  id: string;
  currency: string;
  balance: string;
  status: string;
  version?: number;
  createdAt: string;
  updatedAt?: string;

  ledgerAccount?: {
    id: string;
    code: string;
    name: string;
    type: string;
    currency: string;
    status: string;
  } | null;

  transactionCounts?: {
    deposits: number;
    withdrawals: number;
    outgoingTransfers: number;
    incomingTransfers: number;
    total: number;
  };
};

export type AdminUserDetails = {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName?: string | null;
  role: 'USER' | 'ADMIN';
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  wallets: UserWallet[];
  walletCount: number;
  totalWalletBalance: string;
};

type UserDetailsModalProps = {
  user: AdminUserDetails | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string;
  onClose: () => void;
  onUpdateStatus: (
    status: UserStatus,
  ) => Promise<void>;
};

function formatMoney(
  amount: string,
  currency = 'INR',
): string {
  return new Intl.NumberFormat(
    'en-IN',
    {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    },
  ).format(Number(amount) || 0);
}

export function UserDetailsModal({
  user,
  isLoading,
  isUpdating,
  error,
  onClose,
  onUpdateStatus,
}: UserDetailsModalProps) {
  if (!user && !isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <header className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              User Details
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Complete user and wallet information
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700"
          >
            Close
          </button>
        </header>

        {isLoading ? (
          <div className="p-12 text-center font-semibold text-slate-500">
            Loading user details...
          </div>
        ) : user ? (
          <div className="p-6">
            {error ? (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {error}
              </div>
            ) : null}

            <section className="grid gap-5 md:grid-cols-3">
              <article className="rounded-2xl bg-slate-100 p-5">
                <p className="text-sm font-semibold text-slate-500">
                  User
                </p>

                <p className="mt-2 text-xl font-bold text-slate-900">
                  {user.firstName}{' '}
                  {user.lastName ?? ''}
                </p>

                <p className="mt-2 break-all text-sm text-slate-500">
                  {user.id}
                </p>
              </article>

              <article className="rounded-2xl bg-sky-50 p-5">
                <p className="text-sm font-semibold text-sky-700">
                  Total Balance
                </p>

                <p className="mt-2 text-2xl font-bold text-sky-700">
                  {formatMoney(
                    user.totalWalletBalance,
                  )}
                </p>
              </article>

              <article className="rounded-2xl bg-emerald-50 p-5">
                <p className="text-sm font-semibold text-emerald-700">
                  Wallets
                </p>

                <p className="mt-2 text-2xl font-bold text-emerald-700">
                  {user.walletCount}
                </p>
              </article>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900">
                Account Information
              </h3>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Email
                  </p>

                  <p className="mt-1 text-slate-900">
                    {user.email}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Phone
                  </p>

                  <p className="mt-1 text-slate-900">
                    {user.phone ?? 'Not provided'}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Role
                  </p>

                  <p className="mt-1 font-bold text-sky-700">
                    {user.role}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Status
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {user.status}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Joined
                  </p>

                  <p className="mt-1 text-slate-900">
                    {new Date(
                      user.createdAt,
                    ).toLocaleString('en-IN')}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Updated
                  </p>

                  <p className="mt-1 text-slate-900">
                    {new Date(
                      user.updatedAt,
                    ).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-6">
              <h3 className="text-lg font-bold text-slate-900">
                Wallets
              </h3>

              <div className="mt-4 space-y-4">
                {user.wallets.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 p-6 text-center text-slate-500">
                    No wallet found.
                  </div>
                ) : (
                  user.wallets.map(
                    (wallet) => (
                      <article
                        key={wallet.id}
                        className="rounded-2xl border border-slate-200 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-500">
                              Wallet ID
                            </p>

                            <p className="mt-1 break-all font-mono text-sm text-slate-800">
                              {wallet.id}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-2xl font-bold text-slate-900">
                              {formatMoney(
                                wallet.balance,
                                wallet.currency,
                              )}
                            </p>

                            <p className="mt-1 text-sm font-semibold text-emerald-600">
                              {wallet.status}
                            </p>
                          </div>
                        </div>

                        {wallet.transactionCounts ? (
                          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                            <div className="rounded-xl bg-slate-100 p-3">
                              <p className="text-xs text-slate-500">
                                Deposits
                              </p>
                              <p className="mt-1 font-bold">
                                {wallet.transactionCounts.deposits}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-100 p-3">
                              <p className="text-xs text-slate-500">
                                Withdrawals
                              </p>
                              <p className="mt-1 font-bold">
                                {wallet.transactionCounts.withdrawals}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-100 p-3">
                              <p className="text-xs text-slate-500">
                                Sent
                              </p>
                              <p className="mt-1 font-bold">
                                {wallet.transactionCounts.outgoingTransfers}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-100 p-3">
                              <p className="text-xs text-slate-500">
                                Received
                              </p>
                              <p className="mt-1 font-bold">
                                {wallet.transactionCounts.incomingTransfers}
                              </p>
                            </div>

                            <div className="rounded-xl bg-sky-50 p-3">
                              <p className="text-xs text-sky-600">
                                Total
                              </p>
                              <p className="mt-1 font-bold text-sky-700">
                                {wallet.transactionCounts.total}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    ),
                  )
                )}
              </div>
            </section>

            {user.role === 'USER' ? (
              <section className="mt-6 rounded-2xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900">
                  Account Actions
                </h3>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={
                      isUpdating ||
                      user.status === 'ACTIVE'
                    }
                    onClick={() =>
                      void onUpdateStatus(
                        'ACTIVE',
                      )
                    }
                    className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-white disabled:opacity-40"
                  >
                    Activate
                  </button>

                  <button
                    type="button"
                    disabled={
                      isUpdating ||
                      user.status === 'BLOCKED'
                    }
                    onClick={() =>
                      void onUpdateStatus(
                        'BLOCKED',
                      )
                    }
                    className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-white disabled:opacity-40"
                  >
                    Block
                  </button>

                  <button
                    type="button"
                    disabled={
                      isUpdating ||
                      user.status === 'SUSPENDED'
                    }
                    onClick={() =>
                      void onUpdateStatus(
                        'SUSPENDED',
                      )
                    }
                    className="rounded-xl bg-amber-500 px-4 py-2 font-semibold text-white disabled:opacity-40"
                  >
                    Suspend
                  </button>
                </div>

                {isUpdating ? (
                  <p className="mt-3 text-sm font-semibold text-slate-500">
                    Updating user status...
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}