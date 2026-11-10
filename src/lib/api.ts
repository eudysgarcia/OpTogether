import { PostgrestClient } from '@supabase/postgrest-js';
import type { Database } from '../types/database';
import { useBackend } from '../store/backend';
import { loadSession, saveSession, type Session } from './session';

/**
 * Cliente del backend propio:
 *   /rest/*   PostgREST sobre PostgreSQL (RLS por usuario)
 *   /auth/*   autenticación (JWT + refresh rotativo)
 *   /files/*  comprobantes privados con URLs firmadas
 */
export class ApiError extends Error {
  status: number;
  hint?: string | null;
  code?: string;
  constructor(message: string, status: number, extra?: { hint?: string | null; code?: string }) {
    super(message);
    this.status = status;
    this.hint = extra?.hint;
    this.code = extra?.code;
  }
}

const baseUrl = () => {
  const url = useBackend.getState().url;
  if (!url) throw new ApiError('BACKEND_NO_CONFIGURADO', 0);
  return url;
};

// ------------------------------------------------------------------ sesión
let session: Session | null = null;
let loaded = false;
let refreshing: Promise<Session | null> | null = null;
type Listener = (s: Session | null, event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED') => void;
const listeners = new Set<Listener>();

async function setSession(s: Session | null, event: Parameters<Listener>[1]) {
  session = s;
  await saveSession(s);
  listeners.forEach((l) => l(s, event));
}

async function request<T>(path: string, init: RequestInit & { json?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string>) };
  if (init.json !== undefined) headers['Content-Type'] = 'application/json';
  if (init.auth) {
    const s = await getSession();
    if (!s) throw new ApiError('SIN_SESION', 401);
    headers.Authorization = `Bearer ${s.access_token}`;
  }
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.message ?? body?.error ?? `HTTP ${res.status}`, res.status, { hint: body?.hint, code: body?.code });
  return body as T;
}

async function refresh(): Promise<Session | null> {
  if (!session?.refresh_token) return null;
  refreshing ??= (async () => {
    try {
      const s = await request<Session>('/auth/refresh', { method: 'POST', json: { refresh_token: session!.refresh_token } });
      await setSession(s, 'TOKEN_REFRESHED');
      return s;
    } catch (e) {
      // Solo se cierra la sesión si el servidor la rechaza; sin red se conserva para reintentar.
      if (e instanceof ApiError && e.status === 401) await setSession(null, 'SIGNED_OUT');
      return session;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Sesión vigente; renueva el token de acceso si vence en menos de 60 s. */
export async function getSession(): Promise<Session | null> {
  if (!loaded) {
    session = await loadSession();
    loaded = true;
  }
  if (session && session.expires_at - 60 < Date.now() / 1000) return refresh();
  return session;
}

export const auth = {
  getSession,
  onChange(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  async signUp(email: string, password: string) {
    const s = await request<Session>('/auth/signup', { method: 'POST', json: { email, password } });
    await setSession(s, 'SIGNED_IN');
    return s;
  },
  async signIn(email: string, password: string) {
    const s = await request<Session>('/auth/token', { method: 'POST', json: { email, password } });
    await setSession(s, 'SIGNED_IN');
    return s;
  },
  async signOut() {
    const rt = session?.refresh_token;
    await setSession(null, 'SIGNED_OUT');
    if (rt) await request('/auth/logout', { method: 'POST', json: { refresh_token: rt } }).catch(() => {});
  },
  async changePassword(currentPassword: string, password: string) {
    const s = await request<Session>('/auth/user', { method: 'PUT', auth: true, json: { current_password: currentPassword, password } });
    await setSession(s, 'TOKEN_REFRESHED');
  },
  requestRecoveryCode: (email: string) => request('/auth/recover', { method: 'POST', json: { email } }),
  async resetWithCode(email: string, code: string, password: string) {
    const s = await request<Session>('/auth/reset', { method: 'POST', json: { email, code, password } });
    await setSession(s, 'SIGNED_IN');
  },
};

// ------------------------------------------------------------------ datos (PostgREST)
/** fetch con token de acceso; ante 401 renueva una vez y reintenta. */
const authedFetch: typeof fetch = async (input, init) => {
  const withAuth = (s: Session | null) => {
    const h = new Headers(init?.headers);
    if (s) h.set('Authorization', `Bearer ${s.access_token}`);
    return { ...init, headers: h };
  };
  let res = await fetch(input, withAuth(await getSession()));
  if (res.status === 401 && session) {
    const s = await refresh();
    if (s) res = await fetch(input, withAuth(s));
  }
  return res;
};

let client: PostgrestClient<Database> | null = null;
let clientUrl = '';
export function getDb(): PostgrestClient<Database> {
  const url = `${baseUrl()}/rest`;
  if (!client || clientUrl !== url) {
    client = new PostgrestClient<Database>(url, { fetch: authedFetch });
    clientUrl = url;
  }
  return client;
}

/** `db.from(...)` / `db.rpc(...)` siempre contra el servidor configurado. */
export const db = new Proxy({} as PostgrestClient<Database>, {
  get(_t, prop) {
    const c = getDb() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});

/** Lanza si la respuesta trae error; devuelve data tipada. */
export function unwrap<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

// ------------------------------------------------------------------ comprobantes
export const files = {
  async upload(form: FormData) {
    const s = await getSession();
    const res = await fetch(`${baseUrl()}/files/upload`, { method: 'POST', body: form, headers: { Authorization: `Bearer ${s?.access_token ?? ''}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(body?.message ?? 'No se pudo subir el archivo', res.status);
    return body as { id: string; storage_path: string };
  },
  signedUrl: (path: string, ttl = 120) =>
    request<{ url: string }>(`/files/url?path=${encodeURIComponent(path)}&ttl=${ttl}`, { auth: true }).then((r) => r.url),
  remove: (id: string, reason: string) => request('/files/delete', { method: 'POST', auth: true, json: { id, reason } }),
};

export const health = (url: string) =>
  fetch(`${url.replace(/\/+$/, '')}/health`).then((r) => r.ok).catch(() => false);
