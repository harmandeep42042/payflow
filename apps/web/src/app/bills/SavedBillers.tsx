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
  createdAt?: string;
  updatedAt?: string;
};

function elementById<T extends HTMLElement>(
  id: string,
): T | null {
  const element =
    document.getElementById(id);

  return element instanceof HTMLElement
    ? (element as T)
    : null;
}

function providerCurrentlyReturns(
  select: HTMLSelectElement,
  billerId: string,
): boolean {
  return Array.from(
    select.options,
  ).some(
    (option) =>
      option.value === billerId,
  );
}

export default function SavedBillers() {
  const [
    items,
    setItems,
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
    saving,
    setSaving,
  ] = useState(false);

  const load =
    useCallback(
      async () => {
        setError('');

        try {
          const result =
            await userAuthenticatedRequest<
              SavedBiller[]
            >(
              '/customer-features/saved-billers',
            );

          setItems(result);
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Unable to load saved billers',
          );
        }
      },
      [],
    );

  useEffect(() => {
    void load();
  }, [load]);

  async function saveCurrent(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const category =
      elementById<HTMLSelectElement>(
        'bill-category',
      );

    const biller =
      elementById<HTMLSelectElement>(
        'bill-biller',
      );

    const account =
      elementById<HTMLInputElement>(
        'bill-account',
      );

    if (
      !category ||
      !biller ||
      !account ||
      !biller.value.trim() ||
      !account.value.trim()
    ) {
      setMessage('');
      setError(
        'Choose a provider-returned biller and enter the customer/account number before saving.',
      );
      return;
    }

    if (
      !providerCurrentlyReturns(
        biller,
        biller.value,
      )
    ) {
      setMessage('');
      setError(
        'The selected biller is not currently returned by the provider.',
      );
      return;
    }

    const form =
      event.currentTarget;

    const data =
      new FormData(form);

    const nickname =
      String(
        data.get('nickname') ?? '',
      ).trim();

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await userAuthenticatedRequest(
        '/customer-features/saved-billers',
        {
          method: 'POST',
          body: JSON.stringify({
            billerId:
              biller.value.trim(),
            category:
              category.value,
            customerRef:
              account.value.trim(),
            nickname:
              nickname || undefined,
          }),
        },
      );

      setMessage(
        'Saved biller reference added. Provider validation is still required before any payment attempt.',
      );

      form.reset();

      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to save biller reference',
      );
    } finally {
      setSaving(false);
    }
  }

  function useSavedBiller(
    item: SavedBiller,
  ) {
    const category =
      elementById<HTMLSelectElement>(
        'bill-category',
      );

    const biller =
      elementById<HTMLSelectElement>(
        'bill-biller',
      );

    const account =
      elementById<HTMLInputElement>(
        'bill-account',
      );

    if (
      !category ||
      !biller ||
      !account
    ) {
      setMessage('');
      setError(
        'The provider must return billers before a saved reference can be used.',
      );
      return;
    }

    if (
      !providerCurrentlyReturns(
        biller,
        item.billerId,
      )
    ) {
      setMessage('');
      setError(
        'This saved biller is not currently returned by the provider. Refresh the provider list before using it.',
      );
      return;
    }

    category.value =
      item.category;

    biller.value =
      item.billerId;

    account.value =
      item.customerRef;

    setError('');

    setMessage(
      'Saved reference filled. Validate and review the current provider bill before submitting any payment attempt.',
    );
  }

  async function deleteSavedBiller(
    item: SavedBiller,
  ) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await userAuthenticatedRequest(
        `/customer-features/saved-billers/${encodeURIComponent(
          item.id,
        )}`,
        {
          method: 'DELETE',
        },
      );

      setMessage(
        'Saved biller reference removed.',
      );

      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to remove saved biller',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="saved-billers-title"
      className="mt-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="saved-billers-title"
            className="text-lg font-bold"
          >
            Saved billers
          </h2>

          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Saved references are convenience data only. They do not validate a bill, confirm an amount, or trigger payment.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => void load()}
        >
          Refresh saved billers
        </Button>
      </div>

      <div
        aria-live="polite"
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
          Save current provider biller
        </h3>

        <p className="mt-2 text-sm text-slate-600">
          Select a provider-returned biller in the payment form and enter the account reference first. Saving does not call bill validation or create a payment attempt.
        </p>

        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) =>
            void saveCurrent(event)
          }
        >
          <div className="min-w-0 flex-1">
            <Field
              id="saved-biller-nickname"
              name="nickname"
              label="Nickname (optional)"
              maxLength={80}
              placeholder="Home electricity"
            />
          </div>

          <Button
            type="submit"
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : 'Save current reference'}
          </Button>
        </form>
      </Card>

      <div className="mt-4 space-y-3">
        {items === null ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <EmptyState
            title="No saved billers"
            description="Choose a provider-returned biller and save its customer/account reference for future use."
          />
        ) : (
          items.map((item) => {
            const label =
              item.nickname?.trim() ||
              item.customerRef;

            return (
              <Card
                key={item.id}
                className="p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold">
                      {label}
                    </h3>

                    <p className="mt-1 break-all text-sm text-slate-600">
                      {item.category}
                      {' · '}
                      {item.customerRef}
                    </p>

                    <p className="mt-1 break-all text-xs text-slate-500">
                      Provider biller ID: {item.billerId}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label={`Use ${label}`}
                      disabled={saving}
                      onClick={() =>
                        useSavedBiller(
                          item,
                        )
                      }
                    >
                      Use
                    </Button>

                    <Button
                      type="button"
                      variant="danger"
                      aria-label={`Delete ${label}`}
                      disabled={saving}
                      onClick={() =>
                        void deleteSavedBiller(
                          item,
                        )
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}
