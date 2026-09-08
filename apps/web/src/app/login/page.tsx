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
  loginUser,
  registerMobileUser,
  requestMobileOtp,
  restoreUserSession,
  verifyMobileOtp,
} from '../lib/api';

type LoginMode =
  | 'email'
  | 'mobile';

type MobileStep =
  | 'phone'
  | 'otp'
  | 'register';

export default function UserLoginPage() {
  const router = useRouter();

  const [mode, setMode] =
    useState<LoginMode>('email');

  const [mobileStep, setMobileStep] =
    useState<MobileStep>('phone');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [otp, setOtp] =
    useState('');

  const [registrationToken, setRegistrationToken] =
    useState('');

  const [firstName, setFirstName] =
    useState('');

  const [lastName, setLastName] =
    useState('');

  const [registrationEmail, setRegistrationEmail] =
    useState('');

  const [registrationPassword, setRegistrationPassword] =
    useState('');

  const [error, setError] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  useEffect(() => {
    void restoreUserSession()
      .then(() =>
        router.replace('/dashboard'),
      )
      .catch(() => undefined);
  }, [router]);

  function finishLogin(): void {
    router.push('/dashboard');
    router.refresh();
  }

  function switchMode(
    nextMode: LoginMode,
  ): void {
    setMode(nextMode);
    setError('');
    setMessage('');
  }

  async function handleEmailLogin(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError('');
      setMessage('');

      await loginUser(
        email,
        password,
      );

      finishLogin();
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

  async function handleRequestOtp(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError('');
      setMessage('');

      await requestMobileOtp(phone);

      setMobileStep('otp');
      setMessage(
        'Verification code sent successfully.',
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to send verification code',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError('');
      setMessage('');

      const result =
        await verifyMobileOtp(
          phone,
          otp,
        );

      if (result.registrationRequired) {
        setRegistrationToken(
          result.registrationToken,
        );

        setMobileStep('register');

        setMessage(
          'Mobile number verified. Complete your account.',
        );

        return;
      }

      finishLogin();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Verification failed',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegistration(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError('');
      setMessage('');

      await registerMobileUser(
        registrationToken,
        firstName,
        lastName,
        registrationEmail,
        registrationPassword,
      );

      finishLogin();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to create account',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-sky-600">
            Payflow
          </h1>

          <p className="mt-2 text-slate-500">
            Sign in to your wallet
          </p>
        </div>

        <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() =>
              switchMode('email')
            }
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === 'email'
                ? 'bg-white text-sky-600 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Email
          </button>

          <button
            type="button"
            onClick={() =>
              switchMode('mobile')
            }
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === 'mobile'
                ? 'bg-white text-sky-600 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Mobile OTP
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        ) : null}

        {mode === 'email' ? (
          <form
            onSubmit={handleEmailLogin}
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
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
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
                autoComplete="current-password"
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
        ) : null}

        {mode === 'mobile' &&
        mobileStep === 'phone' ? (
          <form
            onSubmit={handleRequestOtp}
            className="mt-8 space-y-5"
          >
            <div>
              <label
                htmlFor="phone"
                className="text-sm font-semibold text-slate-700"
              >
                Mobile number
              </label>

              <input
                id="phone"
                type="tel"
                required
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(event) =>
                  setPhone(
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-sky-500 px-5 py-3 font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? 'Sending OTP...'
                : 'Send OTP'}
            </button>
          </form>
        ) : null}

        {mode === 'mobile' &&
        mobileStep === 'otp' ? (
          <form
            onSubmit={handleVerifyOtp}
            className="mt-8 space-y-5"
          >
            <div>
              <label
                htmlFor="otp"
                className="text-sm font-semibold text-slate-700"
              >
                Verification code
              </label>

              <input
                id="otp"
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(event) =>
                  setOtp(
                    event.target.value
                      .replace(/\D/g, '')
                      .slice(0, 6),
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-xl font-semibold tracking-[0.35em] text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                otp.length !== 6
              }
              className="w-full rounded-xl bg-sky-500 px-5 py-3 font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? 'Verifying...'
                : 'Verify & Sign in'}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setOtp('');
                setError('');
                setMessage('');
                setMobileStep('phone');
              }}
              className="w-full text-sm font-semibold text-sky-600 hover:text-sky-700"
            >
              Change mobile number
            </button>
          </form>
        ) : null}

        {mode === 'mobile' &&
        mobileStep === 'register' ? (
          <form
            onSubmit={handleRegistration}
            className="mt-8 space-y-4"
          >
            <div>
              <label
                htmlFor="firstName"
                className="text-sm font-semibold text-slate-700"
              >
                First name
              </label>

              <input
                id="firstName"
                type="text"
                required
                minLength={2}
                maxLength={50}
                value={firstName}
                onChange={(event) =>
                  setFirstName(
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="text-sm font-semibold text-slate-700"
              >
                Last name
              </label>

              <input
                id="lastName"
                type="text"
                maxLength={50}
                value={lastName}
                onChange={(event) =>
                  setLastName(
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label
                htmlFor="registrationEmail"
                className="text-sm font-semibold text-slate-700"
              >
                Email address
              </label>

              <input
                id="registrationEmail"
                type="email"
                required
                autoComplete="email"
                value={registrationEmail}
                onChange={(event) =>
                  setRegistrationEmail(
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label
                htmlFor="registrationPassword"
                className="text-sm font-semibold text-slate-700"
              >
                Create password
              </label>

              <input
                id="registrationPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={registrationPassword}
                onChange={(event) =>
                  setRegistrationPassword(
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />

              <p className="mt-2 text-xs text-slate-500">
                Minimum 8 characters with uppercase, lowercase and a number.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-sky-500 px-5 py-3 font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? 'Creating account...'
                : 'Create account'}
            </button>
          </form>
        ) : null}

        <p className="mt-6 text-center text-sm text-slate-500">
          User portal for wallet payments
        </p>
      </section>
    </main>
  );
}
