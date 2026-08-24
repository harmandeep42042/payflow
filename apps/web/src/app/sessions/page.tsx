'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';
import {
  clearUserSession,
  customerSessionRequest,
  userAuthenticatedRequest,
} from '../lib/api';
import { ErrorState, PageContainer, PageHeader } from '../components/customer';

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
        try {
          setIsLoading(true);
          setError('');

          const payload = await userAuthenticatedRequest<SessionsPayload>('/auth/sessions');

          setSessions(
            payload.sessions ?? [],
          );

          try {
            const currentPayload = await customerSessionRequest<{ sessionId?: string }>(
              '/sessions/current', { method: 'POST' },
            );
            setCurrentSessionId(currentPayload.sessionId ?? null);
          } catch {
            setCurrentSessionId(null);
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
    try {
      setProcessingId(
        sessionId,
      );

      setError('');

      await userAuthenticatedRequest(`/auth/sessions/${sessionId}`, { method: 'DELETE' });

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
        clearUserSession();
        await fetch('/api/customer-session/logout', { method: 'POST', credentials: 'same-origin' });

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

      const payload = await customerSessionRequest<{
        currentSessionId?: string; revokedCount?: number;
      }>('/sessions/logout-others', { method: 'POST' });

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

      await customerSessionRequest('/sessions/logout-all', { method: 'DELETE' });
      clearUserSession();

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
    <main>
      <PageContainer className="max-w-5xl">
        <PageHeader eyebrow="Security" title="Active sessions" description="Review devices currently signed into your Payflow account and remove access you do not recognise." />

        {error ? (
          <div className="mt-6"><ErrorState message={error} /></div>
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
                onClick={() => void logoutOtherSessions()}
                disabled={isLoggingOutOthers || sessions.length < 2}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 disabled:opacity-50"
              >
                {isLoggingOutOthers ? 'Logging out...' : 'Logout other devices'}
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
      </PageContainer>
    </main>
  );
}
