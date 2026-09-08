'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin application error', error);
  }, [error]);

  return (
    <main
      role="alert"
      className="flex min-h-screen items-center justify-center bg-slate-50 p-6"
    >
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">
          Administrator workspace unavailable
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          The requested administrator view could not be displayed safely.
          No action has been confirmed by this error screen.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-11 rounded-md bg-slate-900 px-4 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Try again
        </button>
      </section>
    </main>
  );
}