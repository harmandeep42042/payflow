'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  API_GATEWAY_URL,
  clearAuthSession,
  getAccessToken,
  getStoredUser,
  PayflowUser,
} from '../lib/api';

type Wallet = {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] =
    useState<PayflowUser | null>(null);

  const [wallets, setWallets] = useState<
    Wallet[]
  >([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] = useState('');

  const loadWallets = useCallback(
    async (
      currentUser: PayflowUser,
      token: string,
    ): Promise<void> => {
      try {
        const response = await fetch(
          `${API_GATEWAY_URL}/wallets/user/${currentUser.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const responseBody = await response.json();

        if (response.status === 401) {
          clearAuthSession();
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          throw new Error(
            responseBody.message ??
              'Unable to load wallets',
          );
        }

        const walletData =
          responseBody.data ?? responseBody;

        setWallets(
          Array.isArray(walletData)
            ? walletData
            : [],
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load wallets',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const token = getAccessToken();
    const storedUser = getStoredUser();

    if (!token || !storedUser) {
      router.replace('/login');
      return;
    }

    setUser(storedUser);

    void loadWallets(storedUser, token);
  }, [loadWallets, router]);

  function handleLogout(): void {
    clearAuthSession();
    router.push('/login');
    router.refresh();
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="font-semibold text-slate-600">
          Loading dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-sky-600">
              Payflow
            </h1>

            <p className="text-sm text-slate-500">
              Customer Dashboard
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="font-semibold text-slate-900">
                {user?.firstName}{' '}
                {user?.lastName ?? ''}
              </p>

              <p className="text-sm text-slate-500">
                {user?.email}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
            Overview
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            Welcome, {user?.firstName}
          </h2>

          <p className="mt-2 text-slate-600">
            Review your wallets and available balances.
          </p>
        </section>

        {error ? (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">
              Your wallets
            </h3>

            <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700">
              {wallets.length} wallet
              {wallets.length === 1 ? '' : 's'}
            </span>
          </div>

          {wallets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <h4 className="text-lg font-bold text-slate-900">
                No wallets found
              </h4>

              <p className="mt-2 text-slate-500">
                A wallet must be created for this user
                before transactions can be performed.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {wallets.map((wallet) => (
                <article
                  key={wallet.id}
                  className="overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-400">
                        Available balance
                      </p>

                      <p className="mt-2 text-3xl font-bold">
                        {wallet.currency}{' '}
                        {Number(
                          wallet.balance,
                        ).toLocaleString(
                          'en-IN',
                          {
                            minimumFractionDigits: 2,
                          },
                        )}
                      </p>
                    </div>

                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                      {wallet.status}
                    </span>
                  </div>

                  <div className="mt-10 border-t border-slate-700 pt-4">
                    <p className="text-xs uppercase tracking-wider text-slate-400">
                      Wallet ID
                    </p>

                    <p className="mt-1 break-all text-sm text-slate-200">
                      {wallet.id}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
