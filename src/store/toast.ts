import { create } from 'zustand';

export type Toast = { id: number; tone: 'success' | 'error' | 'info'; title: string; message?: string };

type ToastState = { toasts: Toast[]; show: (t: Omit<Toast, 'id'>) => void; dismiss: (id: number) => void };

let seq = 0;
export const useToast = create<ToastState>((set) => ({
  toasts: [],
  show: (t) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.tone === 'error' ? 5000 : 3000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, message?: string) => useToast.getState().show({ tone: 'success', title, message }),
  error: (title: string, message?: string) => useToast.getState().show({ tone: 'error', title, message }),
  info: (title: string, message?: string) => useToast.getState().show({ tone: 'info', title, message }),
};
