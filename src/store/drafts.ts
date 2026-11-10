import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Borradores de formularios: si la app se cierra o falla la red, no se pierde lo escrito. */
type DraftState = {
  drafts: Record<string, { data: Record<string, unknown>; savedAt: number }>;
  save: (key: string, data: Record<string, unknown>) => void;
  clear: (key: string) => void;
};

export const useDrafts = create<DraftState>()(
  persist(
    (set) => ({
      drafts: {},
      save: (key, data) => set((s) => ({ drafts: { ...s.drafts, [key]: { data, savedAt: Date.now() } } })),
      clear: (key) =>
        set((s) => {
          const { [key]: _omit, ...rest } = s.drafts;
          return { drafts: rest };
        }),
    }),
    { name: 'optogether-drafts', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
