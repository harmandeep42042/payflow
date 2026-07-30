export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-6 text-center">
        <span className="mb-5 rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700">
          PayFlow Digital Wallet
        </span>

        <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Fast, simple and secure digital payments
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Send demo money, manage your wallet and review your transactions from
          one modern platform.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <button
            type="button"
            className="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white transition hover:bg-sky-600"
          >
            Get started
          </button>

          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            Explore features
          </button>
        </div>
      </section>
    </main>
  );
}
