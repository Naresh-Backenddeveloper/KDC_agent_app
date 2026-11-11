/**
 * The agent API client (spec 2.3): POST with JSON to {baseUrl}/{path}, Bearer
 * token, { code, message, data } envelope, a { code: 1 } fallback on network
 * or parse errors, and a single forced logout when a signed request gets 401.
 */
import type { Envelope } from '../domain/types';
import { handle as mockHandle } from './mockServer';
import { useSession } from '../store/session';

export const API_CONFIG = {
  /** Prototype: the in-app mock backend. Set false and fill baseUrl to go live. */
  useMock: true,
  baseUrl: 'https://api.kdcplus.in/api',
  timeoutMs: 20_000,
};

type Method = 'GET' | 'POST';

let logoutArmed = true;
let onSessionExpired: (() => void) | null = null;

/** Called once by the app shell: what to do when the server revokes the session. */
export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}
/** Re-armed on every successful login so the next 401 burst logs out once. */
export function rearmLogout() {
  logoutArmed = true;
}

async function send<T>(method: Method, path: string, body?: unknown): Promise<Envelope<T>> {
  const token = useSession.getState().token;
  let res: Envelope<T>;
  try {
    res = API_CONFIG.useMock ? await mockHandle(method, path, body, token) : await httpSend<T>(method, path, body, token);
  } catch {
    res = { code: 1, message: 'Something went wrong. Check your connection and try again.' };
  }
  if (token && res.code === 401 && logoutArmed) {
    logoutArmed = false;
    useSession.getState().clearToken();
    onSessionExpired?.();
  }
  return res;
}

async function httpSend<T>(method: Method, path: string, body: unknown, token: string | null): Promise<Envelope<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isForm && method === 'POST') headers['Content-Type'] = 'application/json';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_CONFIG.timeoutMs);
  try {
    const r = await fetch(`${API_CONFIG.baseUrl}/${path.replace(/^\/+/, '')}`, {
      method,
      headers,
      body: method === 'POST' ? (isForm ? (body as FormData) : JSON.stringify(body ?? {})) : undefined,
      signal: ctrl.signal,
    });
    const json = await r.json();
    if (r.status === 401 && json?.code === undefined) return { code: 401, message: 'Unauthenticated' };
    return json as Envelope<T>;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  post: <T = any>(path: string, body?: unknown) => send<T>('POST', path, body),
  get: <T = any>(path: string) => send<T>('GET', path),
};

export const isOk = (r: Envelope) => r.code === 0;
