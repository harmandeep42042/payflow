export default function Loading() {
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
        aria-live="polite"
        aria-busy="true"
        style={{
          width: '100%',
          maxWidth: '420px',
          textAlign: 'center',
        }}
      >
        <div
          className="payflow-loading-spinner"
          aria-hidden="true"
          style={{
            width: '42px',
            height: '42px',
            margin: '0 auto 18px',
            border: '4px solid #e2e8f0',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
          }}
        />

        <h1
          style={{
            margin: '0 0 8px',
            fontSize: '22px',
            fontWeight: 700,
          }}
        >
          Loading Payflow
        </h1>

        <p
          style={{
            margin: 0,
            color: '#64748b',
          }}
        >
          Please wait while we prepare your account.
        </p>

        <style>
          {`
            .payflow-loading-spinner {
              animation: payflow-spin 0.8s linear infinite;
            }

            @keyframes payflow-spin {
              to {
                transform: rotate(360deg);
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .payflow-loading-spinner {
                animation: none;
              }
            }
          `}
        </style>
      </section>
    </main>
  );
}