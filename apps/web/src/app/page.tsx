import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="text-2xl font-bold text-sky-600"
          >
            Payflow
          </Link>

          <Link
            href="/login"
            className="rounded-xl bg-sky-500 px-5 py-2.5 font-semibold text-white transition hover:bg-sky-600"
          >
            Login
          </Link>
        </div>
      </nav>

      <section className="mx-auto flex min-h-[calc(100vh-81px)] max-w-7xl flex-col items-center justify-center px-6 py-20 text-center">
        <span className="mb-5 rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700">
          Payflow Digital Wallet
        </span>

        <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Fast, simple and secure digital payments
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Manage wallets, deposit funds, transfer
          money and review transactions from one
          secure platform.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/login"
            className="rounded-xl bg-sky-500 px-7 py-3 font-semibold text-white transition hover:bg-sky-600"
          >
            Get started
          </Link>

          <a
            href="http://localhost:4000/swagger"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            Explore APIs
          </a>
        </div>
      </section>
    </main>
  );
}
