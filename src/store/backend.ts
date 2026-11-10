import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Configuración del backend. Por defecto se toma de las variables públicas de compilación
 * (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY). Si el APK se compiló sin ellas,
 * la app permite introducirlas una sola vez (la anon key es pública por diseño; la seguridad la da RLS).
 */
type BackendState = {
  url: string;
  anonKey: string;
  hydrated: boolean;
  setBackend: (url: string, anonKey: string) => void;
  reset: () => void;
};

const ENV_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ENV_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const useBackend = create<BackendState>()(
  persist(
    (set) => ({
      url: ENV_URL,
      anonKey: ENV_KEY,
      hydrated: false,
      setBackend: (url, anonKey) => set({ url: url.trim().replace(/\/+$/, ''), anonKey: anonKey.trim() }),
      reset: () => set({ url: ENV_URL, anonKey: ENV_KEY }),
    }),
    {
      name: 'optogether-backend',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ url: s.url, anonKey: s.anonKey }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BackendState>;
        // Las variables de compilación tienen prioridad si existen.
        return { ...current, url: ENV_URL || p.url || '', anonKey: ENV_KEY || p.anonKey || '' };
      },
      onRehydrateStorage: () => () => useBackend.setState({ hydrated: true }),
    },
  ),
);

export const backendConfigured = () => {
  const { url, anonKey } = useBackend.getState();
  return /^https?:\/\/.+/.test(url) && anonKey.length > 20;
};
