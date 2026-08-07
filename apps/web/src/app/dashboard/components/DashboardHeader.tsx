'use client';

import NotificationBell from './NotificationBell';

type DashboardHeaderProps = {
  firstName?: string;
  lastName?: string | null;
  email?: string;
  onLogout: () => void;
};

export default function DashboardHeader({
  firstName,
  lastName,
  email,
  onLogout,
}: DashboardHeaderProps) {
  const fullName = [
    firstName,
    lastName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div>
          <h1 className="text-2xl font-bold text-sky-600">
            Payflow
          </h1>

          <p className="text-sm text-slate-500">
            Customer Dashboard
          </p>
        </div>

        <div className="flex items-center gap-4">
          <NotificationBell />

          <div className="hidden text-right sm:block">
            <p className="font-semibold text-slate-900">
              {fullName || 'Payflow User'}
            </p>

            <p className="text-sm text-slate-500">
              {email ?? ''}
            </p>
          </div>

          <a
            href="/sessions"
            className="rounded-xl border border-sky-300 bg-white px-4 py-2 font-semibold text-sky-600 transition hover:bg-sky-50"
          >
            Devices
          </a>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}