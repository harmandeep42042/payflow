'use client';

import {
  FormEvent,
  Suspense,
  useState,
} from 'react';

import Link from 'next/link';

import {
  useRouter,
  useSearchParams,
} from 'next/navigation';

import {
  userApiRequest,
} from '../lib/api';

type ResetPasswordResponse = {
  message: string;
};

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const [token, setToken] =
    useState(
      searchParams.get('token') ??
        '',
    );

  const [
    newPassword,
    setNewPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (
      newPassword !==
      confirmPassword
    ) {
      setError(
        'Passwords do not match',
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');

      const response =
        await userApiRequest<ResetPasswordResponse>(
          '/auth/password/reset',
          {
            method: 'POST',

            body: JSON.stringify({
              token:
                token.trim(),

              newPassword,
            }),
          },
        );

      setSuccess(
        response.message,
      );

      setTimeout(() => {
        router.replace('/login');
      }, 2000);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to reset password',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-violet-600">
          Reset Password
        </h1>

        <p className="mt-2 text-slate-500">
          Create a new secure password.
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
            htmlFor="token"
            className="text-sm font-semibold text-slate-700"
          >
            Reset Token
          </label>

          <textarea
            id="token"
            rows={4}
            required
            value={token}
            onChange={(event) =>
              setToken(
                event.target.value,
              )
            }
            className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
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
            Confirm Password
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
            ? 'Resetting...'
            : 'Reset Password'}
        </button>
      </form>

      <Link
        href="/login"
        className="mt-6 block text-center text-sm font-semibold text-violet-600"
      >
        Back to Login
      </Link>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <Suspense
        fallback={
          <div className="font-semibold text-slate-500">
            Loading reset form...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}