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
  getStoredUser,
  hasValidUserSession,
  userAuthenticatedRequest,
} from '../lib/api';
import { Avatar, ErrorState, LoadingState, PageContainer, PageHeader, StatusBadge } from '../components/customer';

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

  return (
    <main>
      <PageContainer className="max-w-4xl">
        <PageHeader eyebrow="Account" title="Profile and settings" description="Manage your identity, preferences and account security." actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/edit-profile"
              className="min-h-11 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              Edit Profile
            </Link>

            <Link
              href="/change-password"
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800"
            >
              Change Password
            </Link>

            <Link
              href="/notification-settings"
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800"
            >
              Notification Settings
            </Link>

          </div>
        } />

        {error ? (
          <div className="mt-6"><ErrorState message={error} /></div>
        ) : null}

        {isLoading && !user ? (
          <LoadingState label="Loading profile" />
        ) : user ? (
          <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr]">
            <aside className="rounded-2xl bg-slate-950 p-8 text-white shadow-sm">
              <Avatar name={`${user.firstName} ${user.lastName ?? ''}`} />

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

                  <StatusBadge status={user.status} />
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
      </PageContainer>
    </main>
  );
}
