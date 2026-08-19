'use client';

import {
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';

import {
  API_GATEWAY_URL,
  getUserAccessToken,
} from '../lib/api';

type NotificationPreferences = {
  id: string;
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  transfersEnabled: boolean;
  depositsEnabled: boolean;
  withdrawalsEnabled: boolean;
  paymentsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type PreferenceKey =
  | 'inAppEnabled'
  | 'emailEnabled'
  | 'transfersEnabled'
  | 'depositsEnabled'
  | 'withdrawalsEnabled'
  | 'paymentsEnabled';

type PreferenceItem = {
  key: PreferenceKey;
  title: string;
  description: string;
};

const notificationApiUrl =
  API_GATEWAY_URL;

const channelItems:
  PreferenceItem[] = [
    {
      key: 'inAppEnabled',
      title:
        'In-app notifications',
      description:
        'Show real-time notifications inside your Payflow dashboard.',
    },
    {
      key: 'emailEnabled',
      title:
        'Email notifications',
      description:
        'Receive supported Payflow notification updates through email.',
    },
  ];

const activityItems:
  PreferenceItem[] = [
    {
      key: 'depositsEnabled',
      title: 'Deposits',
      description:
        'Get notified when money is added to your wallet.',
    },
    {
      key: 'transfersEnabled',
      title: 'Transfers',
      description:
        'Get notified when money is sent or received.',
    },
    {
      key: 'withdrawalsEnabled',
      title: 'Withdrawals',
      description:
        'Get notified when money is withdrawn from your wallet.',
    },
    {
      key: 'paymentsEnabled',
      title: 'Payments',
      description:
        'Receive updates about completed Payflow payments.',
    },
  ];

function findUserId():
  string | null {
  if (
    typeof window ===
    'undefined'
  ) {
    return null;
  }

  const keys = [
    'payflow_user_profile',
    'payflow_user',
    'payflowUser',
    'auth_user',
    'authUser',
    'user',
  ];

  for (const key of keys) {
    const value =
      window.localStorage
        .getItem(key);

    if (!value) {
      continue;
    }

    try {
      const parsed =
        JSON.parse(
          value,
        ) as Record<
          string,
          unknown
        >;

      const id =
        parsed['id'] ??
        parsed['userId'];

      if (
        typeof id ===
          'string' &&
        id.trim()
      ) {
        return id.trim();
      }
    } catch {
      // Ignore invalid storage.
    }
  }

  return null;
}

function Toggle({
  enabled,
  saving,
  label,
  onToggle,
}: {
  enabled: boolean;
  saving: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={saving}
      aria-label={label}
      aria-pressed={enabled}
      onClick={onToggle}
      className={`relative h-8 w-14 shrink-0 rounded-full transition ${
        enabled
          ? 'bg-sky-600'
          : 'bg-slate-300'
      } ${
        saving
          ? 'cursor-wait opacity-60'
          : 'hover:opacity-90'
      }`}
    >
      <span
        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
          enabled
            ? 'left-7'
            : 'left-1'
        }`}
      />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const [
    preferences,
    setPreferences,
  ] = useState<
    NotificationPreferences | null
  >(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    savingKey,
    setSavingKey,
  ] = useState<
    PreferenceKey | null
  >(null);

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    error,
    setError,
  ] = useState('');

  useEffect(() => {
    const userId =
      findUserId();

    if (!userId) {
      setError(
        'Unable to identify the signed-in user.',
      );

      setIsLoading(false);

      return;
    }

    let cancelled =
      false;

    async function loadPreferences():
      Promise<void> {
      try {
        const accessToken =
          getUserAccessToken();

        if (!accessToken) {
          throw new Error(
            'Authentication is required.',
          );
        }

        const response =
          await fetch(
            notificationApiUrl +
              '/notification-preferences',
            {
              method: 'GET',
              cache:
                'no-store',

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
            },
          );

        if (!response.ok) {
          throw new Error(
            'Unable to load notification settings.',
          );
        }

        const body =
          await response
            .json() as
              NotificationPreferences;

        if (!cancelled) {
          setPreferences(
            body,
          );
        }
      } catch (
        requestError
      ) {
        if (!cancelled) {
          setError(
            requestError instanceof
              Error
              ? requestError.message
              : 'Unable to load notification settings.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(
            false,
          );
        }
      }
    }

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, []);

  async function updatePreference(
    key: PreferenceKey,
    value: boolean,
  ): Promise<void> {
    const userId =
      findUserId();

    if (
      !userId ||
      !preferences
    ) {
      return;
    }

    const previous =
      preferences;

    setMessage('');
    setError('');
    setSavingKey(key);

    setPreferences({
      ...preferences,
      [key]: value,
    });

    try {
      const accessToken =
        getUserAccessToken();

      if (!accessToken) {
        throw new Error(
          'Authentication is required.',
        );
      }

      const response =
        await fetch(
          notificationApiUrl +
            '/notification-preferences',
          {
            method: 'PATCH',

            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${accessToken}`,
            },

            body:
              JSON.stringify({
                [key]: value,
              }),
          },
        );

      if (!response.ok) {
        throw new Error(
          'Unable to save notification setting.',
        );
      }

      const updated =
        await response
          .json() as
            NotificationPreferences;

      setPreferences(
        updated,
      );

      setMessage(
        'Your notification preferences have been saved.',
      );
    } catch (
      requestError
    ) {
      setPreferences(
        previous,
      );

      setError(
        requestError instanceof
          Error
          ? requestError.message
          : 'Unable to save notification setting.',
      );
    } finally {
      setSavingKey(null);
    }
  }

  function renderItems(
    items:
      PreferenceItem[],
  ) {
    if (!preferences) {
      return null;
    }

    return items.map(
      (item) => {
        const enabled =
          preferences[
            item.key
          ];

        const saving =
          savingKey ===
          item.key;

        return (
          <div
            key={item.key}
            className="flex flex-col gap-5 border-b border-slate-100 px-6 py-6 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-bold text-slate-950">
                  {item.title}
                </h3>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    enabled
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {enabled
                    ? 'Enabled'
                    : 'Disabled'}
                </span>

                {saving ? (
                  <span className="text-xs font-semibold text-sky-600">
                    Saving...
                  </span>
                ) : null}
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {item.description}
              </p>
            </div>

            <Toggle
              enabled={enabled}
              saving={saving}
              label={`Toggle ${item.title}`}
              onToggle={() =>
                void updatePreference(
                  item.key,
                  !enabled,
                )
              }
            />
          </div>
        );
      },
    );
  }

  const enabledCount =
    preferences
      ? [
          preferences
            .inAppEnabled,
          preferences
            .emailEnabled,
          preferences
            .transfersEnabled,
          preferences
            .depositsEnabled,
          preferences
            .withdrawalsEnabled,
          preferences
            .paymentsEnabled,
        ].filter(Boolean)
          .length
      : 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
        <section className="rounded-3xl bg-gradient-to-br from-sky-500 to-blue-700 p-7 text-white shadow-xl sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-sky-100">
                Payflow preferences
              </p>

              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                Notification settings
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-100 sm:text-base">
                Control how Payflow keeps you informed about wallet activity and payments.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex w-fit items-center justify-center rounded-xl bg-white px-5 py-3 font-bold text-sky-700 transition hover:bg-sky-50"
            >
              Back to dashboard
            </Link>
          </div>
        </section>

        {isLoading ? (
          <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="font-semibold text-slate-600">
              Loading your notification preferences...
            </p>
          </section>
        ) : error &&
          !preferences ? (
          <section className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </section>
        ) : preferences ? (
          <>
            <section className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">
                  Enabled preferences
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-950">
                  {enabledCount}/6
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">
                  Last updated
                </p>

                <p className="mt-2 font-bold text-slate-950">
                  {new Date(
                    preferences.updatedAt,
                  ).toLocaleString(
                    'en-IN',
                  )}
                </p>
              </div>
            </section>

            {message ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
                ✓ {message}
              </div>
            ) : null}

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                <p className="text-sm font-bold uppercase tracking-wider text-sky-600">
                  Delivery channels
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  How should we notify you?
                </h2>
              </div>

              {renderItems(
                channelItems,
              )}
            </section>

            <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                <p className="text-sm font-bold uppercase tracking-wider text-sky-600">
                  Activity alerts
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Choose the events you care about
                </h2>
              </div>

              {renderItems(
                activityItems,
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
