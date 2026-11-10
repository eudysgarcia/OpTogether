import { addMonthsISO, daysBetween } from '../lib/dates';
import { fromCents, pct, toCents } from '../lib/money';

export type GoalProjection = {
  progress: number; // 0..1+
  remaining: number;
  monthsToGoal: number | null; // null = sin aporte mensual o sin objetivo
  projectedDate: string | null;
  requiredMonthly: number | null; // para llegar a la fecha objetivo
  onTrack: boolean | null;
};

export function projectGoal(opts: {
  balance: number;
  target: number | null;
  monthly: number;
  targetDate: string | null;
  today: string;
}): GoalProjection {
  const { balance, target, monthly, targetDate, today } = opts;
  if (!target) {
    return { progress: 0, remaining: 0, monthsToGoal: null, projectedDate: null, requiredMonthly: null, onTrack: null };
  }
  const remainingC = Math.max(0, toCents(target) - toCents(balance));
  const remaining = fromCents(remainingC);
  const monthsToGoal = remainingC === 0 ? 0 : monthly > 0 ? Math.ceil(remainingC / toCents(monthly)) : null;
  const projectedDate = monthsToGoal === null ? null : addMonthsISO(today, monthsToGoal);
  let requiredMonthly: number | null = null;
  let onTrack: boolean | null = null;
  if (targetDate) {
    const months = Math.max(1, Math.ceil(daysBetween(today, targetDate) / 30.44));
    requiredMonthly = fromCents(Math.ceil(remainingC / months));
    onTrack = remainingC === 0 || (projectedDate !== null && projectedDate <= targetDate);
  }
  return { progress: pct(balance, target), remaining, monthsToGoal, projectedDate, requiredMonthly, onTrack };
}

/** Suma de compromisos mensuales { member_id: monto }. */
export const monthlyCommitment = (commitments: unknown): number => {
  if (!commitments || typeof commitments !== 'object') return 0;
  return fromCents(Object.values(commitments as Record<string, number>).reduce((a, v) => a + toCents(Number(v)), 0));
};
