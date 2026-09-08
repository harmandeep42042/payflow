import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          404
        </p>

        <h1 className="mt-2 text-xl font-semibold text-slate-950">
          Administrator page not found
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          The requested administrator page does not exist or is no longer
          available.
        </p>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center rounded-md bg-slate-900 px-4 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}