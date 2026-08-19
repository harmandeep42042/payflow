
'use client';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  AdminLoginResponse,
  adminApiRequest,
  clearAdminSession,
  saveAdminSession,
} from '../lib/api';

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState(
    'admin@payflow.com',
  );

  const [password, setPassword] = useState(
    'Admin@12345',
  );

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] =
    useState(false);

  useEffect(() => {
    clearAdminSession();
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setError('');
    setIsLoading(true);

    try {
      const response =
        await adminApiRequest<AdminLoginResponse>(
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

      saveAdminSession(response);

      router.replace('/dashboard');
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
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <section className="hidden flex-col justify-between p-12 text-white lg:flex">
        <div>
          <p className="text-3xl font-bold text-sky-400">
            Payflow Admin
          </p>
        </div>

        <div>
          <span className="rounded-full bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-300">
            Secure administration
          </span>

          <h1 className="mt-6 max-w-xl text-5xl font-bold leading-tight">
            Manage users, wallets and transactions from one place.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
            Access is restricted to Payflow administrators.
          </p>
        </div>

        <p className="text-sm text-slate-500">
          Payflow Admin Portal
        </p>
      </section>

      <section className="flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md">
          <p className="text-2xl font-bold text-sky-600 lg:hidden">
            Payflow Admin
          </p>

          <h2 className="mt-8 text-3xl font-bold text-slate-900 lg:mt-0">
            Admin login
          </h2>

          <p className="mt-2 text-slate-600">
            Sign in with an administrator account.
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
                : 'Login as administrator'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Only users with the ADMIN role can continue.
          </p>
        </div>
      </section>
    </main>
  );
}
