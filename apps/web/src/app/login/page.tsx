'use client';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  apiRequest,
  getAccessToken,
  LoginResponse,
  saveAuthSession,
} from '../lib/api';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState(
    'admin@payflow.com',
  );

  const [password, setPassword] = useState(
    'Admin@123',
  );

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] =
    useState(false);

  useEffect(() => {
    const token = getAccessToken();

    if (token) {
      router.replace('/dashboard');
    }
  }, [router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setError('');
    setIsLoading(true);

    try {
      const response =
        await apiRequest<LoginResponse>(
          '/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({
              email: email
                .trim()
                .toLowerCase(),
              password,
            }),
          },
        );

      saveAuthSession(response);

      router.push('/dashboard');
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to login',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-slate-50">
      <section className="hidden w-1/2 flex-col justify-between bg-slate-950 p-12 text-white lg:flex">
        <Link
          href="/"
          className="text-3xl font-bold text-sky-400"
        >
          Payflow
        </Link>

        <div>
          <p className="mb-5 inline-block rounded-full bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-300">
            Secure digital payments
          </p>

          <h1 className="max-w-xl text-5xl font-bold leading-tight">
            Your money, wallets and transactions in
            one place.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
            Payflow uses JWT authentication, secure
            API Gateway routing and enterprise wallet
            infrastructure.
          </p>
        </div>

        <p className="text-sm text-slate-400">
          (c) 2026 Payflow
        </p>
      </section>

      <section className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-10 inline-block text-2xl font-bold text-sky-600 lg:hidden"
          >
            Payflow
          </Link>

          <h2 className="text-3xl font-bold text-slate-900">
            Welcome back
          </h2>

          <p className="mt-2 text-slate-600">
            Login to access your Payflow dashboard.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
                autoComplete="email"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                placeholder="Enter your password"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-sky-500 px-5 py-3 font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading
                ? 'Signing in...'
                : 'Login'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Authentication is securely handled through
            the Payflow API Gateway.
          </p>
        </div>
      </section>
    </main>
  );
}
