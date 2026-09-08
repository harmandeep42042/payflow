'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
} from '../components/customer';

import {
  userAuthenticatedRequest,
} from '../lib/api';

type SavedBiller = {
  id: string;
  billerId: string;
  category: string;
  customerRef: string;
  nickname?: string | null;
};

type BillReminder = {
  id: string;
  savedBillerId: string;
  remindAt: string;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function readableDate(
  value: string,
): string {
  const date =
    new Date(value);

  if (Number.isNaN(
    date.getTime(),
  )) {
    return value;
  }

  return date.toLocaleString();
}

function toIsoDate(
  value: string,
): string | null {
  const date =
    new Date(value);

  if (
    !value ||
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date.toISOString();
}

export default function BillReminders() {
  const [
    reminders,
    setReminders,
  ] = useState<BillReminder[] | null>(
    null,
  );

  const [
    savedBillers,
    setSavedBillers,
  ] = useState<SavedBiller[] | null>(
    null,
  );

  const [
    error,
    setError,
  ] = useState('');

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    busy,
    setBusy,
  ] = useState(false);

  const load =
    useCallback(
      async () => {
        setError('');

        try {
          const [
            reminderItems,
            billerItems,
          ] = await Promise.all([
            userAuthenticatedRequest<
              BillReminder[]
            >(
              '/customer-features/bill-reminders',
            ),

            userAuthenticatedRequest<
              SavedBiller[]
            >(
              '/customer-features/saved-billers',
            ),
          ]);

          setReminders(
            reminderItems,
          );

          setSavedBillers(
            billerItems,
          );
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Unable to load reminders',
          );
        }
      },
      [],
    );

  useEffect(() => {
    void load();
  }, [load]);

  const billerById =
    useMemo(
      () =>
        new Map(
          (
            savedBillers ??
            []
          ).map(
            (item) => [
              item.id,
              item,
            ],
          ),
        ),
      [savedBillers],
    );

  async function createReminder(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      event.currentTarget;

    const data =
      new FormData(form);

    const savedBillerId =
      String(
        data.get(
          'savedBillerId',
        ) ?? '',
      ).trim();

    const localDate =
      String(
        data.get(
          'remindAt',
        ) ?? '',
      ).trim();

    const note =
      String(
        data.get(
          'note',
        ) ?? '',
      ).trim();

    const remindAt =
      toIsoDate(
        localDate,
      );

    if (!savedBillerId) {
      setMessage('');
      setError(
        'Choose a saved biller before creating a reminder.',
      );
      return;
    }

    if (!remindAt) {
      setMessage('');
      setError(
        'Choose a valid reminder date and time.',
      );
      return;
    }

    if (
      new Date(remindAt)
        .getTime() <=
      Date.now()
    ) {
      setMessage('');
      setError(
        'Reminder date must be in the future.',
      );
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await userAuthenticatedRequest(
        '/customer-features/bill-reminders',
        {
          method: 'POST',
          body: JSON.stringify({
            savedBillerId,
            remindAt,
            note:
              note ||
              undefined,
          }),
        },
      );

      setMessage(
        'Reminder saved. It will not pay the bill automatically.',
      );

      form.reset();

      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to create reminder',
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeReminder(
    reminder: BillReminder,
  ) {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      await userAuthenticatedRequest(
        `/customer-features/bill-reminders/${encodeURIComponent(
          reminder.id,
        )}`,
        {
          method: 'DELETE',
        },
      );

      setMessage(
        'Reminder removed.',
      );

      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to remove reminder',
      );
    } finally {
      setBusy(false);
    }
  }

  const loading =
    reminders === null ||
    savedBillers === null;

  return (
    <section
      aria-labelledby="bill-reminders-title"
      className="mt-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2
            id="bill-reminders-title"
            className="text-lg font-bold"
          >
            Bill reminders
          </h2>

          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Reminders are planning tools only. They do not validate bills, authorize AutoPay, debit your wallet, or submit a payment.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void load()
          }
        >
          Refresh reminders
        </Button>
      </div>

      <div
        aria-live="polite"
        aria-atomic="true"
        className="mt-4"
      >
        {message ? (
          <p className="rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-900">
            {message}
          </p>
        ) : null}

        {error ? (
          <ErrorState
            message={error}
          />
        ) : null}
      </div>

      <Card className="mt-4 p-5">
        <h3 className="font-bold">
          Create reminder
        </h3>

        <p className="mt-2 text-sm text-slate-600">
          Save a date for one of your saved biller references. You must still validate and confirm the bill separately when you choose to pay.
        </p>

        <form
          className="mt-4 grid gap-4 md:grid-cols-2"
          onSubmit={(event) =>
            void createReminder(
              event,
            )
          }
        >
          <label
            htmlFor="bill-reminder-biller"
            className="flex min-w-0 flex-col gap-2 text-sm font-semibold"
          >
            Saved biller

            <select
              id="bill-reminder-biller"
              name="savedBillerId"
              required
              disabled={
                busy ||
                loading ||
                (
                  savedBillers?.length ??
                  0
                ) === 0
              }
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
            >
              <option value="">
                Choose saved biller
              </option>

              {(savedBillers ?? []).map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.nickname?.trim() ||
                      item.customerRef}
                    {' — '}
                    {item.category}
                  </option>
                ),
              )}
            </select>
          </label>

          <Field
            id="bill-reminder-at"
            name="remindAt"
            label="Reminder date and time"
            type="datetime-local"
            required
            disabled={busy}
          />

          <div className="md:col-span-2">
            <Field
              id="bill-reminder-note"
              name="note"
              label="Note (optional)"
              maxLength={160}
              disabled={busy}
              placeholder="Pay after salary"
            />
          </div>

          <div className="md:col-span-2">
            <Button
              type="submit"
              disabled={
                busy ||
                loading ||
                (
                  savedBillers?.length ??
                  0
                ) === 0
              }
            >
              {busy
                ? 'Saving...'
                : 'Save reminder'}
            </Button>
          </div>
        </form>

        {!loading &&
        savedBillers?.length === 0 ? (
          <p
            role="status"
            className="mt-4 text-sm text-slate-600"
          >
            Save a biller reference first before creating a reminder.
          </p>
        ) : null}
      </Card>

      <div className="mt-4 space-y-3">
        {loading ? (
          <LoadingState />
        ) : reminders.length === 0 ? (
          <EmptyState
            title="No bill reminders"
            description="Create a future reminder from one of your saved biller references."
          />
        ) : (
          reminders.map(
            (reminder) => {
              const biller =
                billerById.get(
                  reminder.savedBillerId,
                );

              const label =
                biller?.nickname?.trim() ||
                biller?.customerRef ||
                'Saved biller';

              return (
                <Card
                  key={reminder.id}
                  className="p-5"
                >
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold">
                        {label}
                      </h3>

                      <p className="mt-1 break-words text-sm text-slate-700">
                        Reminder: {' '}
                        <time
                          dateTime={
                            reminder.remindAt
                          }
                        >
                          {readableDate(
                            reminder.remindAt,
                          )}
                        </time>
                      </p>

                      {biller ? (
                        <p className="mt-1 break-all text-xs text-slate-500">
                          {biller.category}
                          {' · '}
                          {biller.customerRef}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">
                          Saved biller details are currently unavailable.
                        </p>
                      )}

                      {reminder.note ? (
                        <p className="mt-2 break-words text-sm text-slate-600">
                          {reminder.note}
                        </p>
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      variant="danger"
                      disabled={busy}
                      aria-label={`Delete reminder for ${label}`}
                      onClick={() =>
                        void removeReminder(
                          reminder,
                        )
                      }
                    >
                      Delete reminder
                    </Button>
                  </div>
                </Card>
              );
            },
          )
        )}
      </div>
    </section>
  );
}
