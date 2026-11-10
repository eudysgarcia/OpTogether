import { fromCents, toCents } from '../lib/money';
import { splitAmount } from './budget';
import { simulatePayoff, type DebtInput } from './debts';
import type { Shares } from '../types/models';

/** Escenario hipotético. Vive solo en el dispositivo: nunca modifica datos reales. */
export type Scenario = {
  id: string;
  name: string;
  incomes: { memberId: string; name: string; amount: number }[];
  budget: { categoryId: string; name: string; amount: number; shares: Shares }[];
  extraExpenses: number; // gastos adicionales mensuales
  savingsMonthly: number;
  /** Reparto del ahorro por miembro (%), p. ej. según compromisos. Vacío = proporcional al ingreso. */
  savingsShares?: Shares;
  savingsGoal: { name: string; target: number; current: number } | null;
  debts: (DebtInput & { extra: number })[];
};

export type ScenarioResult = {
  totalIncome: number;
  totalBudget: number;
  debtPayments: number;
  savings: number;
  available: number; // ingresos - presupuesto - gastos extra - cuotas - ahorro
  perMember: { memberId: string; name: string; income: number; contribution: number; remaining: number; share: number }[];
  monthsToSavingsGoal: number | null;
  savingsIn12Months: number;
  debtPayoff: { id: string; name: string; periods: number; totalInterest: number }[];
};

export function runScenario(s: Scenario): ScenarioResult {
  const ids = s.incomes.map((i) => i.memberId);
  const totalIncomeC = s.incomes.reduce((a, i) => a + toCents(i.amount), 0);
  const totalBudgetC = s.budget.reduce((a, b) => a + toCents(b.amount), 0);
  const debtPaymentsC = s.debts.reduce((a, d) => a + toCents(d.payment + d.extra), 0);
  const savingsC = toCents(s.savingsMonthly);
  const extraC = toCents(s.extraExpenses);

  const contrib: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const b of s.budget) {
    const parts = splitAmount(b.amount, b.shares, ids);
    for (const id of ids) contrib[id] += toCents(parts[id] ?? 0);
  }
  // Ahorro: según compromisos de cada uno (si existen). Gastos extra y cuotas: proporcional al ingreso.
  const savingsParts = s.savingsShares && Object.keys(s.savingsShares).length ? splitAmount(s.savingsMonthly, s.savingsShares, ids) : null;
  if (savingsParts) for (const id of ids) contrib[id] += toCents(savingsParts[id] ?? 0);
  const sharedC = (savingsParts ? 0 : savingsC) + extraC + debtPaymentsC;
  const perMember = s.incomes.map((i) => {
    const incomeShare = totalIncomeC > 0 ? toCents(i.amount) / totalIncomeC : 1 / Math.max(ids.length, 1);
    const c = contrib[i.memberId] + Math.round(sharedC * incomeShare);
    return {
      memberId: i.memberId,
      name: i.name,
      income: i.amount,
      contribution: fromCents(c),
      remaining: fromCents(toCents(i.amount) - c),
      share: toCents(i.amount) > 0 ? c / toCents(i.amount) : 0,
    };
  });

  let monthsToSavingsGoal: number | null = null;
  if (s.savingsGoal && s.savingsGoal.target > 0) {
    const rem = toCents(s.savingsGoal.target) - toCents(s.savingsGoal.current);
    monthsToSavingsGoal = rem <= 0 ? 0 : savingsC > 0 ? Math.ceil(rem / savingsC) : null;
  }

  return {
    totalIncome: fromCents(totalIncomeC),
    totalBudget: fromCents(totalBudgetC),
    debtPayments: fromCents(debtPaymentsC),
    savings: fromCents(savingsC),
    available: fromCents(totalIncomeC - totalBudgetC - extraC - debtPaymentsC - savingsC),
    perMember,
    monthsToSavingsGoal,
    savingsIn12Months: fromCents(toCents(s.savingsGoal?.current ?? 0) + savingsC * 12),
    debtPayoff: s.debts.map((d) => {
      const r = simulatePayoff(d, d.extra);
      return { id: d.id, name: d.name, periods: r.periods, totalInterest: r.totalInterest };
    }),
  };
}

export function compareScenarios(a: ScenarioResult, b: ScenarioResult) {
  return {
    available: fromCents(toCents(b.available) - toCents(a.available)),
    budget: fromCents(toCents(b.totalBudget) - toCents(a.totalBudget)),
    income: fromCents(toCents(b.totalIncome) - toCents(a.totalIncome)),
    savings: fromCents(toCents(b.savings) - toCents(a.savings)),
  };
}
