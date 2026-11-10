import { addFrequency, type Frequency, PERIODS_PER_YEAR } from '../lib/dates';
import { fromCents, toCents } from '../lib/money';

export type DebtInput = {
  id: string;
  name: string;
  balance: number;
  /** % anual. null = sin interés registrado (no se inventa). */
  annualRate: number | null;
  payment: number; // cuota por periodo
  frequency: Frequency;
};

export type PayoffResult = {
  periods: number; // nº de cuotas hasta liquidar (Infinity si la cuota no cubre el interés)
  totalInterest: number;
  totalPaid: number;
  feasible: boolean;
};

const periodRate = (annualRate: number | null, f: Frequency) =>
  annualRate ? annualRate / 100 / PERIODS_PER_YEAR[f] : 0;

/** Simula la liquidación de una deuda con cuota fija (+ abono extra por periodo). */
export function simulatePayoff(d: DebtInput, extraPerPeriod = 0, maxPeriods = 1200): PayoffResult {
  let bal = toCents(d.balance);
  const r = periodRate(d.annualRate, d.frequency);
  const pay = toCents(d.payment + extraPerPeriod);
  if (bal <= 0) return { periods: 0, totalInterest: 0, totalPaid: 0, feasible: true };
  if (pay <= 0) return { periods: Infinity, totalInterest: 0, totalPaid: 0, feasible: false };
  let interest = 0;
  let paid = 0;
  let n = 0;
  while (bal > 0 && n < maxPeriods) {
    const i = Math.round(bal * r);
    if (pay <= i) return { periods: Infinity, totalInterest: fromCents(interest), totalPaid: fromCents(paid), feasible: false };
    bal += i;
    interest += i;
    const p = Math.min(pay, bal);
    bal -= p;
    paid += p;
    n++;
  }
  return { periods: bal > 0 ? Infinity : n, totalInterest: fromCents(interest), totalPaid: fromCents(paid), feasible: bal <= 0 };
}

export function payoffDate(startISO: string, frequency: Frequency, periods: number): string | null {
  if (!Number.isFinite(periods)) return null;
  return addFrequency(startISO, frequency, periods);
}

/**
 * Aplica un abono: reduce el saldo. Nunca deja el saldo bajo cero salvo sobrepago explícito.
 */
export function applyPayment(balance: number, amount: number, allowOverpayment = false) {
  if (amount <= 0) throw new Error('MONTO_INVALIDO');
  const next = toCents(balance) - toCents(amount);
  if (next < 0 && !allowOverpayment) throw new Error('SOBREPAGO_DEUDA');
  return fromCents(next);
}

export type Strategy = 'snowball' | 'avalanche';
export const STRATEGY_LABEL: Record<Strategy, string> = {
  snowball: 'Menor saldo primero',
  avalanche: 'Mayor interés primero',
};

export type PlanResult = {
  months: number;
  totalInterest: number;
  order: string[]; // ids en orden de liquidación
  payoffMonth: Record<string, number>;
  feasible: boolean;
};

/**
 * Planificador multi-deuda mensual. Todas las cuotas se normalizan a equivalente mensual.
 * El presupuesto mensual = suma de cuotas mínimas + extra. Al liquidar una deuda su cuota
 * se acumula sobre la siguiente según la estrategia.
 */
export function planDebts(debts: DebtInput[], strategy: Strategy, extraMonthly = 0, maxMonths = 600): PlanResult {
  const items = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({
      id: d.id,
      bal: toCents(d.balance),
      rate: d.annualRate ? d.annualRate / 100 / 12 : 0,
      min: toCents((d.payment * PERIODS_PER_YEAR[d.frequency]) / 12),
      annual: d.annualRate ?? 0,
    }));
  const budget = items.reduce((a, d) => a + d.min, 0) + toCents(extraMonthly);
  const sortFn =
    strategy === 'snowball'
      ? (a: (typeof items)[number], b: (typeof items)[number]) => a.bal - b.bal || b.annual - a.annual
      : (a: (typeof items)[number], b: (typeof items)[number]) => b.annual - a.annual || a.bal - b.bal;
  let interest = 0;
  let month = 0;
  const payoffMonth: Record<string, number> = {};
  const order: string[] = [];
  while (items.some((d) => d.bal > 0) && month < maxMonths) {
    month++;
    for (const d of items) {
      if (d.bal > 0) {
        const i = Math.round(d.bal * d.rate);
        d.bal += i;
        interest += i;
      }
    }
    let available = budget;
    const active = items.filter((d) => d.bal > 0);
    for (const d of active) {
      const p = Math.min(d.min, d.bal, available);
      d.bal -= p;
      available -= p;
    }
    for (const d of [...active].sort(sortFn)) {
      if (available <= 0) break;
      if (d.bal <= 0) continue;
      const p = Math.min(d.bal, available);
      d.bal -= p;
      available -= p;
    }
    for (const d of items) {
      if (d.bal <= 0 && payoffMonth[d.id] === undefined) {
        payoffMonth[d.id] = month;
        order.push(d.id);
      }
    }
  }
  const feasible = items.every((d) => d.bal <= 0);
  return { months: feasible ? month : Infinity, totalInterest: fromCents(interest), order, payoffMonth, feasible };
}

/** Cuotas programadas a partir de la fecha inicial (la primera vence un periodo después). */
export function installmentSchedule(opts: {
  startDate: string;
  frequency: Frequency;
  installmentAmount: number | null;
  installmentsCount: number | null;
  paid: number;
}) {
  const { startDate, frequency, installmentAmount, installmentsCount, paid } = opts;
  if (!installmentAmount || !installmentsCount || frequency === 'one_time') return [];
  let remaining = toCents(paid);
  const amt = toCents(installmentAmount);
  return Array.from({ length: installmentsCount }, (_, i) => {
    const covered = Math.max(0, Math.min(amt, remaining));
    remaining -= covered;
    return {
      number: i + 1,
      dueDate: addFrequency(startDate, frequency, i + 1),
      amount: installmentAmount,
      paidAmount: fromCents(covered),
      status: covered >= amt ? ('paid' as const) : covered > 0 ? ('partial' as const) : ('pending' as const),
    };
  });
}
