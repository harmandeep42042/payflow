'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
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

import DashboardHeader from './components/DashboardHeader';
import SummaryCards from './components/SummaryCards';
import TransactionChart from './components/TransactionChart';
import TransactionTable, {
  WalletTransaction,
} from './components/TransactionTable';
import WalletActions, {
  WalletActionType,
} from './components/WalletActions';
import WalletCards from './components/WalletCards';

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

type TransactionHistoryResponse = {
  wallet: Wallet;

  filters: {
    type: string;
    page: number;
    limit: number;
  };

  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };

  transactions: WalletTransaction[];
};

function createIdempotencyKey(
  prefix: string,
): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] =
    useState<PayflowUser | null>(null);

  const [wallets, setWallets] =
    useState<Wallet[]>([]);

  const [
    selectedWalletId,
    setSelectedWalletId,
  ] = useState('');

  const [
    transactions,
    setTransactions,
  ] = useState<WalletTransaction[]>([]);

  const [
    transactionFilter,
    setTransactionFilter,
  ] = useState('ALL');

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    isActionLoading,
    setIsActionLoading,
  ] = useState(false);

  const [
    isHistoryLoading,
    setIsHistoryLoading,
  ] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [
    activeAction,
    setActiveAction,
  ] = useState<WalletActionType>(
    'DEPOSIT',
  );

  const [amount, setAmount] = useState('');

  const [reference, setReference] =
    useState('');

  const [
    destinationWalletId,
    setDestinationWalletId,
  ] = useState('');

  const [
    description,
    setDescription,
  ] = useState('');

  const selectedWallet = useMemo(
    () =>
      wallets.find(
        (wallet) =>
          wallet.id === selectedWalletId,
      ) ?? null,
    [
      wallets,
      selectedWalletId,
    ],
  );

  const authenticatedFetch = useCallback(
    async (
      path: string,
      options: RequestInit = {},
    ) => {
      const token = getAccessToken();

      if (!token) {
        clearAuthSession();
        router.replace('/login');

        throw new Error(
          'Your session has expired',
        );
      }

      const response = await fetch(
        `${API_GATEWAY_URL}${path}`,
        {
          ...options,

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${token}`,

            ...options.headers,
          },
        },
      );

      const responseBody =
        await response.json();

      if (response.status === 401) {
        clearAuthSession();
        router.replace('/login');

        throw new Error(
          'Your session has expired',
        );
      }

      if (!response.ok) {
        const message =
          Array.isArray(
            responseBody.message,
          )
            ? responseBody.message.join(
                ', ',
              )
            : responseBody.message ??
              responseBody.error ??
              'Request failed';

        throw new Error(message);
      }

      return (
        responseBody.data ??
        responseBody
      );
    },
    [router],
  );

  const loadWallets = useCallback(
    async (
      currentUser: PayflowUser,
    ): Promise<void> => {
      try {
        setError('');

        const walletData =
          await authenticatedFetch(
            `/wallets/user/${currentUser.id}`,
          );

        const loadedWallets =
          Array.isArray(walletData)
            ? (walletData as Wallet[])
            : [];

        setWallets(loadedWallets);

        if (
          loadedWallets.length > 0 &&
          !selectedWalletId
        ) {
          setSelectedWalletId(
            loadedWallets[0].id,
          );
        }
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
    [
      authenticatedFetch,
      selectedWalletId,
    ],
  );

  const loadTransactionHistory =
    useCallback(
      async (): Promise<void> => {
        if (!selectedWalletId) {
          setTransactions([]);
          return;
        }

        try {
          setIsHistoryLoading(true);
          setError('');

          const history =
            (await authenticatedFetch(
              `/wallets/${selectedWalletId}/transactions?type=${transactionFilter}&page=1&limit=50`,
            )) as TransactionHistoryResponse;

          setTransactions(
            history.transactions ?? [],
          );
        } catch (requestError) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load transaction history',
          );
        } finally {
          setIsHistoryLoading(false);
        }
      },
      [
        authenticatedFetch,
        selectedWalletId,
        transactionFilter,
      ],
    );

  useEffect(() => {
    const storedUser =
      getStoredUser();

    const token =
      getAccessToken();

    if (!storedUser || !token) {
      router.replace('/login');
      return;
    }

    setUser(storedUser);

    void loadWallets(storedUser);
  }, [
    loadWallets,
    router,
  ]);

  useEffect(() => {
    if (selectedWalletId) {
      void loadTransactionHistory();
    }
  }, [
    selectedWalletId,
    transactionFilter,
    loadTransactionHistory,
  ]);

  function resetActionForm(): void {
    setAmount('');
    setReference('');
    setDestinationWalletId('');
    setDescription('');
  }

  function handleActionChange(
    action: WalletActionType,
  ): void {
    setActiveAction(action);
    setError('');
    setSuccess('');
    resetActionForm();
  }

  async function refreshDashboard(): Promise<void> {
    if (!user) {
      return;
    }

    await loadWallets(user);
    await loadTransactionHistory();
  }

  async function handleWalletAction(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!selectedWallet) {
      setError(
        'Please select a wallet first',
      );

      return;
    }

    setError('');
    setSuccess('');
    setIsActionLoading(true);

    try {
      if (activeAction === 'DEPOSIT') {
        await authenticatedFetch(
          '/wallets/deposit',
          {
            method: 'POST',

            body: JSON.stringify({
              walletId:
                selectedWallet.id,

              amount:
                amount.trim(),

              currency:
                selectedWallet.currency,

              reference:
                reference.trim() ||
                'WEB-DEPOSIT',

              idempotencyKey:
                createIdempotencyKey(
                  'web-deposit',
                ),
            }),
          },
        );

        setSuccess(
          'Money deposited successfully',
        );
      }

      if (activeAction === 'WITHDRAW') {
        await authenticatedFetch(
          '/wallets/withdraw',
          {
            method: 'POST',

            body: JSON.stringify({
              walletId:
                selectedWallet.id,

              amount:
                amount.trim(),

              currency:
                selectedWallet.currency,

              reference:
                reference.trim() ||
                'WEB-WITHDRAWAL',

              idempotencyKey:
                createIdempotencyKey(
                  'web-withdraw',
                ),
            }),
          },
        );

        setSuccess(
          'Money withdrawn successfully',
        );
      }

      if (activeAction === 'TRANSFER') {
        if (
          !destinationWalletId.trim()
        ) {
          throw new Error(
            'Destination wallet ID is required',
          );
        }

        await authenticatedFetch(
          '/wallets/transfer',
          {
            method: 'POST',

            body: JSON.stringify({
              sourceWalletId:
                selectedWallet.id,

              destinationWalletId:
                destinationWalletId.trim(),

              amount:
                amount.trim(),

              currency:
                selectedWallet.currency,

              description:
                description.trim() ||
                'Payflow transfer',

              idempotencyKey:
                createIdempotencyKey(
                  'web-transfer',
                ),
            }),
          },
        );

        setSuccess(
          'Money transferred successfully',
        );
      }

      resetActionForm();

      await refreshDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Transaction failed',
      );
    } finally {
      setIsActionLoading(false);
    }
  }

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
      <DashboardHeader
        firstName={user?.firstName}
        lastName={user?.lastName}
        email={user?.email}
        onLogout={handleLogout}
      />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
            Overview
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            Welcome, {user?.firstName}
          </h2>

          <p className="mt-2 text-slate-600">
            Manage your wallets and
            transactions.
          </p>
        </section>

        <div className="mt-8">
          <SummaryCards
            wallets={wallets}
            transactions={transactions}
          />
        </div>

        <div className="mt-8">
          <TransactionChart
            transactions={transactions}
          />
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="mt-10">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <h3 className="text-xl font-bold text-slate-900">
              Your wallets
            </h3>

            {wallets.length > 0 ? (
              <select
                value={selectedWalletId}

                onChange={(event) =>
                  setSelectedWalletId(
                    event.target.value,
                  )
                }

                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-800"
              >
                {wallets.map(
                  (wallet) => (
                    <option
                      key={wallet.id}
                      value={wallet.id}
                    >
                      {wallet.currency}
                      {' - '}
                      {wallet.id.slice(
                        0,
                        8,
                      )}
                    </option>
                  ),
                )}
              </select>
            ) : null}
          </div>

          <WalletCards
            wallets={wallets}
            selectedWalletId={
              selectedWalletId
            }
            onSelectWallet={
              setSelectedWalletId
            }
          />
        </section>

        {selectedWallet ? (
          <div className="mt-10 space-y-10">
            <WalletActions
              selectedWallet={
                selectedWallet
              }

              activeAction={
                activeAction
              }

              amount={amount}

              reference={reference}

              destinationWalletId={
                destinationWalletId
              }

              description={
                description
              }

              isLoading={
                isActionLoading
              }

              onActionChange={
                handleActionChange
              }

              onAmountChange={
                setAmount
              }

              onReferenceChange={
                setReference
              }

              onDestinationWalletChange={
                setDestinationWalletId
              }

              onDescriptionChange={
                setDescription
              }

              onSubmit={
                handleWalletAction
              }
            />

            <TransactionTable
              transactions={
                transactions
              }

              filter={
                transactionFilter
              }

              isLoading={
                isHistoryLoading
              }

              onFilterChange={
                setTransactionFilter
              }
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}