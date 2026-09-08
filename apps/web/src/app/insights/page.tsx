'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
} from '../components/customer';
import {
  userAuthenticatedRequest,
} from '../lib/api';
import {
  buildCategoryBreakdown,
  buildSpendingTrend,
  comparePeriods,
  formatMoneyString,
  humanizeCategory,
  type CategoryTotal,
  type CurrencyTrendPoint,
} from './spending-insights';

type RangeDays = 1 | 7 | 30 | 90;

type CurrencyInsight = {
  currency: string;
  incoming: string;
  outgoing: string;
  successfulCount: number;
  failedOrCancelledCount: number;
  averageAmount: string;
  largestAmount: string;
  trend: CurrencyTrendPoint[];
};

type RecentActivity = {
  id: string;
  type: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
};

type TypeBreakdown = {
  type: string;
  count: number;
};

type MonthlyTrend = {
  month: string;
  count: number;
};

type InsightsResponse = {
  range: {
    from: string;
    to: string;
  };
  transactionCount: number;
  currencies: CurrencyInsight[];
  recent: RecentActivity[];
  categoriesAvailable: boolean;
  categoryTotals: CategoryTotal[];
  typeBreakdown: TypeBreakdown[];
  monthlyTrend: MonthlyTrend[];
};

const RANGE_OPTIONS: Array<{
  days: RangeDays;
  label: string;
}> = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

function shiftUtcDay(
  day: string,
  offset: number,
): string {
  const value =
    new Date(
      `${day}T00:00:00.000Z`,
    );

  value.setUTCDate(
    value.getUTCDate() + offset,
  );

  return value
    .toISOString()
    .slice(0, 10);
}

function createPeriods(
  days: RangeDays,
) {
  const to =
    new Date()
      .toISOString()
      .slice(0, 10);

  const from =
    shiftUtcDay(
      to,
      -(days - 1),
    );

  const previousTo =
    shiftUtcDay(
      from,
      -1,
    );

  const previousFrom =
    shiftUtcDay(
      previousTo,
      -(days - 1),
    );

  return {
    current: {
      from,
      to,
    },
    previous: {
      from: previousFrom,
      to: previousTo,
    },
  };
}

function insightsUrl(
  from: string,
  to: string,
): string {
  const query =
    new URLSearchParams({
      from,
      to,
    });

  return `/customer-features/insights?${query.toString()}`;
}

function displayDate(
  value: string,
): string {
  return new Date(
    value,
  ).toLocaleDateString(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  );
}

function displayActivityDate(
  value: string,
): string {
  return new Date(
    value,
  ).toLocaleString(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    },
  );
}

function activityLabel(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

export default function InsightsPage() {
  const requestSequence =
    useRef(0);

  const [days, setDays] =
    useState<RangeDays>(30);

  const [data, setData] =
    useState<InsightsResponse | null>(
      null,
    );

  const [
    previousData,
    setPreviousData,
  ] =
    useState<InsightsResponse | null>(
      null,
    );

  const [
    selectedCurrency,
    setSelectedCurrency,
  ] = useState('');

  const [error, setError] =
    useState('');

  const [isLoading, setIsLoading] =
    useState(true);

  const load =
    useCallback(async () => {
      const sequence =
        ++requestSequence.current;

      const periods =
        createPeriods(days);

      setError('');
      setIsLoading(true);

      try {
        const [current, previous] =
          await Promise.all([
            userAuthenticatedRequest<InsightsResponse>(
              insightsUrl(
                periods.current.from,
                periods.current.to,
              ),
            ),
            userAuthenticatedRequest<InsightsResponse>(
              insightsUrl(
                periods.previous.from,
                periods.previous.to,
              ),
            ),
          ]);

        if (
          sequence !==
          requestSequence.current
        ) {
          return;
        }

        setData(current);
        setPreviousData(previous);

        setSelectedCurrency(
          (existing) => {
            if (
              current.currencies.some(
                (item) =>
                  item.currency ===
                  existing,
              )
            ) {
              return existing;
            }

            return (
              current.currencies[0]
                ?.currency ?? ''
            );
          },
        );
      }
      catch (reason) {
        if (
          sequence !==
          requestSequence.current
        ) {
          return;
        }

        setError(
          reason instanceof Error
            ? reason.message
            : 'Unable to load spending insights.',
        );
      }
      finally {
        if (
          sequence ===
          requestSequence.current
        ) {
          setIsLoading(false);
        }
      }
    }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency =
    selectedCurrency ||
    data?.currencies[0]
      ?.currency ||
    '';

  const currentBucket =
    useMemo(
      () =>
        data?.currencies.find(
          (item) =>
            item.currency ===
            currency,
        ) ?? null,
      [currency, data],
    );

  const previousBucket =
    useMemo(
      () =>
        previousData?.currencies.find(
          (item) =>
            item.currency ===
            currency,
        ) ?? null,
      [
        currency,
        previousData,
      ],
    );

  const categories =
    useMemo(
      () =>
        data
          ? buildCategoryBreakdown(
              data.categoryTotals,
              currency,
            )
          : [],
      [currency, data],
    );

  const spendingTrend =
    useMemo(
      () =>
        currentBucket
          ? buildSpendingTrend(
              currentBucket.trend,
              days >= 30 ? 21 : 14,
            )
          : [],
      [currentBucket, days],
    );

  const comparison =
    comparePeriods(
      currentBucket?.outgoing ??
        '0',
      previousBucket?.outgoing ??
        '0',
    );

  const topCategory =
    categories[0] ?? null;

  const comparisonClass =
    comparison.direction ===
      'UP'
      ? 'text-amber-700'
      : comparison.direction ===
          'DOWN'
        ? 'text-emerald-700'
        : 'text-slate-600';

  return (
    <main>
      <PageContainer>
        <PageHeader
          eyebrow="Insights"
          title="Smart spending insights"
          description="Understand your Payflow activity using authoritative transaction history. Amounts remain separated by currency."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/transactions"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700"
              >
                Transactions
              </Link>

              <Button
                variant="secondary"
                disabled={isLoading}
                onClick={() =>
                  void load()
                }
              >
                {isLoading
                  ? 'Refreshing…'
                  : 'Refresh'}
              </Button>
            </div>
          }
        />

        <section
          aria-label="Insight range"
          className="mt-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Analysis period
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Compare current activity with the immediately preceding period.
            </p>
          </div>

          <div
            role="group"
            aria-label="Select insight period"
            className="grid grid-cols-2 gap-2 sm:flex"
          >
            {RANGE_OPTIONS.map(
              (option) => (
                <button
                  key={option.days}
                  type="button"
                  aria-pressed={
                    days ===
                    option.days
                  }
                  disabled={isLoading}
                  onClick={() =>
                    setDays(
                      option.days,
                    )
                  }
                  className={
                    days === option.days
                      ? 'min-h-11 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm'
                      : 'min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-sky-300 hover:text-sky-700'
                  }
                >
                  {option.label}
                </button>
              ),
            )}
          </div>
        </section>

        {error ? (
          <div className="mt-6">
            <ErrorState
              message={error}
              onRetry={() =>
                void load()
              }
            />
          </div>
        ) : null}

        {isLoading && !data ? (
          <div className="mt-8">
            <LoadingState label="Loading spending insights" />
          </div>
        ) : null}

        {!isLoading &&
        data &&
        data.transactionCount === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No activity in this period"
              description="When deposits, withdrawals or transfers appear in this range, Payflow will summarize them here."
            />
          </div>
        ) : null}

        {data &&
        data.transactionCount > 0 &&
        currentBucket ? (
          <>
            <section className="mt-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
                    Spending overview
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-slate-950">
                    Your money movement
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    {displayDate(
                      data.range.from,
                    )}{' '}
                    –{' '}
                    {displayDate(
                      data.range.to,
                    )}
                  </p>
                </div>

                {data.currencies.length >
                1 ? (
                  <label className="text-sm font-semibold text-slate-700">
                    Currency
                    <select
                      value={
                        currency
                      }
                      onChange={(
                        event,
                      ) =>
                        setSelectedCurrency(
                          event
                            .target
                            .value,
                        )
                      }
                      className="ml-3 min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    >
                      {data.currencies.map(
                        (item) => (
                          <option
                            key={
                              item.currency
                            }
                            value={
                              item.currency
                            }
                          >
                            {
                              item.currency
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article
                  data-amount
                  className="rounded-3xl border border-rose-100 bg-gradient-to-br from-white to-rose-50 p-5 shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-500">
                    Money out
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                    {formatMoneyString(
                      currentBucket.outgoing,
                      currency,
                    )}
                  </p>
                  <p
                    className={`mt-3 text-sm font-semibold ${comparisonClass}`}
                  >
                    {comparison.label}{' '}
                    vs previous period
                  </p>
                </article>

                <article
                  data-amount
                  className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-5 shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-500">
                    Money in
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                    {formatMoneyString(
                      currentBucket.incoming,
                      currency,
                    )}
                  </p>
                  <p className="mt-3 text-sm text-slate-500">
                    Completed incoming activity
                  </p>
                </article>

                <article
                  data-amount
                  className="rounded-3xl border border-sky-100 bg-gradient-to-br from-white to-sky-50 p-5 shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-500">
                    Average activity
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                    {formatMoneyString(
                      currentBucket.averageAmount,
                      currency,
                    )}
                  </p>
                  <p className="mt-3 text-sm text-slate-500">
                    Across successful transactions
                  </p>
                </article>

                <article
                  data-amount
                  className="rounded-3xl border border-violet-100 bg-gradient-to-br from-white to-violet-50 p-5 shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-500">
                    Largest activity
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                    {formatMoneyString(
                      currentBucket.largestAmount,
                      currency,
                    )}
                  </p>
                  <p className="mt-3 text-sm text-slate-500">
                    Largest completed movement
                  </p>
                </article>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">
                    Successful
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {
                      currentBucket.successfulCount
                    }
                  </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">
                    Failed / reversed
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {
                      currentBucket.failedOrCancelledCount
                    }
                  </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">
                    Total activity
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {
                      data.transactionCount
                    }
                  </p>
                </article>
              </div>
            </section>

            <div className="mt-7 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <section
                aria-labelledby="spending-trend-title"
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
                      Spending trend
                    </p>
                    <h2
                      id="spending-trend-title"
                      className="mt-1 text-xl font-bold text-slate-950"
                    >
                      Recent outgoing activity
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Completed outgoing activity. Bar height is relative within this chart only.
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {currency}
                  </span>
                </div>

                {spendingTrend.length ? (
                  <div className="mt-7">
                    <div className="flex h-52 min-w-0 items-end gap-2 overflow-x-auto border-b border-slate-200 pb-3">
                      {spendingTrend.map(
                        (point) => (
                          <div
                            key={
                              point.date
                            }
                            className="group flex h-full min-w-6 flex-1 flex-col justify-end"
                            title={`${displayDate(
                              point.date,
                            )}: ${formatMoneyString(
                              point.amount,
                              currency,
                            )}`}
                          >
                            <div
                              aria-hidden="true"
                              className="min-h-1 rounded-t-lg bg-gradient-to-t from-sky-600 to-cyan-400 transition group-hover:brightness-95"
                              style={{
                                height: `${Math.max(
                                  point.percentage,
                                  point.percentage >
                                    0
                                    ? 4
                                    : 1,
                                )}%`,
                              }}
                            />
                          </div>
                        ),
                      )}
                    </div>

                    <div className="mt-3 flex justify-between text-xs text-slate-400">
                      <span>
                        {spendingTrend[0]
                          ? displayDate(
                              spendingTrend[0]
                                .date,
                            )
                          : ''}
                      </span>
                      <span>
                        {spendingTrend[
                          spendingTrend.length -
                            1
                        ]
                          ? displayDate(
                              spendingTrend[
                                spendingTrend.length -
                                  1
                              ].date,
                            )
                          : ''}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-6 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                    No outgoing activity is available for this currency and range.
                  </p>
                )}
              </section>

              <section
                aria-labelledby="top-category-title"
                className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm"
              >
                <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">
                  Top category
                </p>
                <h2
                  id="top-category-title"
                  className="mt-2 text-2xl font-bold"
                >
                  {topCategory
                    ? humanizeCategory(
                        topCategory.category,
                      )
                    : 'Not enough categorized data'}
                </h2>

                {topCategory ? (
                  <>
                    <p
                      data-amount
                      className="mt-5 text-4xl font-bold tracking-tight"
                    >
                      {formatMoneyString(
                        topCategory.amount,
                        currency,
                      )}
                    </p>

                    <p className="mt-2 text-sm text-slate-300">
                      {topCategory.percentage.toFixed(
                        1,
                      )}
                      % of categorized outgoing transfers
                    </p>
                  </>
                ) : (
                  <p className="mt-5 text-sm leading-6 text-slate-300">
                    Categories appear when Payflow has authoritative classifications for outgoing transfers.
                  </p>
                )}
              </section>
            </div>

            <section
              aria-labelledby="category-breakdown-title"
              className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
                  Categories
                </p>
                <h2
                  id="category-breakdown-title"
                  className="mt-1 text-xl font-bold text-slate-950"
                >
                  Where categorized transfers went
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Category totals represent completed outgoing transfers that have an authoritative classification.
                </p>
              </div>

              {categories.length ? (
                <div className="mt-6 space-y-5">
                  {categories.map(
                    (item) => (
                      <div
                        key={
                          item.category
                        }
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-semibold text-slate-800">
                            {humanizeCategory(
                              item.category,
                            )}
                          </span>

                          <span
                            data-amount
                            className="text-sm font-bold text-slate-950"
                          >
                            {formatMoneyString(
                              item.amount,
                              currency,
                            )}
                          </span>
                        </div>

                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-sky-500"
                            style={{
                              width: `${Math.max(
                                item.percentage,
                                item.percentage >
                                  0
                                  ? 2
                                  : 0,
                              )}%`,
                            }}
                          />
                        </div>

                        <p className="mt-1 text-right text-xs text-slate-400">
                          {item.percentage.toFixed(
                            1,
                          )}
                          %
                        </p>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="mt-6 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                  {data.categoriesAvailable
                    ? 'No categorized outgoing spending is available for this currency and period.'
                    : 'Transaction categorization is not available for this activity yet.'}
                </p>
              )}
            </section>

            <div className="mt-7 grid gap-6 lg:grid-cols-2">
              <section
                aria-labelledby="activity-mix-title"
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
                  Activity mix
                </p>
                <h2
                  id="activity-mix-title"
                  className="mt-1 text-xl font-bold text-slate-950"
                >
                  Transaction types
                </h2>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {data.typeBreakdown.map(
                    (item) => (
                      <article
                        key={
                          item.type
                        }
                        className="rounded-2xl bg-slate-50 p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {activityLabel(
                            item.type,
                          )}
                        </p>
                        <p className="mt-2 text-2xl font-bold text-slate-950">
                          {item.count}
                        </p>
                      </article>
                    ),
                  )}
                </div>

                {data.monthlyTrend.length >
                0 ? (
                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <p className="text-sm font-semibold text-slate-800">
                      Monthly activity count
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {data.monthlyTrend.map(
                        (item) => (
                          <span
                            key={
                              item.month
                            }
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                          >
                            {item.month}:{' '}
                            {item.count}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}
              </section>

              <section
                aria-labelledby="recent-insight-title"
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
                      Recent activity
                    </p>
                    <h2
                      id="recent-insight-title"
                      className="mt-1 text-xl font-bold text-slate-950"
                    >
                      Latest movements
                    </h2>
                  </div>

                  <Link
                    href="/transactions"
                    className="text-sm font-semibold text-sky-700 hover:text-sky-800"
                  >
                    View all
                  </Link>
                </div>

                <div className="mt-5 space-y-3">
                  {data.recent
                    .slice(0, 6)
                    .map(
                      (item) => (
                        <article
                          key={
                            item.id
                          }
                          className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 p-4"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-900">
                                {activityLabel(
                                  item.type,
                                )}
                              </span>

                              <span
                                className={
                                  item.status ===
                                  'COMPLETED'
                                    ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700'
                                    : 'rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600'
                                }
                              >
                                {
                                  item.status
                                }
                              </span>
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              {displayActivityDate(
                                item.createdAt,
                              )}
                            </p>
                          </div>

                          <p
                            data-amount
                            className={
                              item.direction ===
                              'DEBIT'
                                ? 'shrink-0 font-bold text-rose-600'
                                : 'shrink-0 font-bold text-emerald-600'
                            }
                          >
                            {item.direction ===
                            'DEBIT'
                              ? '-'
                              : '+'}
                            {formatMoneyString(
                              item.amount,
                              item.currency,
                            )}
                          </p>
                        </article>
                      ),
                    )}
                </div>
              </section>
            </div>

            <p className="mt-6 text-center text-xs leading-5 text-slate-400">
              Insights summarize recorded Payflow activity. They are informational and are not financial advice.
            </p>
          </>
        ) : null}
      </PageContainer>
    </main>
  );
}