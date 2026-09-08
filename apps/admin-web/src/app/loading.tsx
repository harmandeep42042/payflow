export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-slate-50 p-6"
    >
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto size-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700 motion-reduce:animate-none"
        />
        <p className="mt-4 text-sm font-medium text-slate-700">
          Loading administrator workspace…
        </p>
      </div>
    </main>
  );
}