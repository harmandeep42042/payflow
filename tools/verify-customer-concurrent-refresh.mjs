import { readFile } from 'node:fs/promises';

const gateway = 'http://localhost:4000/api/v1';
const credential = JSON.parse(
  (await readFile('./e2e-login.json', 'utf8')).replace(/^\uFEFF/, ''),
);

const login = await fetch(`${gateway}/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Forwarded-For': '127.0.0.80',
  },
  body: JSON.stringify(credential),
});

if (!login.ok) throw new Error(`Login failed with status ${login.status}`);

const loginPayload = await login.json();
const session = loginPayload.data ?? loginPayload;
const refreshRequest = () => fetch(`${gateway}/auth/refresh`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken: session.refreshToken }),
});

const results = await Promise.all([refreshRequest(), refreshRequest()]);
const successful = results.filter((result) => result.status === 200);
const rejected = results.filter((result) => result.status === 401);

if (successful.length !== 1 || rejected.length !== 1) {
  throw new Error(
    `Refresh rotation did not produce one success and one rejection (statuses: ${results.map((result) => result.status).join(', ')})`,
  );
}

const refreshPayload = await successful[0].json();
const refreshed = refreshPayload.data ?? refreshPayload;
const profile = await fetch(`${gateway}/auth/profile`, {
  headers: { Authorization: `Bearer ${refreshed.accessToken}` },
});
const logout = await fetch(`${gateway}/auth/logout`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken: refreshed.refreshToken }),
});
const reuse = await fetch(`${gateway}/auth/refresh`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken: refreshed.refreshToken }),
});

console.log(`parallel_rotation = ${successful.length === 1 && rejected.length === 1}`);
console.log(`valid_session_usable = ${profile.status === 200}`);
console.log(`logout_success = ${logout.status === 200}`);
console.log(`revoked_session_rejected = ${reuse.status === 401}`);
