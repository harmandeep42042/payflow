'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

type Session = {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
};

type SessionsPayload = {
  sessions: Session[];
  total: number;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

const apiUrl =
  process.env[
    'NEXT_PUBLIC_API_URL'
  ] ??
  'http://localhost:4000/api/v1';

function readStoredObject(
  key: string,
): Record<string, unknown> | null {
  const value =
    window.localStorage.getItem(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(
      value,
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getAccessToken():
  string | null {
  const directKeys = [
    'payflow_user_access_token',
    'payflow_user_refresh_token',
    'accessToken',
    'access_token',
    'payflow_access_token',
    'payflowAccessToken',
  ];

  for (const key of directKeys) {
    const token =
      window.localStorage.getItem(key);

    if (token?.trim()) {
      return token.trim();
    }
  }

  const objectKeys = [
    'payflow_session',
    'auth_session',
    'session',
    'payflow_auth',
    'auth',
  ];

  for (const key of objectKeys) {
    const stored =
      readStoredObject(key);

    const token =
      stored?.['accessToken'] ??
      stored?.['access_token'];

    if (
      typeof token === 'string' &&
      token.trim()
    ) {
      return token.trim();
    }

    const nestedData =
      stored?.['data'];

    if (
      nestedData &&
      typeof nestedData === 'object'
    ) {
      const nestedToken =
        (
          nestedData as
            Record<string, unknown>
        )['accessToken'];

      if (
        typeof nestedToken ===
          'string' &&
        nestedToken.trim()
      ) {
        return nestedToken.trim();
      }
    }
  }

  return null;
}

function getRefreshToken():
  string | null {
  const keys = [
    'payflow_user_refresh_token',
    'refreshToken',
    'refresh_token',
    'payflow_refresh_token',
    'payflowRefreshToken',
  ];

  for (const key of keys) {
    const token =
      window.localStorage.getItem(
        key,
      );

    if (token?.trim()) {
      return token.trim();
    }
  }

  return null;
}

function formatDate(
  value: string,
): string {
  return new Date(
    value,
  ).toLocaleString(
    'en-IN',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  );
}

function formatRelativeTime(
  value: string,
): string {
  const milliseconds =
    Date.now() -
    new Date(value).getTime();

  const minutes =
    Math.max(
      0,
      Math.floor(
        milliseconds /
        60_000,
      ),
    );

  if (minutes < 1) {
    return 'Just now';
  }

  if (minutes < 60) {
    return `${minutes} minute${
      minutes === 1
        ? ''
        : 's'
    } ago`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  if (hours < 24) {
    return `${hours} hour${
      hours === 1
        ? ''
        : 's'
    } ago`;
  }

  const days =
    Math.floor(
      hours / 24,
    );

  return `${days} day${
    days === 1
      ? ''
      : 's'
  } ago`;
}

function getDeviceIcon(
  deviceName: string | null,
): string {
  const value =
    deviceName?.toLowerCase() ??
    '';

  if (
    value.includes('iphone') ||
    value.includes('android')
  ) {
    return 'MOB';
  }

  if (value.includes('ipad')) {
    return 'TAB';
  }

  return 'PC';
}

export default function SessionsPage() {
  const router =
    useRouter();

  const [
    sessions,
    setSessions,
  ] = useState<Session[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    currentSessionId,
    setCurrentSessionId,
  ] = useState<string | null>(
    null,
  );

  const [
    processingId,
    setProcessingId,
  ] = useState<string | null>(
    null,
  );

  const [
    isLoggingOutOthers,
    setIsLoggingOutOthers,
  ] = useState(false);

  const [
    isLoggingOutAll,
    setIsLoggingOutAll,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const loadSessions =
    useCallback(
      async (): Promise<void> => {
        const accessToken =
          getAccessToken();

        if (!accessToken) {
          router.replace('/login');
          return;
        }

        try {
          setIsLoading(true);
          setError('');

          const response =
            await fetch(
              `${apiUrl}/auth/sessions`,
              {
                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,
                },
              },
            );

          const body =
            await response.json() as
              | SessionsPayload
              | ApiEnvelope<
                  SessionsPayload
                >;

          if (!response.ok) {
            throw new Error(
              'message' in body &&
              typeof body.message ===
                'string'
                ? body.message
                : 'Unable to load sessions',
            );
          }

          const payload =
            'data' in body &&
            body.data
              ? body.data
              : body as
                  SessionsPayload;

          setSessions(
            payload.sessions ?? [],
          );

          const refreshToken =
            getRefreshToken();

          if (refreshToken) {
            try {
              const currentResponse =
                await fetch(
                  `${apiUrl}/auth/sessions/current`,
                  {
                    method:
                      'POST',

                    headers: {
                      'Content-Type':
                        'application/json',

                      Authorization:
                        `Bearer ${accessToken}`,
                    },

                    body:
                      JSON.stringify({
                        refreshToken,
                      }),
                  },
                );

              const currentBody =
                await currentResponse.json() as
                  | {
                      sessionId?: string;
                    }
                  | ApiEnvelope<{
                      sessionId: string;
                    }>;

              if (currentResponse.ok) {
                const currentPayload =
                  'data' in currentBody &&
                  currentBody.data
                    ? currentBody.data
                    : currentBody as {
                        sessionId?: string;
                      };

                setCurrentSessionId(
                  currentPayload
                    .sessionId ??
                  null,
                );
              }
            } catch {
              setCurrentSessionId(
                null,
              );
            }
          }
        } catch (requestError) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load sessions',
          );
        } finally {
          setIsLoading(false);
        }
      },
      [
        router,
      ],
    );

  useEffect(() => {
    void loadSessions();
  }, [
    loadSessions,
  ]);

  async function revokeSession(
    sessionId: string,
  ): Promise<void> {
    const accessToken =
      getAccessToken();

    if (!accessToken) {
      router.replace('/login');
      return;
    }

    try {
      setProcessingId(
        sessionId,
      );

      setError('');

      const response =
        await fetch(
          `${apiUrl}/auth/sessions/${sessionId}`,
          {
            method:
              'DELETE',

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
        );

      const body =
        await response.json() as {
          message?: string;
        };

      if (!response.ok) {
        throw new Error(
          body.message ??
          'Unable to logout session',
        );
      }

      setSessions(
        (current) =>
          current.filter(
            (session) =>
              session.id !==
              sessionId,
          ),
      );

      if (
        sessionId ===
        currentSessionId
      ) {
        window.localStorage.removeItem(
          'payflow_user_access_token',
        );

        window.localStorage.removeItem(
          'payflow_user_refresh_token',
        );

        window.localStorage.removeItem(
          'payflow_user_profile',
        );

        router.replace('/login');
        router.refresh();
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to logout session',
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function logoutOtherSessions():
    Promise<void> {
    const accessToken =
      getAccessToken();

    const refreshToken =
      getRefreshToken();

    if (
      !accessToken ||
      !refreshToken
    ) {
      router.replace('/login');
      return;
    }

    const confirmed =
      window.confirm(
        'Logout from all other devices while keeping this device signed in?',
      );

    if (!confirmed) {
      return;
    }

    try {
      setIsLoggingOutOthers(true);
      setError('');

      const response =
        await fetch(
          `${apiUrl}/auth/sessions/logout-others`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${accessToken}`,
            },

            body:
              JSON.stringify({
                refreshToken,
              }),
          },
        );

      const body =
        await response.json() as
          | {
              message?: string;
              currentSessionId?: string;
              revokedCount?: number;
            }
          | ApiEnvelope<{
              message?: string;
              currentSessionId?: string;
              revokedCount?: number;
            }>;

      if (!response.ok) {
        throw new Error(
          'message' in body &&
          typeof body.message ===
            'string'
            ? body.message
            : 'Unable to logout other devices',
        );
      }

      const payload =
        'data' in body &&
        body.data
          ? body.data
          : body as {
              currentSessionId?: string;
            };

      const activeSessionId =
        payload.currentSessionId ??
        currentSessionId;

      if (activeSessionId) {
        setCurrentSessionId(
          activeSessionId,
        );

        setSessions(
          (current) =>
            current.filter(
              (session) =>
                session.id ===
                activeSessionId,
            ),
        );
      }
      else {
        await loadSessions();
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to logout other devices',
      );
    } finally {
      setIsLoggingOutOthers(false);
    }
  }

  async function logoutAllSessions():
    Promise<void> {
    const accessToken =
      getAccessToken();

    if (!accessToken) {
      router.replace('/login');
      return;
    }

    const confirmed =
      window.confirm(
        'Logout from all active devices?',
      );

    if (!confirmed) {
      return;
    }

    try {
      setIsLoggingOutAll(true);
      setError('');

      const response =
        await fetch(
          `${apiUrl}/auth/sessions`,
          {
            method:
              'DELETE',

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
        );

      const body =
        await response.json() as {
          message?: string;
        };

      if (!response.ok) {
        throw new Error(
          body.message ??
          'Unable to logout all sessions',
        );
      }

      window.localStorage.clear();

      router.replace('/login');
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to logout all sessions',
      );
    } finally {
      setIsLoggingOutAll(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-sky-600">
              Payflow
            </h1>

            <p className="text-sm text-slate-500">
              Active devices and sessions
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push('/dashboard')
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Dashboard
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
            Security
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            Active sessions
          </h2>

          <p className="mt-2 max-w-2xl text-slate-600">
            Review devices currently signed into your Payflow account and remove access you do not recognise.
          </p>
        </section>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Signed-in devices
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {sessions.length} active session
                {sessions.length === 1
                  ? ''
                  : 's'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  void loadSessions()
                }
                disabled={isLoading}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 disabled:opacity-50"
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={() =>
                  void logoutAllSessions()
                }
                disabled={
                  isLoggingOutAll ||
                  sessions.length === 0
                }
                className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {isLoggingOutAll
                  ? 'Logging out...'
                  : 'Logout all devices'}
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="px-6 py-16 text-center font-semibold text-slate-500">
              Loading active sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-6 py-16 text-center text-slate-500">
              No active sessions found.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.map(
                (
                  session,
                  index,
                ) => (
                  <article
                    key={session.id}
                    className="flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-center"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-xs font-bold text-sky-700">
                      {getDeviceIcon(
                        session.deviceName,
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h4 className="font-bold text-slate-900">
                          {session.deviceName ??
                            'Unknown device'}
                        </h4>

                        {session.id ===
                        currentSessionId ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                            Current device
                          </span>
                        ) : index === 0 ? (
                          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
                            Recently active
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 break-all text-sm text-slate-500">
                        IP: {session.ipAddress ??
                          'Unavailable'}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Last active:{' '}
                        {formatRelativeTime(
                          session.lastUsedAt,
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Signed in:{' '}
                        {formatDate(
                          session.createdAt,
                        )}
                      </p>

                      {session.userAgent ? (
                        <p className="mt-2 line-clamp-2 break-all text-xs text-slate-400">
                          {session.userAgent}
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void revokeSession(
                          session.id,
                        )
                      }
                      disabled={
                        processingId ===
                        session.id
                      }
                      className="rounded-xl border border-red-300 bg-white px-4 py-2 font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {processingId ===
                      session.id
                        ? 'Logging out...'
                        : session.id ===
                            currentSessionId
                          ? 'Logout this device'
                          : 'Logout device'}
                    </button>
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h3 className="font-bold text-amber-900">
            Do not recognise a device?
          </h3>

          <p className="mt-2 text-sm leading-6 text-amber-800">
            Logout that device immediately and change your Payflow password.
          </p>
        </section>
      </div>
    </main>
  );
}
