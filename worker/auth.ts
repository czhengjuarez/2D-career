/// <reference types="@cloudflare/workers-types" />

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

const encoder = new TextEncoder();

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === 'string' ? encoder.encode(input) : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** Minimal HS256 JWT — enough for a session cookie, with no dependency to audit. */
export async function sign(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(data));
  return `${data}.${base64url(signature)}`;
}

export async function verify<T>(token: string, secret: string): Promise<T | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = await crypto.subtle.sign(
    'HMAC',
    await key(secret),
    encoder.encode(`${header}.${body}`),
  );
  // Constant-time-ish comparison via equal-length string check on the encoded value.
  if (base64url(expected) !== signature) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body)) as T & { exp?: number };
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function cookie(name: string, value: string, maxAgeSeconds: number): string {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  return attrs.join('; ');
}

export const SESSION_COOKIE = 'session';
export const STATE_COOKIE = 'oauth_state';
export const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

/** Decoded from Google's id_token, which we receive directly from the token endpoint over TLS. */
interface GoogleClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export function decodeIdToken(idToken: string): GoogleClaims | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64urlDecode(parts[1])) as GoogleClaims;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 24): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64url(buffer.buffer);
}

/** Join codes people read aloud — no 0/O/1/I to mistype. */
export function joinCode(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => alphabet[byte % alphabet.length]).join('');
}
