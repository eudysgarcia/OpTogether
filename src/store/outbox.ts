import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Inserts } from '../types/models';

/**
 * Cola de movimientos simples registrados sin conexión.
 * Solo se encolan GASTOS/INGRESOS SIN FONDO y sin comprobantes: no dependen de un saldo que
 * pueda cambiar mientras tanto. Cada uno lleva client_request_id: si se reenvía, el servidor
 * lo rechaza como duplicado y nunca se contabiliza dos veces.
 */
export type OutboxItem = {
  id: string; // = client_request_id
  payload: Inserts<'transactions'>;
  createdAt: number;
  lastError?: string;
  attempts: number;
};

type OutboxState = {
  items: OutboxItem[];
  enqueue: (payload: Inserts<'transactions'> & { client_request_id: string }) => void;
  remove: (id: string) => void;
  markFailed: (id: string, error: string) => void;
};

export const useOutbox = create<OutboxState>()(
  persist(
    (set) => ({
      items: [],
      enqueue: (payload) =>
        set((s) => ({ items: [...s.items, { id: payload.client_request_id, payload, createdAt: Date.now(), attempts: 0 }] })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      markFailed: (id, error) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, lastError: error, attempts: i.attempts + 1 } : i)) })),
    }),
    { name: 'optogether-outbox', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const canQueueOffline = (p: Inserts<'transactions'>) =>
  (p.type === 'expense' || p.type === 'income') && !p.fund_id && !p.to_fund_id && !p.bill_cycle_id;
