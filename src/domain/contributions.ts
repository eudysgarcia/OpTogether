import { fromCents, toCents } from '../lib/money';
import { splitAmount } from './budget';
import type { Shares } from '../types/models';

export type ContributionInput = {
  members: { id: string; display_name: string }[];
  allocations: { amount: number; shares: Shares | null }[];
  savingsCommitments: Record<string, number>[]; // por meta: { member_id: monto }
  transactions: {
    type: string;
    amount: number;
    member_id: string | null;
    fund_id: string | null;
    status: string;
    scope: string;
  }[];
};

export type MemberContribution = {
  memberId: string;
  name: string;
  expectedBudget: number;
  expectedSavings: number;
  expected: number;
  contributed: number; // aportaciones registradas
  directPayments: number; // pagos de gastos del hogar hechos directamente
  savingsDirect: number; // aportes directos a ahorro
  actual: number;
  difference: number; // actual - expected (positivo = adelantado/saldo a favor)
};

/**
 * Aportación esperada vs real por miembro para un periodo.
 * - Aportación ≠ gasto: se cuenta como dinero entregado al hogar.
 * - Un pago directo de un gasto del hogar (sin salir de un fondo) cuenta como aportación del que pagó.
 * - Las diferencias se muestran como "saldo por compensar", NO como deuda personal automática.
 */
export function computeContributions(input: ContributionInput): MemberContribution[] {
  const ids = input.members.map((m) => m.id);
  const budgetByMember: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const a of input.allocations) {
    const parts = splitAmount(a.amount, a.shares, ids);
    for (const id of ids) budgetByMember[id] = fromCents(toCents(budgetByMember[id]) + toCents(parts[id] ?? 0));
  }
  return input.members.map((m) => {
    const expectedSavingsC = input.savingsCommitments.reduce((acc, c) => acc + toCents(Number(c?.[m.id] ?? 0)), 0);
    let contributed = 0;
    let direct = 0;
    let savings = 0;
    for (const t of input.transactions) {
      if (t.status !== 'posted' || t.scope !== 'household' || t.member_id !== m.id) continue;
      if (t.type === 'contribution') contributed += toCents(t.amount);
      else if (t.type === 'expense' && !t.fund_id) direct += toCents(t.amount);
      else if (t.type === 'refund' && !t.fund_id) direct -= toCents(t.amount);
      else if (t.type === 'savings_deposit' && !t.fund_id) savings += toCents(t.amount);
    }
    const expectedC = toCents(budgetByMember[m.id]) + expectedSavingsC;
    const actualC = contributed + direct + savings;
    return {
      memberId: m.id,
      name: m.display_name,
      expectedBudget: budgetByMember[m.id],
      expectedSavings: fromCents(expectedSavingsC),
      expected: fromCents(expectedC),
      contributed: fromCents(contributed),
      directPayments: fromCents(direct),
      savingsDirect: fromCents(savings),
      actual: fromCents(actualC),
      difference: fromCents(actualC - expectedC),
    };
  });
}

export function contributionLabel(diff: number): { tone: 'positive' | 'neutral' | 'warning'; text: string } {
  if (Math.abs(diff) < 0.01) return { tone: 'neutral', text: 'Al día' };
  return diff > 0 ? { tone: 'positive', text: 'Aportó de más' } : { tone: 'warning', text: 'Pendiente por aportar' };
}
