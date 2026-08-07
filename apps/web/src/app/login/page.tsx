'use client';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  hasValidUserSession,
  saveUserSession,
  userApiRequest,
  UserLoginResponse,
} from '../lib/api';

export default function UserLoginPage() {
  const router = useRouter();

  const [email, setEmail] =
    useState(
      'harman2701@payflow.com',
    );

  const [password, setPassword] =
    useState('User@123');

  const [error, setError] =
    useState('');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  useEffect(() => {
    if (hasValidUserSession()) {
      router.replace('/dashboard');
    }
  }, [router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError('');

      const response =
        await userApiRequest<UserLoginResponse>(
          '/auth/login',
          {
            method: 'POST',

            body: JSON.stringify({
              email,
              password,
            }),
          },
        );

      saveUserSession(response);

      router.push('/dashboard');
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Login failed',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-sky-600">
            Payflow
          </h1>

          <p className="mt-2 text-slate-500">
            Sign in to your wallet
          </p>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5"
        >
          <div>
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
                setEmail(event.target.value)
              }
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="text-sm font-semibold text-slate-700"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="text-right">
            <a
              href="/forgot-password"
              className="text-sm font-semibold text-sky-600 hover:text-sky-700"
            >
              Forgot Password?
            </a>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-sky-500 px-5 py-3 font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? 'Signing in...'
              : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          User portal for wallet payments
        </p>
      </section>
    </main>
  );
}