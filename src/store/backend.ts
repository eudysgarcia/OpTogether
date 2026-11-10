import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * URL del servidor propio (Caddy → PostgREST + API). Por defecto viene de EXPO_PUBLIC_API_URL
 * en la compilación; si el APK se generó sin ella, la app la pide una sola vez.
 */
type BackendState = {
  url: string;
  hydrated: boolean;
  setBackend: (url: string) => void;
  reset: () => void;
};

const ENV_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

export const useBackend = create<BackendState>()(
  persist(
    (set) => ({
      url: ENV_URL,
      hydrated: false,
      setBackend: (url) => set({ url: url.trim().replace(/\/+$/, '') }),
      reset: () => set({ url: ENV_URL }),
    }),
    {
      name: 'optogether-backend-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ url: s.url }),
      merge: (persisted, current) => ({ ...current, url: ENV_URL || (persisted as Partial<BackendState>)?.url || '' }),
      onRehydrateStorage: () => () => useBackend.setState({ hydrated: true }),
    },
  ),
);

export const backendConfigured = () => /^https?:\/\/.+/.test(useBackend.getState().url);
