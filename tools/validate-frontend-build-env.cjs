const value = process.env.NEXT_PUBLIC_API_GATEWAY_URL;

if (!value) {
  throw new Error(
    'NEXT_PUBLIC_API_GATEWAY_URL must be set before building a production frontend bundle.',
  );
}

let url;
try {
  url = new URL(value);
} catch {
  throw new Error(
    'NEXT_PUBLIC_API_GATEWAY_URL must be an absolute HTTP(S) URL.',
  );
}

const hostname = url.hostname.toLowerCase();
const localHosts = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
]);

const isLocal =
  localHosts.has(hostname) ||
  hostname.endsWith('.localhost');

if (!['http:', 'https:'].includes(url.protocol)) {
  throw new Error(
    'NEXT_PUBLIC_API_GATEWAY_URL must use HTTP or HTTPS.',
  );
}

if (isLocal && process.env.PAYFLOW_LOCAL_BUILD !== 'true') {
  throw new Error(
    'NEXT_PUBLIC_API_GATEWAY_URL must use a non-local HTTP(S) endpoint for production builds.',
  );
}
