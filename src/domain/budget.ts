import { fromCents, pct, sum, toCents } from '../lib/money';
import type { Shares } from '../types/models';

export type BudgetStatus = 'not_started' | 'in_progress' | 'near_limit' | 'exhausted' | 'exceeded';

export const NEAR_LIMIT_RATIO = 0.85;

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  not_started: 'Sin iniciar',
  in_progress: 'En progreso',
  near_limit: 'Cerca del límite',
  exhausted: 'Agotado',
  exceeded: 'Excedido',
};

/**
 * Estado de una categoría. El presupuesto NO es gasto: sin gastos reales el estado es "Sin iniciar"
 * aunque el presupuesto sea alto.
 */
export function budgetStatus(budget: number, spent: number): BudgetStatus {
  const b = toCents(budget);
  const s = toCents(spent);
  if (s <= 0) return 'not_started';
  if (s > b) return 'exceeded';
  if (s === b) return 'exhausted';
  if (s >= b * NEAR_LIMIT_RATIO) return 'near_limit';
  return 'in_progress';
}

export type AllocationFigures = {
  budget: number; // presupuesto efectivo (incluye reasignaciones)
  spent: number; // gasto real neto
  available: number; // >= 0
  excess: number; // >= 0
  ratio: number; // gasto / presupuesto
  status: BudgetStatus;
};

export function allocationFigures(effectiveBudget: number | null, spent: number | null): AllocationFigures {
  const b = effectiveBudget ?? 0;
  const s = spent ?? 0;
  const diff = toCents(b) - toCents(s);
  return {
    budget: b,
    spent: s,
    available: diff > 0 ? fromCents(diff) : 0,
    excess: diff < 0 ? fromCents(-diff) : 0,
    ratio: pct(s, b),
    status: budgetStatus(b, s),
  };
}

export type BudgetSummary = {
  budget: number;
  spent: number;
  available: number; // dinero restante del presupuesto (puede ser negativo si hay excesos netos)
  ratio: number;
  exceeded: number; // nº de categorías excedidas
  excessTotal: number;
};

export function summarizeBudget(rows: { effective_amount: number | null; spent: number | null }[]): BudgetSummary {
  const budget = sum(rows.map((r) => r.effective_amount));
  const spent = sum(rows.map((r) => r.spent));
  let exceeded = 0;
  let excessC = 0;
  for (const r of rows) {
    const f = allocationFigures(r.effective_amount, r.spent);
    if (f.status === 'exceeded') {
      exceeded++;
      excessC += toCents(f.excess);
    }
  }
  return {
    budget,
    spent,
    available: fromCents(toCents(budget) - toCents(spent)),
    ratio: pct(spent, budget),
    exceeded,
    excessTotal: fromCents(excessC),
  };
}

/**
 * Reparte un monto entre miembros según porcentajes. El residuo de redondeo se asigna
 * al miembro con mayor porcentaje para que la suma sea exacta.
 */
export function splitAmount(amount: number, shares: Shares | null | undefined, memberIds: string[]): Record<string, number> {
  const ids = memberIds.length ? memberIds : Object.keys(shares ?? {});
  const effective: Shares =
    shares && Object.keys(shares).length
      ? shares
      : Object.fromEntries(ids.map((id) => [id, 100 / Math.max(ids.length, 1)]));
  const total = toCents(amount);
  const out: Record<string, number> = {};
  let assigned = 0;
  let maxId = ids[0];
  for (const id of ids) {
    const p = effective[id] ?? 0;
    const c = Math.floor((total * p) / 100);
    out[id] = c;
    assigned += c;
    if ((effective[id] ?? 0) > (effective[maxId] ?? 0)) maxId = id;
  }
  if (maxId !== undefined) out[maxId] += total - assigned;
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, fromCents(v)]));
}

export function sharesSumOk(shares: Shares): boolean {
  const vals = Object.values(shares);
  if (!vals.length) return true;
  if (vals.some((v) => !Number.isFinite(v) || v < 0)) return false;
  return Math.abs(vals.reduce((a, b) => a + b, 0) - 100) < 0.01;
}

/** Opciones disponibles según el estado de la categoría (sobrante / exceso). */
export function surplusActions(f: AllocationFigures) {
  return {
    canMoveSurplus: f.available > 0,
    hasExcess: f.excess > 0,
  };
}
