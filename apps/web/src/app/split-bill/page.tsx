'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Button,
  Card,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageContainer,
  PageHeader,
  SelectField,
  StatusBadge,
} from '../components/customer';

import {
  getStoredUser,
  userAuthenticatedRequest,
} from '../lib/api';

import {
  calculateEqualSplitAmount,
  defaultSplitDueAt,
  exactSplitAmountsMatch,
  getEffectiveSplitStatus,
  getSplitProgress,
  isFutureSplitDueAt,
  isSelectableSplitParticipant,
  isSplitAllocationPayable,
  matchesSplitHistoryStatus,
  matchesSplitHistoryView,
  minimumSplitDueAt,
  normalizeSplitAmount,
} from './split-bill-utils';

import type {
  SplitHistoryStatusFilter,
  SplitHistoryView,
} from './split-bill-utils';

import {
  getSplitBillDeepLink,
} from './split-bill-deeplink';

type Wallet = {
  id: string;
  currency: string;
  status: string;
};

type Contact = {
  id: string;
  nickname?: string | null;

  recipient: {
    id: string;
    firstName: string;
    lastName?: string | null;
  };
};

type Allocation = {
  id: string;
  participantUserId: string;
  amount: string;
  status: string;
};

type Split = {
  id: string;
  creatorUserId: string;
  walletId: string;
  currency: string;
  totalAmount: string;
  type: 'EQUAL' | 'EXACT';
  status: string;
  note?: string | null;
  dueAt: string;
  allocations: Allocation[];
};

const makeKey = (
  prefix: string,
) =>
  `${prefix}:${crypto.randomUUID()}`;

export default function SplitBillPage() {
  const [user] =
    useState(getStoredUser);

  const [items, setItems] =
    useState<Split[] | null>(
      null,
    );

  const [
    contacts,
    setContacts,
  ] = useState<Contact[]>([]);

  const [
    wallets,
    setWallets,
  ] = useState<Wallet[]>([]);

  const [
    participants,
    setParticipants,
  ] = useState<string[]>([]);

  const [
    amounts,
    setAmounts,
  ] = useState<
    Record<string, string>
  >({});

  const [type, setType] =
    useState<
      'EQUAL' | 'EXACT'
    >('EQUAL');

  const [total, setTotal] =
    useState('');

  const [dueAt, setDueAt] =
    useState('');

  const [
    minimumDueAt,
    setMinimumDueAt,
  ] = useState('');

  const [error, setError] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [
    historyView,
    setHistoryView,
  ] = useState<SplitHistoryView>(
    'ALL',
  );

  const [
    historyStatus,
    setHistoryStatus,
  ] =
    useState<SplitHistoryStatusFilter>(
      'ALL',
    );

  const [
    highlightedSplitId,
    setHighlightedSplitId,
  ] = useState<string | null>(
    null,
  );

  const [
    highlightedAllocationId,
    setHighlightedAllocationId,
  ] = useState<string | null>(
    null,
  );

  const load =
    useCallback(async () => {
      if (!user) {
        return;
      }

      try {
        const [
          splits,
          people,
          walletValue,
        ] = await Promise.all([
          userAuthenticatedRequest<
            Split[]
          >(
            '/customer-features/splits',
          ),

          userAuthenticatedRequest<
            Contact[]
          >(
            '/customer-features/contacts',
          ),

          userAuthenticatedRequest<
            | Wallet[]
            | {
                wallets?: Wallet[];
              }
          >(
            `/wallets/user/${user.id}`,
          ),
        ]);

        setItems(splits);
        setContacts(people);

        setWallets(
          Array.isArray(
            walletValue,
          )
            ? walletValue
            : walletValue.wallets ??
                [],
        );
      }
      catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Unable to load bill splits',
        );
      }
    }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const now = new Date();

    setDueAt(
      defaultSplitDueAt(now),
    );

    setMinimumDueAt(
      minimumSplitDueAt(now),
    );
  }, []);

  useEffect(() => {
    const deepLink =
      getSplitBillDeepLink(
        new URLSearchParams(
          window.location.search,
        ),
      );

    setHighlightedSplitId(
      deepLink?.splitId ??
        null,
    );

    setHighlightedAllocationId(
      deepLink?.allocationId ??
        null,
    );
  }, []);

  useEffect(() => {
    if (
      !highlightedSplitId ||
      !items?.some(
        (item) =>
          item.id ===
          highlightedSplitId,
      )
    ) {
      return;
    }

    setHistoryView('ALL');
    setHistoryStatus('ALL');

    const frame =
      window.requestAnimationFrame(
        () => {
          const element =
            document.getElementById(
              `split-bill-${highlightedSplitId}`,
            );

          if (!element) {
            return;
          }

          element.setAttribute(
            'aria-current',
            'true',
          );

          element.classList.add(
            'ring-2',
            'ring-slate-900',
            'ring-offset-2',
          );

          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        },
      );

    return () => {
      window.cancelAnimationFrame(
        frame,
      );

      const element =
        document.getElementById(
          `split-bill-${highlightedSplitId}`,
        );

      element?.removeAttribute(
        'aria-current',
      );

      element?.classList.remove(
        'ring-2',
        'ring-slate-900',
        'ring-offset-2',
      );
    };
  }, [
    highlightedSplitId,
    items,
  ]);

  const selectableContacts =
    contacts.filter(
      (contact) =>
        isSelectableSplitParticipant(
          contact.recipient.id,
          user?.id,
        ),
    );

  const equalShare =
    type === 'EQUAL'
      ? calculateEqualSplitAmount(
          total,
          participants.length,
        )
      : null;

  const visibleSplits =
    items?.filter((item) => {
      const effectiveStatus =
        getEffectiveSplitStatus(
          item.status,
          item.dueAt,
        );

      const participantUserIds =
        item.allocations.map(
          (allocation) =>
            allocation.participantUserId,
        );

      return (
        matchesSplitHistoryView(
          historyView,
          item.creatorUserId,
          participantUserIds,
          user?.id,
        ) &&
        matchesSplitHistoryStatus(
          historyStatus,
          effectiveStatus,
        )
      );
    }) ?? null;

  const createdSplitCount =
    items?.filter(
      (item) =>
        item.creatorUserId ===
        user?.id,
    ).length ?? 0;

  const incomingSplitCount =
    items?.filter(
      (item) =>
        item.creatorUserId !==
          user?.id &&
        item.allocations.some(
          (allocation) =>
            allocation
              .participantUserId ===
            user?.id,
        ),
    ).length ?? 0;

  const activeSplitCount =
    items?.filter((item) =>
      matchesSplitHistoryStatus(
        'ACTIVE',
        getEffectiveSplitStatus(
          item.status,
          item.dueAt,
        ),
      ),
    ).length ?? 0;

  function toggle(
    participantUserId: string,
  ) {
    setParticipants(
      (current) => {
        if (
          current.includes(
            participantUserId,
          )
        ) {
          setAmounts(
            (currentAmounts) => {
              const next = {
                ...currentAmounts,
              };

              delete next[
                participantUserId
              ];

              return next;
            },
          );

          return current.filter(
            (item) =>
              item !==
              participantUserId,
          );
        }

        return [
          ...current,
          participantUserId,
        ];
      },
    );
  }

  async function create(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      event.currentTarget;

    const data =
      new FormData(form);

    setError('');
    setMessage('');

    const wallet =
      wallets.find(
        (item) =>
          item.id ===
          data.get('walletId'),
      );

    if (
      !wallet ||
      wallet.status !== 'ACTIVE'
    ) {
      setError(
        'Choose an active receiving wallet.',
      );

      return;
    }

    const normalizedTotal =
      normalizeSplitAmount(
        total,
      );

    if (!normalizedTotal) {
      setError(
        'Enter a positive total amount with no more than 2 decimal places.',
      );

      return;
    }

    if (
      participants.length === 0
    ) {
      setError(
        'Select at least one participant.',
      );

      return;
    }

    if (
      new Set(participants).size !==
      participants.length
    ) {
      setError(
        'Each participant can only be added once.',
      );

      return;
    }

    if (
      participants.some(
        (participantUserId) =>
          !isSelectableSplitParticipant(
            participantUserId,
            user?.id,
          ),
      )
    ) {
      setError(
        'You cannot include yourself in a split you create.',
      );

      return;
    }

    if (
      !isFutureSplitDueAt(
        dueAt,
      )
    ) {
      setError(
        'Choose a due date in the future.',
      );

      return;
    }

    let allocations: {
      participantUserId: string;
      amount: string;
    }[];

    if (type === 'EQUAL') {
      const amount =
        calculateEqualSplitAmount(
          normalizedTotal,
          participants.length,
        );

      if (!amount) {
        setError(
          'For an equal split, the total must divide exactly to the smallest currency unit.',
        );

        return;
      }

      allocations =
        participants.map(
          (
            participantUserId,
          ) => ({
            participantUserId,
            amount,
          }),
        );
    }
    else {
      const exactAmounts:
        string[] = [];

      for (
        const participantUserId
        of participants
      ) {
        const amount =
          normalizeSplitAmount(
            amounts[
              participantUserId
            ] ?? '',
          );

        if (!amount) {
          setError(
            'Every exact share must be a positive amount with no more than 2 decimal places.',
          );

          return;
        }

        exactAmounts.push(
          amount,
        );
      }

      if (
        !exactSplitAmountsMatch(
          normalizedTotal,
          exactAmounts,
        )
      ) {
        setError(
          'Exact shares must add up to the total amount exactly.',
        );

        return;
      }

      allocations =
        participants.map(
          (
            participantUserId,
            index,
          ) => ({
            participantUserId,
            amount:
              exactAmounts[
                index
              ],
          }),
        );
    }

    const note =
      String(
        data.get('note') ?? '',
      ).trim();

    try {
      await userAuthenticatedRequest(
        '/customer-features/splits',
        {
          method: 'POST',

          body: JSON.stringify({
            walletId:
              wallet.id,

            currency:
              wallet.currency,

            totalAmount:
              normalizedTotal,

            type,

            allocations,

            note:
              note ||
              undefined,

            dueAt:
              new Date(
                dueAt,
              ).toISOString(),

            idempotencyKey:
              makeKey(
                'split',
              ),
          }),
        },
      );

      setMessage(
        'Bill split created. Participants can review and pay their own shares.',
      );

      setParticipants([]);
      setAmounts({});
      setTotal('');
      setType('EQUAL');

      const now =
        new Date();

      setDueAt(
        defaultSplitDueAt(
          now,
        ),
      );

      setMinimumDueAt(
        minimumSplitDueAt(
          now,
        ),
      );

      form.reset();

      await load();
    }
    catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to create split',
      );
    }
  }

  async function act(
    path: string,
    body?: object,
  ) {
    setError('');

    try {
      await userAuthenticatedRequest(
        `/customer-features${path}`,
        {
          method: 'POST',

          body:
            JSON.stringify(
              body ?? {},
            ),
        },
      );

      setMessage(
        'Split updated.',
      );

      await load();
    }
    catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to update split',
      );
    }
  }

  return (
    <main>
      <PageContainer>
        <PageHeader
          eyebrow="Money"
          title="Split bill"
          description="Create equal or exact shares and track authoritative wallet settlement status."
          actions={
            <Button
              variant="secondary"
              onClick={() =>
                void load()
              }
            >
              Refresh
            </Button>
          }
        />

        <div
          aria-live="polite"
          className="mt-5 space-y-3"
        >
          {message ? (
            <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              {message}
            </p>
          ) : null}

          {error ? (
            <ErrorState
              message={error}
            />
          ) : null}
        </div>

        <Card className="mt-7 p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              New split
            </p>

            <h2 className="mt-2 text-xl font-bold text-slate-950">
              Create a bill split
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Choose who owes a
              share, how much they
              owe, and when the
              split is due.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-950">
              Creating a split
              does not move money.
            </p>

            <p className="mt-1 text-sm leading-6 text-blue-800">
              Each participant
              reviews and pays
              their own share
              separately. No share
              is paid automatically.
            </p>
          </div>

          <form
            className="mt-6 space-y-6"
            onSubmit={(event) =>
              void create(event)
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="split-wallet"
                name="walletId"
                label="Receiving wallet"
                required
              >
                <option value="">
                  Choose wallet
                </option>

                {wallets
                  .filter(
                    (item) =>
                      item.status ===
                      'ACTIVE',
                  )
                  .map(
                    (item) => (
                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {
                          item.currency
                        }{' '}
                        wallet
                      </option>
                    ),
                  )}
              </SelectField>

              <SelectField
                id="split-type"
                label="Split method"
                value={type}
                onChange={(
                  event,
                ) =>
                  setType(
                    event.target
                      .value as
                      | 'EQUAL'
                      | 'EXACT',
                  )
                }
              >
                <option value="EQUAL">
                  Equal shares
                </option>

                <option value="EXACT">
                  Exact amounts
                </option>
              </SelectField>

              <Field
                id="split-total"
                label="Total amount"
                value={total}
                onChange={(
                  event,
                ) =>
                  setTotal(
                    event.target
                      .value,
                  )
                }
                inputMode="decimal"
                pattern="\d+(\.\d{1,2})?"
                placeholder="0.00"
                required
              />

              <Field
                id="split-due"
                name="dueAt"
                label="Due at"
                type="datetime-local"
                value={dueAt}
                min={
                  minimumDueAt ||
                  undefined
                }
                onChange={(
                  event,
                ) =>
                  setDueAt(
                    event.target
                      .value,
                  )
                }
                required
              />

              <div className="sm:col-span-2">
                <Field
                  id="split-note"
                  name="note"
                  label="Note (optional)"
                  maxLength={240}
                  placeholder="Dinner, rent, trip, groceries..."
                />
              </div>
            </div>

            <fieldset>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <legend className="text-sm font-semibold text-slate-950">
                    Participants
                  </legend>

                  <p className="mt-1 text-sm text-slate-500">
                    Select saved
                    Payflow contacts.
                    You are excluded
                    automatically.
                  </p>
                </div>

                <p className="text-sm font-semibold text-slate-600">
                  {
                    participants.length
                  }{' '}
                  selected
                </p>
              </div>

              {selectableContacts.length ===
              0 ? (
                <div className="mt-4 rounded-xl border border-dashed p-5 text-sm text-slate-600">
                  No eligible saved
                  contacts are
                  available for this
                  split.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {selectableContacts.map(
                    (contact) => {
                      const id =
                        contact
                          .recipient
                          .id;

                      const checked =
                        participants.includes(
                          id,
                        );

                      const name =
                        contact.nickname ||
                        [
                          contact
                            .recipient
                            .firstName,
                          contact
                            .recipient
                            .lastName,
                        ]
                          .filter(
                            Boolean,
                          )
                          .join(' ');

                      return (
                        <div
                          key={
                            contact.id
                          }
                          className={`rounded-2xl border p-4 transition ${
                            checked
                              ? 'border-blue-200 bg-blue-50/50'
                              : 'border-slate-200'
                          }`}
                        >
                          <label className="flex min-h-11 cursor-pointer items-center gap-3">
                            <input
                              type="checkbox"
                              checked={
                                checked
                              }
                              onChange={() =>
                                toggle(
                                  id,
                                )
                              }
                            />

                            <span className="min-w-0 font-medium text-slate-950">
                              {name}
                            </span>
                          </label>

                          {checked &&
                          type ===
                            'EXACT' ? (
                            <div className="mt-3">
                              <Field
                                id={`allocation-${id}`}
                                label="Their exact share"
                                value={
                                  amounts[
                                    id
                                  ] ??
                                  ''
                                }
                                onChange={(
                                  event,
                                ) =>
                                  setAmounts(
                                    (
                                      current,
                                    ) => ({
                                      ...current,
                                      [id]:
                                        event
                                          .target
                                          .value,
                                    }),
                                  )
                                }
                                inputMode="decimal"
                                pattern="\d+(\.\d{1,2})?"
                                placeholder="0.00"
                                required
                              />
                            </div>
                          ) : checked &&
                            type ===
                              'EQUAL' ? (
                            <div className="mt-3 rounded-xl bg-white p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Equal
                                share
                              </p>

                              <p className="mt-1 font-bold text-slate-950">
                                {equalShare ??
                                  'Enter a total that divides exactly'}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </fieldset>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-slate-600">
                  Split method
                </span>

                <span className="font-semibold text-slate-950">
                  {type ===
                  'EQUAL'
                    ? 'Equal shares'
                    : 'Exact amounts'}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-slate-600">
                  Participants
                </span>

                <span className="font-semibold text-slate-950">
                  {
                    participants.length
                  }
                </span>
              </div>

              {type ===
                'EQUAL' &&
              participants.length >
                0 ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600">
                    Each share
                  </span>

                  <span className="font-semibold text-slate-950">
                    {equalShare ??
                      'Not exactly divisible'}
                  </span>
                </div>
              ) : null}
            </div>

            <Button type="submit">
              Create split
            </Button>
          </form>
        </Card>

        <section className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Splits and history
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Review splits you created, incoming shares, payment progress, and final status.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
                Created {createdSplitCount}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
                Incoming {incomingSplitCount}
              </span>

              <span className="rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700">
                Active {activeSplitCount}
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              aria-label="Split direction filters"
            >
              {(
                [
                  ['ALL', 'All'],
                  ['CREATED', 'Created by me'],
                  ['INCOMING', 'Incoming'],
                ] as const
              ).map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={
                      historyView === value
                    }
                    onClick={() =>
                      setHistoryView(value)
                    }
                    className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-semibold transition ${
                      historyView === value
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>

            <div
              className="flex gap-2 overflow-x-auto pb-1"
              aria-label="Split status filters"
            >
              {(
                [
                  ['ALL', 'All status'],
                  ['ACTIVE', 'Active'],
                  ['PAID', 'Paid'],
                  ['CANCELLED', 'Cancelled'],
                  ['EXPIRED', 'Expired'],
                ] as const
              ).map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={
                      historyStatus ===
                      value
                    }
                    onClick={() =>
                      setHistoryStatus(
                        value,
                      )
                    }
                    className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-semibold transition ${
                      historyStatus === value
                        ? 'border-blue-700 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          </div>

          {items === null ? (
            <LoadingState />
          ) : items.length === 0 ? (
            <EmptyState
              title="No splits"
              description="Created and participating splits will appear here."
            />
          ) : visibleSplits?.length ===
            0 ? (
            <div className="mt-5">
              <EmptyState
                title="No matching splits"
                description="Try another direction or status filter."
              />
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {visibleSplits?.map(
                (item) => (
                  <div
                    key={item.id}
                    id={`split-bill-${item.id}`}
                    className="scroll-mt-24 rounded-2xl transition"
                  >
                    <SplitCard
                      item={item}
                      userId={user?.id}
                      wallets={wallets}
                      contacts={contacts}
                      highlightedAllocationId={
                        highlightedSplitId ===
                        item.id
                          ? highlightedAllocationId
                          : null
                      }
                      act={act}
                    />
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </PageContainer>
    </main>
  );
}

function SplitCard({
  item,
  userId,
  wallets,
  contacts,
  highlightedAllocationId,
  act,
}: {
  item: Split;
  userId?: string;
  wallets: Wallet[];
  contacts: Contact[];
  highlightedAllocationId?: string | null;

  act: (
    path: string,
    body?: object,
  ) => Promise<void>;
}) {
  const mine =
    item.allocations.find(
      (allocation) =>
        allocation
          .participantUserId ===
        userId,
    );

  const effectiveStatus =
    getEffectiveSplitStatus(
      item.status,
      item.dueAt,
    );

  const progress =
    getSplitProgress(
      item.allocations.map(
        (allocation) =>
          allocation.status,
      ),
    );

  const directionLabel =
    item.creatorUserId ===
    userId
      ? 'Created by you'
      : 'Shared with you';

  function participantLabel(
    participantUserId: string,
  ): string {
    if (
      participantUserId ===
      userId
    ) {
      return 'Your share';
    }

    const contact =
      contacts.find(
        (item) =>
          item.recipient.id ===
          participantUserId,
      );

    if (!contact) {
      return 'Participant';
    }

    return (
      contact.nickname ||
      [
        contact.recipient
          .firstName,
        contact.recipient
          .lastName,
      ]
        .filter(Boolean)
        .join(' ')
    );
  }

  const [
    walletId,
    setWalletId,
  ] = useState('');

  const [
    reviewPayOpen,
    setReviewPayOpen,
  ] = useState(false);

  const [
    isPaying,
    setIsPaying,
  ] = useState(false);

  const payable =
    mine
      ? isSplitAllocationPayable(
          effectiveStatus,
          mine.status,
          item.dueAt,
        )
      : false;

  async function confirmPayShare() {
    if (
      !mine ||
      !walletId ||
      !payable ||
      isPaying
    ) {
      return;
    }

    setIsPaying(true);

    try {
      await act(
        `/split-allocations/${mine.id}/pay`,
        {
          sourceWalletId:
            walletId,

          idempotencyKey:
            makeKey(
              'split-pay',
            ),
        },
      );

      setReviewPayOpen(
        false,
      );
    }
    finally {
      setIsPaying(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex justify-between gap-3">
        <div>
          <h3 className="font-bold">
            {item.currency}{' '}
            {item.totalAmount}{' '}
            · {item.type}
          </h3>

          <p className="mt-1 text-sm text-slate-600">
            {directionLabel}
            {' · '}
            {item.note ||
              'No note'}
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-500">
            {effectiveStatus ===
            'EXPIRED'
              ? 'Expired'
              : 'Due'}{' '}
            {new Date(
              item.dueAt,
            ).toLocaleString()}
          </p>
        </div>

        <StatusBadge
          status={effectiveStatus}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-slate-950">
            Payment progress
          </span>

          <span className="font-semibold text-slate-700">
            {progress.paid}/{progress.total} paid
          </span>
        </div>

        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label="Split payment progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
        >
          <div
            className="h-full rounded-full bg-slate-900 transition-all"
            style={{
              width: `${progress.percent}%`,
            }}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
          <span>
            {progress.paid} paid
          </span>

          <span>
            {progress.pending} pending
          </span>

          {progress.cancelled >
          0 ? (
            <span>
              {progress.cancelled} cancelled
            </span>
          ) : null}

          <span>
            {progress.percent}%
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {item.allocations.map(
          (allocation) => (
            <li
              key={
                allocation.id
              }
              aria-current={
                highlightedAllocationId ===
                allocation.id
                  ? 'true'
                  : undefined
              }
              className={`flex justify-between gap-3 rounded-lg p-3 text-sm transition ${
                highlightedAllocationId ===
                allocation.id
                  ? 'bg-blue-50 ring-2 ring-blue-600 ring-offset-1'
                  : 'bg-slate-50'
              }`}
            >
              <span>
                {participantLabel(
                  allocation.participantUserId,
                )}
              </span>

              <span className="font-semibold">
                {item.currency}{' '}
                {
                  allocation.amount
                }{' '}
                ·{' '}
                {
                  allocation.status
                }
              </span>
            </li>
          ),
        )}
      </ul>

      {mine?.status ===
        'PENDING' ? (
        <div className="mt-4">
          {payable ? (
            <>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-950">
                  Review before paying your share
                </p>

                <p className="mt-1 text-sm leading-6 text-amber-800">
                  Paying this share moves {item.currency} {mine.amount} from your selected wallet to the split receiving wallet.
                </p>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <select
                  aria-label="Wallet for split payment"
                  value={walletId}
                  disabled={
                    isPaying
                  }
                  onChange={(
                    event,
                  ) =>
                    setWalletId(
                      event.target
                        .value,
                    )
                  }
                  className="min-h-11 w-full rounded-xl border px-3 sm:w-auto"
                >
                  <option value="">
                    Choose{' '}
                    {item.currency}{' '}
                    wallet
                  </option>

                  {wallets
                    .filter(
                      (wallet) =>
                        wallet.currency ===
                          item.currency &&
                        wallet.status ===
                          'ACTIVE' &&
                        wallet.id !==
                          item.walletId,
                    )
                    .map(
                      (wallet) => (
                        <option
                          key={
                            wallet.id
                          }
                          value={
                            wallet.id
                          }
                        >
                          {
                            wallet.currency
                          }{' '}
                          wallet
                        </option>
                      ),
                    )}
                </select>

                <Button
                  className="w-full sm:w-auto"
                  disabled={
                    !walletId ||
                    isPaying
                  }
                  onClick={() =>
                    setReviewPayOpen(
                      true,
                    )
                  }
                >
                  Review Pay Share
                </Button>
              </div>

              <ConfirmationDialog
                open={
                  reviewPayOpen
                }
                title="Pay your split share?"
                description={`You are about to pay ${item.currency} ${mine.amount}. This action moves money from your selected wallet to the split receiving wallet.`}
                confirmLabel="Pay share"
                isLoading={
                  isPaying
                }
                onConfirm={() =>
                  void confirmPayShare()
                }
                onClose={() => {
                  if (
                    !isPaying
                  ) {
                    setReviewPayOpen(
                      false,
                    );
                  }
                }}
              />
            </>
          ) : (
            <div
              role="status"
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"
            >
              This share is no longer payable. It may be expired, cancelled, completed, or already paid.
            </div>
          )}
        </div>
      ) : null}

      {item.creatorUserId ===
        userId &&
      [
        'OPEN',
        'PARTIALLY_PAID',
      ].includes(
        item.status,
      ) ? (
        <Button
          className="mt-4"
          variant="danger"
          onClick={() =>
            void act(
              `/splits/${item.id}/cancel`,
            )
          }
        >
          Cancel split
        </Button>
      ) : null}
    </Card>
  );
}
