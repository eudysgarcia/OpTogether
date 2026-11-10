/**
 * Valores INICIALES sugeridos para el asistente de configuración.
 * No son datos fijos de la app: el usuario los revisa/edita antes de crear el hogar,
 * se guardan en la base de datos y luego se modifican desde Configuración.
 * Fechas de vencimiento: no fueron indicadas; se proponen valores editables.
 */
export type SetupCategory = {
  name: string;
  icon: string;
  color: string;
  amount: number;
  partnerPct: number; // % que aporta la pareja "A" (Mei); el resto el otro miembro
  is_variable: boolean;
  kind: 'expense' | 'fund';
  fund_key?: string;
  bill?: { kind: string; due_day: number; amount_type: 'fixed' | 'variable' } | null;
};

export const INITIAL_MEMBERS = [
  { name: 'Eudys', income: 42550, color: '#2563EB' },
  { name: 'Mei', income: 16180, color: '#8B5CF6' },
];

/** % asignado a Mei; Eudys = 100 - pct. */
export const INITIAL_CATEGORIES: SetupCategory[] = [
  { name: 'Alquiler', icon: 'home', color: '#1F2C66', amount: 15000, partnerPct: 25, is_variable: false, kind: 'expense', bill: { kind: 'rent', due_day: 1, amount_type: 'fixed' } },
  { name: 'Supermercado', icon: 'cart', color: '#14935D', amount: 12000, partnerPct: 25, is_variable: true, kind: 'expense', bill: null },
  { name: 'Internet', icon: 'wifi', color: '#3D4E99', amount: 1500, partnerPct: 25, is_variable: false, kind: 'expense', bill: { kind: 'internet', due_day: 15, amount_type: 'fixed' } },
  { name: 'Electricidad', icon: 'zap', color: '#D99A06', amount: 1000, partnerPct: 25, is_variable: true, kind: 'expense', bill: { kind: 'electricity', due_day: 20, amount_type: 'variable' } },
  { name: 'Gas', icon: 'flame', color: '#C2570C', amount: 1000, partnerPct: 25, is_variable: true, kind: 'expense', bill: { kind: 'gas', due_day: 25, amount_type: 'variable' } },
  { name: 'Caja chica', icon: 'wallet', color: '#0E7C86', amount: 4000, partnerPct: 50, is_variable: true, kind: 'fund', fund_key: 'petty' },
  { name: 'Salidas', icon: 'party', color: '#8B5CF6', amount: 3000, partnerPct: 50, is_variable: true, kind: 'fund', fund_key: 'outings' },
];

export const INITIAL_SAVINGS = { name: 'Ahorro conjunto', partnerAmount: 1000, otherAmount: 1000 };

export const INITIAL_FUNDS = [
  { key: 'petty', name: 'Caja chica', kind: 'petty_cash', icon: 'wallet', color: '#0E7C86' },
  { key: 'outings', name: 'Fondo de salidas', kind: 'outings', icon: 'party', color: '#8B5CF6' },
  { key: 'common', name: 'Fondo común', kind: 'common', icon: 'users', color: '#1F2C66' },
  { key: 'emergency', name: 'Fondo de emergencia', kind: 'emergency', icon: 'shield', color: '#D92D20' },
];

export const INITIAL_PAYMENT_METHODS = [
  { name: 'Efectivo', kind: 'cash' },
  { name: 'Tarjeta de débito', kind: 'debit' },
  { name: 'Tarjeta de crédito', kind: 'credit' },
  { name: 'Transferencia', kind: 'transfer' },
];
