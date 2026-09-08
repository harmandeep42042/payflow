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
  getRequestMoneyDeepLink,
} from './request-money-deeplink';
import {
  defaultRequestExpiry,
  getEffectiveMoneyRequestStatus,
  getMoneyRequestStatusDescription,
  getMoneyRequestStatusLabel,
  isFutureRequestExpiry,
  isMoneyRequestActionable,
  matchesMoneyRequestHistoryFilter,
  minimumRequestExpiry,
  normalizeRequestAmount,
  type MoneyRequestDirection,
  type MoneyRequestHistoryFilter,
} from './request-money-utils';

type Wallet = {
  id: string;
  currency: string;
  status: string;
};

type Person = {
  id: string;
  firstName: string;
  lastName?: string | null;
};

type Contact = {
  id: string;
  nickname?: string | null;
  recipient: Person;
};

type MoneyRequest = {
  id: string;
  requesterUserId: string;
  payerUserId: string;
  walletId: string;
  currency: string;
  amount: string;
  note?: string | null;
  status: string;
  expiresAt: string;
  requester?: Person;
  payer?: Person;
};

const OUTGOING_FILTERS:
  MoneyRequestHistoryFilter[] = [
    'ALL',
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'CANCELLED',
    'EXPIRED',
  ];

const key = (prefix: string) =>
  `${prefix}:${crypto.randomUUID()}`;

function personName(
  person?: Person,
): string {
  if (!person) {
    return 'Payflow user';
  }

  return (
    [
      person.firstName,
      person.lastName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    'Payflow user'
  );
}

function contactName(
  contact: Contact,
): string {
  return (
    contact.nickname?.trim() ||
    personName(contact.recipient)
  );
}

export default function RequestMoneyPage() {
  const [user] =
    useState(getStoredUser);

  const [
    highlightedRequestId,
    setHighlightedRequestId,
  ] = useState<string | null>(
    null,
  );

  const [items, setItems] =
    useState<MoneyRequest[] | null>(
      null,
    );

  const [contacts, setContacts] =
    useState<Contact[]>([]);

  const [wallets, setWallets] =
    useState<Wallet[]>([]);

  const [error, setError] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [saving, setSaving] =
    useState(false);

  const [actioningId, setActioningId] =
    useState<string | null>(null);

  const [pendingAction, setPendingAction] =
    useState<{
      item: MoneyRequest;
      name: 'accept' | 'decline';
      sourceWalletId?: string;
    } | null>(null);

  const [
    outgoingFilter,
    setOutgoingFilter,
  ] =
    useState<MoneyRequestHistoryFilter>(
      'ALL',
    );

  const [defaultExpiry] =
    useState(() =>
      defaultRequestExpiry(),
    );

  const [minimumExpiry] =
    useState(() =>
      minimumRequestExpiry(),
    );

  const activeWallets =
    wallets.filter(
      (item) =>
        item.status === 'ACTIVE',
    );

  const requestableContacts =
    contacts.filter(
      (item) =>
        item.recipient.id !==
        user?.id,
    );

  const load =
    useCallback(async () => {
      if (!user) {
        return;
      }

      setError('');

      try {
        const [
          requests,
          people,
          walletValue,
        ] = await Promise.all([
          userAuthenticatedRequest<
            MoneyRequest[]
          >(
            '/customer-features/money-requests',
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

        setItems(requests);
        setContacts(people);

        setWallets(
          Array.isArray(walletValue)
            ? walletValue
            : walletValue.wallets ??
                [],
        );
      }
      catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Unable to load requests',
        );
      }
    }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setHighlightedRequestId(
      getRequestMoneyDeepLink(
        new URLSearchParams(
          window.location.search,
        ),
      ),
    );
  }, []);

  useEffect(() => {
    if (!highlightedRequestId) {
      return;
    }

    setOutgoingFilter('ALL');

    if (
      !items?.some(
        (item) =>
          item.id ===
          highlightedRequestId,
      )
    ) {
      return;
    }

    const frame =
      window.requestAnimationFrame(
        () => {
          const element =
            document.getElementById(
              `money-request-${highlightedRequestId}`,
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
          `money-request-${highlightedRequestId}`,
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
    highlightedRequestId,
    items,
  ]);

  async function create(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      event.currentTarget;

    const data =
      new FormData(form);

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payerUserId =
        String(
          data.get('payerUserId') ??
            '',
        ).trim();

      if (!payerUserId) {
        throw new Error(
          'Choose who should pay you',
        );
      }

      if (
        payerUserId ===
        user?.id
      ) {
        throw new Error(
          'You cannot request money from yourself',
        );
      }

      const walletId =
        String(
          data.get('walletId') ??
            '',
        );

      const wallet =
        activeWallets.find(
          (item) =>
            item.id === walletId,
        );

      if (!wallet) {
        throw new Error(
          'Choose an active receiving wallet',
        );
      }

      const amount =
        normalizeRequestAmount(
          String(
            data.get('amount') ??
              '',
          ),
        );

      if (!amount) {
        throw new Error(
          'Enter a positive amount with at most two decimal places',
        );
      }

      const expiresAt =
        String(
          data.get('expiresAt') ??
            '',
        );

      if (
        !isFutureRequestExpiry(
          expiresAt,
        )
      ) {
        throw new Error(
          'Choose a future expiry time',
        );
      }

      const note =
        String(
          data.get('note') ??
            '',
        ).trim();

      await userAuthenticatedRequest(
        '/customer-features/money-requests',
        {
          method: 'POST',

          body: JSON.stringify({
            payerUserId,
            walletId: wallet.id,
            currency:
              wallet.currency,
            amount,
            note:
              note ||
              undefined,
            expiresAt:
              new Date(
                expiresAt,
              ).toISOString(),
            idempotencyKey:
              key('request'),
          }),
        },
      );

      setMessage(
        'Money request sent successfully.',
      );

      form.reset();

      await load();
    }
    catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to create request',
      );
    }
    finally {
      setSaving(false);
    }
  }

  async function action(
    item: MoneyRequest,
    name:
      | 'accept'
      | 'decline'
      | 'cancel',
    sourceWalletId?: string,
  ) {
    if (actioningId) {
      return;
    }

    if (
      (
        name === 'accept' ||
        name === 'decline'
      ) &&
      !isMoneyRequestActionable(
        item.status,
        item.expiresAt,
      )
    ) {
      setPendingAction(null);

      setError(
        'This request is no longer available for action. Refresh to see its latest status.',
      );

      return;
    }

    if (
      name === 'cancel' &&
      !isMoneyRequestActionable(
        item.status,
        item.expiresAt,
      )
    ) {
      setError(
        'This request is no longer pending and cannot be cancelled.',
      );

      return;
    }

    if (
      name === 'accept' &&
      !sourceWalletId
    ) {
      setError(
        'Choose a wallet before accepting this request.',
      );

      return;
    }

    setActioningId(item.id);
    setError('');
    setMessage('');

    try {
      await userAuthenticatedRequest(
        `/customer-features/money-requests/${item.id}/${name}`,
        {
          method: 'POST',

          body: JSON.stringify(
            name === 'accept'
              ? {
                  sourceWalletId,
                  idempotencyKey:
                    key('accept'),
                }
              : {},
          ),
        },
      );

      setPendingAction(null);

      setMessage(
        name === 'accept'
          ? 'Request accepted.'
          : name === 'decline'
            ? 'Request declined.'
            : 'Request cancelled.',
      );

      await load();
    }
    catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : `Unable to ${name} request`,
      );
    }
    finally {
      setActioningId(null);
    }
  }

  function reviewIncomingAction(
    item: MoneyRequest,
    name: 'accept' | 'decline',
    sourceWalletId?: string,
  ) {
    setError('');

    if (
      !isMoneyRequestActionable(
        item.status,
        item.expiresAt,
      )
    ) {
      setError(
        'This request has expired or is no longer pending. Refresh to see its latest status.',
      );

      return;
    }

    if (
      name === 'accept' &&
      !sourceWalletId
    ) {
      setError(
        'Choose a wallet before reviewing this acceptance.',
      );

      return;
    }

    setPendingAction({
      item,
      name,
      sourceWalletId,
    });
  }

  const incoming =
    items?.filter(
      (item) =>
        item.payerUserId ===
        user?.id,
    ) ?? [];

  const outgoing =
    items?.filter(
      (item) =>
        item.requesterUserId ===
        user?.id,
    ) ?? [];

  const filteredOutgoing =
    outgoing.filter((item) => {
      const status =
        getEffectiveMoneyRequestStatus(
          item.status,
          item.expiresAt,
        );

      return matchesMoneyRequestHistoryFilter(
        status,
        outgoingFilter,
      );
    });

  const outgoingPendingCount =
    outgoing.filter(
      (item) =>
        getEffectiveMoneyRequestStatus(
          item.status,
          item.expiresAt,
        ) === 'PENDING',
    ).length;

  const outgoingHistoryCount =
    outgoing.length -
    outgoingPendingCount;

  const cannotCreate =
    saving ||
    requestableContacts.length ===
      0 ||
    activeWallets.length === 0;

  return (
    <main>
      <PageContainer>
        <PageHeader
          eyebrow="Money"
          title="Request money"
          description="Ask a saved contact to pay you. Requests expire automatically and accepting one still uses Payflow's protected wallet-transfer flow."
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
          className="mt-5"
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

        <Card className="mt-7 p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              New request
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Who should pay you?
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Choose a saved contact,
              receiving wallet, amount and
              expiry. Creating a request
              does not move money.
            </p>
          </div>

          <form
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) =>
              void create(event)
            }
          >
            <SelectField
              id="request-payer"
              name="payerUserId"
              label="Request from"
              required
            >
              <option value="">
                Choose contact
              </option>

              {requestableContacts.map(
                (item) => (
                  <option
                    key={item.id}
                    value={
                      item.recipient.id
                    }
                  >
                    {contactName(item)}
                  </option>
                ),
              )}
            </SelectField>

            <SelectField
              id="request-wallet"
              name="walletId"
              label="Receive into wallet"
              required
            >
              <option value="">
                Choose wallet
              </option>

              {activeWallets.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.currency}{' '}
                    wallet
                  </option>
                ),
              )}
            </SelectField>

            <Field
              id="request-amount"
              name="amount"
              label="Amount"
              inputMode="decimal"
              pattern="\d+(\.\d{1,2})?"
              min="0.01"
              step="0.01"
              autoComplete="off"
              placeholder="0.00"
              required
            />

            <Field
              id="request-expiry"
              name="expiresAt"
              label="Expires at"
              type="datetime-local"
              min={minimumExpiry}
              defaultValue={
                defaultExpiry
              }
              required
            />

            <Field
              id="request-note"
              name="note"
              label="Note (optional)"
              maxLength={240}
              placeholder="Dinner, rent, tickets..."
              className="sm:col-span-2"
            />

            <div className="sm:col-span-2">
              {requestableContacts.length ===
              0 ? (
                <p className="mb-3 text-sm text-amber-700">
                  Add a saved contact
                  before creating a money
                  request.
                </p>
              ) : null}

              {activeWallets.length ===
              0 ? (
                <p className="mb-3 text-sm text-amber-700">
                  You need an active
                  receiving wallet before
                  creating a request.
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={cannotCreate}
                className="w-full touch-manipulation sm:w-auto"
              >
                {saving
                  ? 'Sending…'
                  : 'Send request'}
              </Button>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                The payer must review and
                accept the request before
                any transfer can happen.
              </p>
            </div>
          </form>
        </Card>

        {items === null ? (
          <LoadingState />
        ) : (
          <>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <p className="text-sm font-medium text-slate-600">
                  Pending outgoing
                </p>

                <p className="mt-1 text-2xl font-black text-slate-950">
                  {outgoingPendingCount}
                </p>
              </Card>

              <Card className="p-4">
                <p className="text-sm font-medium text-slate-600">
                  Outgoing history
                </p>

                <p className="mt-1 text-2xl font-black text-slate-950">
                  {outgoingHistoryCount}
                </p>
              </Card>
            </div>

            <section
              className="mt-6"
              aria-label="Outgoing request filters"
            >
              <div className="flex gap-2 overflow-x-auto pb-2">
                {OUTGOING_FILTERS.map(
                  (filter) => (
                    <button
                      key={filter}
                      type="button"
                      aria-pressed={
                        outgoingFilter ===
                        filter
                      }
                      onClick={() =>
                        setOutgoingFilter(
                          filter,
                        )
                      }
                      className={
                        outgoingFilter ===
                        filter
                          ? 'min-h-10 shrink-0 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white'
                          : 'min-h-10 shrink-0 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700'
                      }
                    >
                      {filter === 'ALL'
                        ? 'All'
                        : getMoneyRequestStatusLabel(
                            filter,
                          )}
                    </button>
                  ),
                )}
              </div>
            </section>

            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <RequestList
                title="Incoming"
                empty="No incoming requests"
                items={incoming}
                userId={user?.id}
                wallets={wallets}
                direction="incoming"
                action={action}
                reviewIncomingAction={
                  reviewIncomingAction
                }
                actioningId={
                  actioningId
                }
              />

              <RequestList
                title="Outgoing requests"
                empty={
                  outgoingFilter ===
                  'ALL'
                    ? 'No outgoing requests'
                    : `No ${getMoneyRequestStatusLabel(
                        outgoingFilter,
                      ).toLowerCase()} requests`
                }
                items={filteredOutgoing}
                userId={user?.id}
                wallets={wallets}
                direction="outgoing"
                action={action}
                reviewIncomingAction={
                  reviewIncomingAction
                }
                actioningId={
                  actioningId
                }
              />
            </div>
          </>
        )}
      </PageContainer>

      {pendingAction ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !actioningId
            ) {
              setPendingAction(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-action-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Review request
            </p>

            <h2
              id="request-action-title"
              className="mt-1 text-xl font-bold text-slate-950"
            >
              {pendingAction.name ===
              'accept'
                ? 'Accept money request?'
                : 'Decline money request?'}
            </h2>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-2xl font-black text-slate-950">
                {
                  pendingAction.item
                    .currency
                }{' '}
                {
                  pendingAction.item
                    .amount
                }
              </p>

              <p className="mt-2 text-sm text-slate-600">
                Requested by{' '}
                {personName(
                  pendingAction.item
                    .requester,
                )}
              </p>

              {pendingAction.item.note ? (
                <p className="mt-2 text-sm text-slate-600">
                  {
                    pendingAction.item
                      .note
                  }
                </p>
              ) : null}
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              {pendingAction.name ===
              'accept'
                ? 'Confirming will use your selected wallet and Payflow’s protected transfer flow. Money is not moved until you confirm below.'
                : 'Declining will reject this request. No money will be moved.'}
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                disabled={
                  Boolean(actioningId)
                }
                onClick={() =>
                  setPendingAction(null)
                }
              >
                Go back
              </Button>

              {pendingAction.name ===
              'accept' ? (
                <Button
                  disabled={
                    Boolean(actioningId)
                  }
                  onClick={() =>
                    void action(
                      pendingAction.item,
                      'accept',
                      pendingAction.sourceWalletId,
                    )
                  }
                >
                  {actioningId
                    ? 'Accepting…'
                    : 'Confirm accept'}
                </Button>
              ) : (
                <Button
                  variant="danger"
                  disabled={
                    Boolean(actioningId)
                  }
                  onClick={() =>
                    void action(
                      pendingAction.item,
                      'decline',
                    )
                  }
                >
                  {actioningId
                    ? 'Declining…'
                    : 'Confirm decline'}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function RequestList({
  title,
  empty,
  items,
  userId,
  wallets,
  direction,
  action,
  reviewIncomingAction,
  actioningId,
}: {
  title: string;
  empty: string;
  items: MoneyRequest[];
  userId?: string;
  wallets: Wallet[];
  direction: MoneyRequestDirection;

  action: (
    item: MoneyRequest,
    name:
      | 'accept'
      | 'decline'
      | 'cancel',
    wallet?: string,
  ) => Promise<void>;

  reviewIncomingAction: (
    item: MoneyRequest,
    name: 'accept' | 'decline',
    wallet?: string,
  ) => void;

  actioningId: string | null;
}) {
  const [selected, setSelected] =
    useState<
      Record<string, string>
    >({});

  return (
    <section>
      <h2 className="text-lg font-bold">
        {title}
      </h2>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <EmptyState
            title={empty}
            description="Request history will appear here."
          />
        ) : (
          items.map((item) => {
            const incoming =
              item.payerUserId ===
              userId;

            const counterpart =
              incoming
                ? item.requester
                : item.payer;

            const effectiveStatus =
              getEffectiveMoneyRequestStatus(
                item.status,
                item.expiresAt,
              );

            const actionable =
              isMoneyRequestActionable(
                item.status,
                item.expiresAt,
              );

            return (
              <div
                key={item.id}
                id={`money-request-${item.id}`}
                className="scroll-mt-24"
              >
                <Card className="p-5 transition-shadow">                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">
                      {item.currency}{' '}
                      {item.amount}
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {incoming
                        ? 'From'
                        : 'To'}{' '}
                      {personName(
                        counterpart,
                      )}
                    </p>
                  </div>

                  <StatusBadge
                    status={
                      effectiveStatus
                    }
                  />
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.note ||
                    'No note'}
                </p>

                <p className="mt-2 text-sm font-medium text-slate-700">
                  {getMoneyRequestStatusDescription(
                    effectiveStatus,
                    direction,
                  )}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Expires{' '}
                  {new Date(
                    item.expiresAt,
                  ).toLocaleString()}
                </p>

                {item.status ===
                  'PENDING' &&
                item.payerUserId ===
                  userId &&
                !actionable ? (
                  <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">
                    This request has
                    expired. Refresh to
                    get its latest status.
                  </p>
                ) : null}

                {item.status ===
                  'PENDING' &&
                item.payerUserId ===
                  userId &&
                actionable ? (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <select
                      aria-label="Wallet used to accept"
                      value={
                        selected[
                          item.id
                        ] ?? ''
                      }
                      onChange={(
                        event,
                      ) =>
                        setSelected(
                          (value) => ({
                            ...value,
                            [item.id]:
                              event
                                .target
                                .value,
                          }),
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
                              'ACTIVE',
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
                      disabled={
                        !selected[
                          item.id
                        ] ||
                        actioningId ===
                          item.id
                      }
                      onClick={() =>
                        reviewIncomingAction(
                          item,
                          'accept',
                          selected[
                            item.id
                          ],
                        )
                      }
                    >
                      Accept
                    </Button>

                    <Button
                      variant="secondary"
                      disabled={
                        actioningId ===
                        item.id
                      }
                      onClick={() =>
                        reviewIncomingAction(
                          item,
                          'decline',
                        )
                      }
                    >
                      Decline
                    </Button>
                  </div>
                ) : null}

                {item.requesterUserId ===
                  userId &&
                actionable ? (
                  <Button
                    variant="danger"
                    className="mt-4"
                    disabled={
                      actioningId ===
                      item.id
                    }
                    onClick={() =>
                      void action(
                        item,
                        'cancel',
                      )
                    }
                  >
                    {actioningId ===
                    item.id
                      ? 'Cancelling…'
                      : 'Cancel'}
                  </Button>
                ) : null}
              </Card>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
