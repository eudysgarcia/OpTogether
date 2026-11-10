import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';

type PrefsState = {
  theme: ThemePreference;
  hideAmounts: boolean;
  localReminders: boolean;
  setTheme: (t: ThemePreference) => void;
  toggleHideAmounts: () => void;
  setLocalReminders: (v: boolean) => void;
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'system',
      hideAmounts: false,
      localReminders: true,
      setTheme: (theme) => set({ theme }),
      toggleHideAmounts: () => set((s) => ({ hideAmounts: !s.hideAmounts })),
      setLocalReminders: (localReminders) => set({ localReminders }),
    }),
    { name: 'optogether-prefs', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
