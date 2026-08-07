'use client';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';

import {
  useRouter,
} from 'next/navigation';

import {
  clearUserSession,
  hasValidUserSession,
  userAuthenticatedRequest,
} from '../lib/api';

type ChangePasswordResponse = {
  message: string;
};

export default function ChangePasswordPage() {
  const router = useRouter();

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState('');

  const [
    newPassword,
    setNewPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  useEffect(() => {
    if (!hasValidUserSession()) {
      router.replace('/login');
    }
  }, [router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (
      newPassword !==
      confirmPassword
    ) {
      setError(
        'New password and confirm password do not match',
      );
      return;
    }

    if (
      currentPassword ===
      newPassword
    ) {
      setError(
        'New password must be different from the current password',
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');

      const response =
        await userAuthenticatedRequest<ChangePasswordResponse>(
          '/auth/change-password',
          {
            method: 'POST',

            body: JSON.stringify({
              currentPassword,
              newPassword,
            }),
          },
        );

      setSuccess(
        response.message,
      );

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        clearUserSession();
        router.replace(
          '/login?passwordChanged=true',
        );
        router.refresh();
      }, 2000);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to change password',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-violet-600">
            Change Password
          </h1>

          <p className="mt-2 text-slate-500">
            Update your Payflow account password.
          </p>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {success}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5"
        >
          <div>
            <label
              htmlFor="currentPassword"
              className="text-sm font-semibold text-slate-700"
            >
              Current Password
            </label>

            <input
              id="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={(event) =>
                setCurrentPassword(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="text-sm font-semibold text-slate-700"
            >
              New Password
            </label>

            <input
              id="newPassword"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(event) =>
                setNewPassword(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="text-sm font-semibold text-slate-700"
            >
              Confirm New Password
            </label>

            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Password must contain at least 8 characters, one uppercase letter, one lowercase letter and one number.
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-violet-500 px-5 py-3 font-bold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? 'Changing Password...'
              : 'Change Password'}
          </button>
        </form>

        <Link
          href="/profile"
          className="mt-6 block text-center text-sm font-semibold text-violet-600"
        >
          Back to Profile
        </Link>
      </section>
    </main>
  );
}