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

import type {
  PayflowUser,
} from '@payflow/shared-types';

import {
  getStoredUser,
  hasValidUserSession,
  userAuthenticatedRequest,
} from '../lib/api';

type UpdateProfileResponse = {
  message: string;
  user: PayflowUser & {
    createdAt?: string;
    updatedAt?: string;
  };
};

export default function EditProfilePage() {
  const router = useRouter();

  const [firstName, setFirstName] =
    useState('');

  const [lastName, setLastName] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  useEffect(() => {
    const user =
      getStoredUser();

    if (
      !user ||
      !hasValidUserSession()
    ) {
      router.replace('/login');
      return;
    }

    setFirstName(
      user.firstName ?? '',
    );

    setLastName(
      user.lastName ?? '',
    );

    setPhone(
      user.phone ?? '',
    );

    setEmail(
      user.email,
    );
  }, [router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');

      const response =
        await userAuthenticatedRequest<UpdateProfileResponse>(
          '/auth/profile/update',
          {
            method: 'POST',

            body: JSON.stringify({
              firstName:
                firstName.trim(),

              lastName:
                lastName.trim(),

              phone:
                phone.trim(),
            }),
          },
        );

      localStorage.setItem(
        'payflow_user_profile',
        JSON.stringify(
          response.user,
        ),
      );

      setSuccess(
        response.message,
      );

      setTimeout(() => {
        router.replace('/profile');
        router.refresh();
      }, 1500);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update profile',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-sky-600">
            Edit Profile
          </h1>

          <p className="mt-2 text-slate-500">
            Update your Payflow account information.
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
              htmlFor="firstName"
              className="text-sm font-semibold text-slate-700"
            >
              First Name
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
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div>
            <label
              htmlFor="lastName"
              className="text-sm font-semibold text-slate-700"
            >
              Last Name
            </label>

            <input
              id="lastName"
              type="text"
              minLength={2}
              maxLength={50}
              value={lastName}
              onChange={(event) =>
                setLastName(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="text-sm font-semibold text-slate-700"
            >
              Phone Number
            </label>

            <input
              id="phone"
              type="tel"
              required
              pattern="[0-9]{10}"
              maxLength={10}
              value={phone}
              onChange={(event) =>
                setPhone(
                  event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 10),
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />

            <p className="mt-2 text-xs text-slate-500">
              Enter exactly 10 digits.
            </p>
          </div>

          <div>
            <label
              htmlFor="email"
              className="text-sm font-semibold text-slate-700"
            >
              Email Address
            </label>

            <input
              id="email"
              type="email"
              disabled
              value={email}
              className="mt-2 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500"
            />

            <p className="mt-2 text-xs text-slate-500">
              Email cannot be changed from this page.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-sky-500 px-5 py-3 font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? 'Saving Changes...'
              : 'Save Changes'}
          </button>
        </form>

        <Link
          href="/profile"
          className="mt-6 block text-center text-sm font-semibold text-sky-600"
        >
          Back to Profile
        </Link>
      </section>
    </main>
  );
}