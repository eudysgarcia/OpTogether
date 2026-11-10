import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import type { Database } from '../types/database';
import { useBackend } from '../store/backend';

export type DB = SupabaseClient<Database>;

let client: DB | null = null;
let clientKey = '';

export function getSupabase(): DB {
  const { url, anonKey } = useBackend.getState();
  if (!url || !anonKey) throw new Error('BACKEND_NO_CONFIGURADO');
  const key = `${url}|${anonKey}`;
  if (!client || clientKey !== key) {
    client = createClient<Database>(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
    clientKey = key;
  }
  return client;
}

/** Proxy cómodo: `supabase.from(...)` siempre usa el cliente vigente. */
export const supabase = new Proxy({} as DB, {
  get(_t, prop) {
    const c = getSupabase() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});

// Refresco de sesión solo con la app en primer plano (recomendación de Supabase para RN).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    try {
      const c = getSupabase();
      if (state === 'active') c.auth.startAutoRefresh();
      else c.auth.stopAutoRefresh();
    } catch {
      /* backend aún no configurado */
    }
  });
}

/** Lanza si la respuesta trae error; devuelve data tipada. */
export function unwrap<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}
