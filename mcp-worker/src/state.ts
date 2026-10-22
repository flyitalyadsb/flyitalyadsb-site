import type { AuthRequest, ConsentDescription } from '@cloudflare/workers-oauth-provider';
import type { Lang } from './api';

// State of one authorization while the user signs in: from the first page to
// the consent. In KV (OAUTH_KV, `fia-flow:` prefix, next to the library's own
// keys), short-lived, and bound to the browser that started it: the cookie
// carries a random secret whose hash is stored here. Without the binding, an
// attacker could start a connection with someone else's email and wait for
// them to click the link in the email (their session would end up in the
// attacker's flow); with it, the link and every step only work where the
// flow began.

export const FLOW_TTL_S = 20 * 60;
const FLOW_COOKIE = '__Host-fia-flow';
const DEVICE_COOKIE = '__Host-fia-device';
export const DEVICE_TTL_S = 30 * 24 * 3600;

export interface Flow {
  request: AuthRequest;
  details: ConsentDescription;
  lang: Lang;
  bind: string;
  email?: string;
  session?: string;
  hasKey?: boolean;
  plan?: string;
  // From a remembered device: a connection token that already works.
  connection?: string;
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function randomId(bytes = 24): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The grant's userId. The library keeps it in clear in KV key names, so an
 * opaque hash of the email instead of the email itself. */
export async function userIdFor(email: string): Promise<string> {
  return (await sha256hex(`fia-user:${email}`)).slice(0, 32);
}

export function cookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

export function setCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function startFlow(
  kv: KVNamespace,
  base: Omit<Flow, 'bind'>,
): Promise<{ id: string; flow: Flow; setCookie: string }> {
  const id = randomId();
  const secret = randomId(32);
  const flow: Flow = { ...base, bind: await sha256hex(secret) };
  await kv.put(`fia-flow:${id}`, JSON.stringify(flow), { expirationTtl: FLOW_TTL_S });
  return { id, flow, setCookie: setCookie(FLOW_COOKIE, `${id}.${secret}`, FLOW_TTL_S) };
}

/** The flow `id`, only if this browser started it. */
export async function loadFlow(kv: KVNamespace, request: Request, id: string): Promise<Flow | null> {
  const [cookieId, secret] = (cookie(request, FLOW_COOKIE) ?? '').split('.');
  if (!id || cookieId !== id || !secret) return null;
  const flow = (await kv.get(`fia-flow:${id}`, 'json')) as Flow | null;
  if (!flow || flow.bind !== (await sha256hex(secret))) return null;
  return flow;
}

export async function saveFlow(kv: KVNamespace, id: string, flow: Flow): Promise<void> {
  await kv.put(`fia-flow:${id}`, JSON.stringify(flow), { expirationTtl: FLOW_TTL_S });
}

export async function endFlow(kv: KVNamespace, id: string): Promise<string> {
  await kv.delete(`fia-flow:${id}`);
  return setCookie(FLOW_COOKIE, '', 0);
}

// --- remembered device -------------------------------------------------------
// After a connection, this browser remembers who signed in and the connection
// token, encrypted (AES-GCM, key from the DEVICE_SECRET Worker secret), so the
// next authorization skips the email and the code. The token is checked
// against public-api before it is used again: a revoked one is forgotten.

async function deviceKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`fia-device:${secret}`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function rememberDevice(secret: string, email: string, connection: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = enc.encode(JSON.stringify({ e: email, c: connection, x: Date.now() + DEVICE_TTL_S * 1000 }));
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deviceKey(secret), payload);
  const out = new Uint8Array(iv.length + sealed.byteLength);
  out.set(iv);
  out.set(new Uint8Array(sealed), iv.length);
  return setCookie(DEVICE_COOKIE, b64url(out), DEVICE_TTL_S);
}

export async function rememberedDevice(
  secret: string,
  request: Request,
): Promise<{ email: string; connection: string } | null> {
  const value = cookie(request, DEVICE_COOKIE);
  if (!value) return null;
  try {
    const raw = unb64url(value);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: raw.slice(0, 12) }, await deviceKey(secret), raw.slice(12));
    const d = JSON.parse(new TextDecoder().decode(plain)) as { e: string; c: string; x: number };
    return d.x > Date.now() ? { email: d.e, connection: d.c } : null;
  } catch {
    return null; // tampered, or sealed with an older secret
  }
}

export function forgetDevice(): string {
  return setCookie(DEVICE_COOKIE, '', 0);
}

// --- sealed values ------------------------------------------------------------
// A connection token waiting in KV for an auth.md agent to collect it
// (agent.ts), AES-GCM with a key from the CONSENT_SECRET Worker secret: KV
// holds it for minutes, but never in clear.

async function sealKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`fia-agent:${secret}`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal(secret: string, value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sealKey(secret), enc.encode(value));
  const out = new Uint8Array(iv.length + sealed.byteLength);
  out.set(iv);
  out.set(new Uint8Array(sealed), iv.length);
  return b64url(out);
}

export async function unseal(secret: string, value: string): Promise<string> {
  const raw = unb64url(value);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, await sealKey(secret), raw.slice(12));
  return new TextDecoder().decode(plain);
}
