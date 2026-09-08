'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Payflow customer application error', error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: '#f8fafc',
        color: '#0f172a',
      }}
    >
      <section
        role="alert"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '28px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '18px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            margin: '0 0 10px',
            fontSize: '24px',
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            margin: '0 0 22px',
            color: '#64748b',
          }}
        >
          Payflow could not complete this screen safely. You can try again.
        </p>

        <button
          type="button"
          onClick={() => reset()}
          style={{
            minHeight: '44px',
            padding: '0 20px',
            border: 0,
            borderRadius: '10px',
            background: '#2563eb',
            color: '#ffffff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </section>
    </main>
  );
}