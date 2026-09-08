import Link from 'next/link';

export default function NotFound() {
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
        style={{
          width: '100%',
          maxWidth: '480px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            marginBottom: '10px',
            color: '#2563eb',
            fontSize: '14px',
            fontWeight: 800,
            letterSpacing: '0.12em',
          }}
        >
          404
        </div>

        <h1
          style={{
            margin: '0 0 10px',
            fontSize: '28px',
          }}
        >
          Page not found
        </h1>

        <p
          style={{
            margin: '0 0 22px',
            color: '#64748b',
          }}
        >
          The Payflow page you requested does not exist or may have moved.
        </p>

        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex',
            minHeight: '44px',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 20px',
            borderRadius: '10px',
            background: '#2563eb',
            color: '#ffffff',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}