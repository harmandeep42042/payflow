'use client';

import {
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';

import {
  useRouter,
} from 'next/navigation';

import type {
  PayflowUser,
} from '@payflow/shared-types';

import {
  logoutUser,
  getStoredUser,
  hasValidUserSession,
  userAuthenticatedRequest,
} from '../lib/api';

type ProfileApiResponse = {
  message?: string;
  user?: {
    id: string;
    email: string;
    role: PayflowUser['role'];
  };
};

type ProfileResponse = PayflowUser & {
  createdAt?: string;
};

function getInitials(
  user: PayflowUser,
): string {
  const first =
    user.firstName?.charAt(0) ?? '';

  const last =
    user.lastName?.charAt(0) ?? '';

  return `${first}${last}`
    .toUpperCase() || 'U';
}

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] =
    useState<ProfileResponse | null>(
      null,
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  useEffect(() => {
    async function loadProfile():
      Promise<void> {
      const storedUser =
        getStoredUser();

      if (
        !storedUser ||
        !hasValidUserSession()
      ) {
        router.replace('/login');
        return;
      }

      setUser(storedUser);

      try {
        setIsLoading(true);
        setError('');

        const profileResponse =
          await userAuthenticatedRequest<ProfileApiResponse>(
            '/auth/profile',
          );

        const apiUser =
          profileResponse.user;

        if (!apiUser?.id) {
          throw new Error(
            'Profile user data was missing',
          );
        }

        setUser({
          ...storedUser,
          id: apiUser.id,
          email: apiUser.email,
          role: apiUser.role,
        });
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load profile',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [router]);

  async function handleLogout():
    Promise<void> {
    await logoutUser();

    router.replace('/login');
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <section className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              My Profile
            </h1>

            <p className="mt-2 text-slate-500">
              View your Payflow account information.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
            >
              Dashboard
            </Link>

            <Link
              href="/edit-profile"
              className="rounded-xl bg-sky-500 px-4 py-2 font-semibold text-white transition hover:bg-sky-600"
            >
              Edit Profile
            </Link>

            <Link
              href="/change-password"
              className="rounded-xl bg-violet-500 px-4 py-2 font-semibold text-white transition hover:bg-violet-600"
            >
              Change Password
            </Link>

            <Link
              href="/notification-settings"
              className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-white transition hover:bg-emerald-600"
            >
              Notification Settings
            </Link>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white"
            >
              Logout
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        ) : null}

        {isLoading && !user ? (
          <div className="rounded-3xl bg-white p-12 text-center font-semibold text-slate-500 shadow-sm">
            Loading profile...
          </div>
        ) : user ? (
          <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr]">
            <aside className="rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-700 p-8 text-white shadow-lg">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-3xl font-bold">
                {getInitials(user)}
              </div>

              <h2 className="mt-6 text-2xl font-bold">
                {`${user.firstName} ${
                  user.lastName ?? ''
                }`.trim()}
              </h2>

              <p className="mt-2 text-violet-100">
                {user.email}
              </p>

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>
                    Role
                  </span>

                  <strong>
                    {user.role}
                  </strong>
                </div>

                <div className="flex items-center justify-between">
                  <span>
                    Status
                  </span>

                  <strong>
                    {user.status}
                  </strong>
                </div>
              </div>
            </aside>

            <section className="rounded-3xl bg-white p-8 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900">
                Account Details
              </h3>

              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Full Name
                  </p>

                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {`${user.firstName} ${
                      user.lastName ?? ''
                    }`.trim()}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Email Address
                  </p>

                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {user.email}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Phone Number
                  </p>

                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {user.phone ??
                      'Not provided'}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    User ID
                  </p>

                  <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-800">
                    {user.id}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Account Status
                  </p>

                  <p className="mt-2 text-lg font-bold text-emerald-600">
                    {user.status}
                  </p>
                </div>

                {user.createdAt ? (
                  <div className="border-t border-slate-100 pt-5">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Member Since
                    </p>

                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {new Date(
                        user.createdAt,
                      ).toLocaleString(
                        'en-IN',
                      )}
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
