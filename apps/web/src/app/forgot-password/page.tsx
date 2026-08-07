'use client';

import {
  FormEvent,
  useState,
} from 'react';

import Link from 'next/link';

import {
  useRouter,
} from 'next/navigation';

import {
  userApiRequest,
} from '../lib/api';

type ForgotPasswordResponse = {
  message: string;
  developmentResetToken?: string;
  expiresInSeconds?: number;
};

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] =
    useState(
      'harman2701@payflow.com',
    );

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [resetToken, setResetToken] =
    useState('');

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');
      setResetToken('');

      const response =
        await userApiRequest<ForgotPasswordResponse>(
          '/auth/password/forgot',
          {
            method: 'POST',

            body: JSON.stringify({
              email:
                email.trim(),
            }),
          },
        );

      setSuccess(
        response.message,
      );

      if (
        response.developmentResetToken
      ) {
        setResetToken(
          response.developmentResetToken,
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to process password reset request',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function continueToReset(): void {
    const query =
      resetToken
        ? `?token=${encodeURIComponent(
            resetToken,
          )}`
        : '';

    router.push(
      `/reset-password${query}`,
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-sky-600">
            Forgot Password
          </h1>

          <p className="mt-2 text-slate-500">
            Enter your registered email address.
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
          className="mt-8"
        >
          <label
            htmlFor="email"
            className="text-sm font-semibold text-slate-700"
          >
            Email address
          </label>

          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value,
              )
            }
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-xl bg-sky-500 px-5 py-3 font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? 'Processing...'
              : 'Send Reset Instructions'}
          </button>
        </form>

        {resetToken ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">
              Development reset token generated
            </p>

            <p className="mt-2 break-all font-mono text-xs text-amber-700">
              {resetToken}
            </p>

            <button
              type="button"
              onClick={continueToReset}
              className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-3 font-bold text-white"
            >
              Continue to Reset Password
            </button>
          </div>
        ) : null}

        <Link
          href="/login"
          className="mt-6 block text-center text-sm font-semibold text-sky-600"
        >
          Back to Login
        </Link>
      </section>
    </main>
  );
}