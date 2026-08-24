import { readFile } from 'node:fs/promises';

const web = 'http://localhost:3000';
const gateway = 'http://localhost:4000/api/v1';
const credential = JSON.parse(
  (await readFile('./e2e-login.json', 'utf8')).replace(/^\uFEFF/, ''),
);
const cookie = (response) => response.headers.get('set-cookie')?.split(';')[0] ?? '';
const unwrap = (value) => value?.data ?? value;

const login = await fetch(`${web}/api/customer-session/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(credential),
});
if (!login.ok) throw new Error(`Customer login failed with status ${login.status}`);
const loginPayload = await login.json();
const firstCookie = cookie(login);
const cookieSecurity = /HttpOnly/i.test(login.headers.get('set-cookie') ?? '')
  && /SameSite=Strict/i.test(login.headers.get('set-cookie') ?? '')
  && /Secure/i.test(login.headers.get('set-cookie') ?? '');

const refresh = await fetch(`${web}/api/customer-session/refresh`, {
  method: 'POST', headers: { Cookie: firstCookie },
});
if (!refresh.ok) throw new Error(`Customer refresh failed with status ${refresh.status}`);
const refreshed = await refresh.json();
const activeCookie = cookie(refresh);
const auth = { Authorization: `Bearer ${refreshed.accessToken}` };
const profile = await fetch(`${gateway}/auth/profile`, { headers: auth });
const walletsResponse = await fetch(`${gateway}/wallets/user/${loginPayload.user.id}`, { headers: auth });
const walletsPayload = unwrap(await walletsResponse.json());
const wallets = Array.isArray(walletsPayload) ? walletsPayload : walletsPayload.wallets ?? [];
const wallet = wallets[0] ?? walletsPayload;
const transactions = await fetch(`${gateway}/wallets/${wallet.id}/transactions?page=1&limit=100&type=ALL`, { headers: auth });
const qr = await fetch(`${gateway}/wallet-qr/my?currency=${encodeURIComponent(wallet.currency)}`, { headers: auth });
const sessions = await fetch(`${gateway}/auth/sessions`, { headers: auth });
const rewards = await fetch(`${gateway}/rewards?userId=${encodeURIComponent(loginPayload.user.id)}`, { headers: auth });
const logout = await fetch(`${web}/api/customer-session/logout`, {
  method: 'POST', headers: { Cookie: activeCookie },
});
const cleared = /Max-Age=0/i.test(logout.headers.get('set-cookie') ?? '');
const reuse = await fetch(`${web}/api/customer-session/refresh`, {
  method: 'POST', headers: { Cookie: activeCookie },
});

console.log(`login = ${login.status === 200}`);
console.log(`cookie_security = ${cookieSecurity}`);
console.log(`refresh = ${refresh.status === 200}`);
console.log(`protected_profile = ${profile.status === 200}`);
console.log(`wallet = ${walletsResponse.status === 200 && Boolean(wallet.id)}`);
console.log(`transactions = ${transactions.status === 200}`);
console.log(`receive_qr = ${qr.status === 200}`);
console.log(`sessions = ${sessions.status === 200}`);
console.log(`rewards = ${rewards.status === 200}`);
console.log(`logout = ${logout.status === 200 && cleared}`);
console.log(`revoked_session_rejected = ${reuse.status === 401}`);
