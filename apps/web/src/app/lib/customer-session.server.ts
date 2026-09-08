import { NextResponse } from 'next/server';
import type { AdminLoginResponse, PayflowUser } from '@payflow/shared-types';

const COOKIE = 'payflow_customer_refresh_token';
const GATEWAY = process.env.API_GATEWAY_INTERNAL_URL ?? process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:4000/api/v1';
type Wrapped<T> = { data?: T };
export type CustomerSession = { accessToken: string; user: PayflowUser };
export function unwrap<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'data' in value) { const wrapped = value as Wrapped<T>; if (wrapped.data !== undefined) return wrapped.data; }
  return value as T;
}
export function gateway(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${GATEWAY}${path}`, { ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...init.headers } });
}
export async function read(response: Response): Promise<unknown> {
  const text = await response.text(); if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return { message: text }; }
}
export function forward(response: Response, value: unknown): NextResponse { return NextResponse.json(value, { status: response.status }); }
export function token(request: Request): string | null {
  for (const item of (request.headers.get('cookie') ?? '').split(';')) { const [name, ...parts] = item.trim().split('='); if (name === COOKIE) return decodeURIComponent(parts.join('=')); }
  return null;
}
export function setToken(response: NextResponse, value: string): void {
  response.cookies.set({ name: COOKIE, value, httpOnly: true, secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false', sameSite: 'strict', path: '/', maxAge: 7 * 86400 });
}
export function clearToken(response: NextResponse): void {
  response.cookies.set({ name: COOKIE, value: '', httpOnly: true, secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false', sameSite: 'strict', path: '/', maxAge: 0 });
}
export function publicSession(login: AdminLoginResponse): CustomerSession { return { accessToken: login.accessToken, user: login.user }; }
