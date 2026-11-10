import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Scenario } from '../domain/simulator';

/** Escenarios del simulador: viven solo en el dispositivo y nunca tocan los datos reales. */
type State = { scenarios: Scenario[]; upsert: (s: Scenario) => void; remove: (id: string) => void };

export const useScenarios = create<State>()(
  persist(
    (set) => ({
      scenarios: [],
      upsert: (s) => set((st) => ({ scenarios: st.scenarios.some((x) => x.id === s.id) ? st.scenarios.map((x) => (x.id === s.id ? s : x)) : [...st.scenarios, s] })),
      remove: (id) => set((st) => ({ scenarios: st.scenarios.filter((x) => x.id !== id) })),
    }),
    { name: 'optogether-scenarios', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
