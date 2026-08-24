import { readFile } from 'node:fs/promises';

const admin = 'http://localhost:3001';
const gateway = 'http://localhost:4000/api/v1';
const credential = JSON.parse(
  (await readFile('./e2e-admin-login.json', 'utf8')).replace(/^\uFEFF/, ''),
);
const customerCredential = JSON.parse(
  (await readFile('./e2e-login.json', 'utf8')).replace(/^\uFEFF/, ''),
);
const cookie = (response) => response.headers.get('set-cookie')?.split(';')[0] ?? '';

const login = await fetch(`${admin}/api/admin-session/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(credential),
});
if (!login.ok) throw new Error(`Admin login failed with status ${login.status}`);
const session = await login.json();
const firstCookie = cookie(login);
const cookieHeader = login.headers.get('set-cookie') ?? '';
const cookieSecurity = /HttpOnly/i.test(cookieHeader)
  && /SameSite=Strict/i.test(cookieHeader)
  && /Secure/i.test(cookieHeader);

const refresh = await fetch(`${admin}/api/admin-session/refresh`, {
  method: 'POST', headers: { Cookie: firstCookie },
});
if (!refresh.ok) throw new Error(`Admin refresh failed with status ${refresh.status}`);
const refreshed = await refresh.json();
const activeCookie = cookie(refresh);
const auth = { Authorization: `Bearer ${refreshed.accessToken}` };
const endpoints = ['dashboard', 'users', 'wallets', 'transactions', 'analytics', 'audit-logs'];
const results = await Promise.all(
  endpoints.map(async (path) => [path, (await fetch(`${gateway}/admin/${path}`, { headers: auth })).status]),
);
const logout = await fetch(`${admin}/api/admin-session/logout`, {
  method: 'POST', headers: { Cookie: activeCookie },
});
const cleared = /Max-Age=0/i.test(logout.headers.get('set-cookie') ?? '');
const reuse = await fetch(`${admin}/api/admin-session/refresh`, {
  method: 'POST', headers: { Cookie: activeCookie },
});
const customerLogin = await fetch(`${admin}/api/admin-session/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(customerCredential),
});

console.log(`login = ${login.status === 200 && session.user?.role === 'ADMIN'}`);
console.log(`cookie_security = ${cookieSecurity}`);
console.log(`refresh = ${refresh.status === 200}`);
for (const [path, status] of results) console.log(`${path} = ${status === 200}`);
console.log(`logout = ${logout.status === 200 && cleared}`);
console.log(`revoked_session_rejected = ${reuse.status === 401}`);
console.log(`customer_role_rejected = ${customerLogin.status === 403}`);
