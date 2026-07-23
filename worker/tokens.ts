/// <reference types="@cloudflare/workers-types" />

import { randomToken } from './auth';

/**
 * Personal access tokens let an agent act as the person who minted it — same teams, same
 * role, same attribution on anything it submits. Only the hash is stored, so a leaked
 * bucket does not hand over working credentials.
 */
export interface StoredToken {
  id: string;
  userId: string;
  name: string;
  hash: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export const tokenKey = (id: string) => `tokens/${id}.json`;

const PREFIX = 'car';

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Compare fixed-length hex digests without leaking position through early exit. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function mintToken() {
  const id = randomToken(9);
  const secret = randomToken(24);
  return { id, secret, display: `${PREFIX}_${id}_${secret}` };
}

export function parseToken(value: string): { id: string; secret: string } | null {
  const parts = value.trim().split('_');
  if (parts.length !== 3 || parts[0] !== PREFIX || !parts[1] || !parts[2]) return null;
  return { id: parts[1], secret: parts[2] };
}

export function bearerFrom(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [scheme, ...rest] = header.split(' ');
  if (scheme.toLowerCase() !== 'bearer') return null;
  const value = rest.join(' ').trim();
  return value || null;
}

/** What a client may see about a token — never the secret, which exists once at mint time. */
export function tokenSummary(token: StoredToken) {
  return {
    id: token.id,
    name: token.name,
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt,
  };
}
