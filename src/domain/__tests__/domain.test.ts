import { allocationFigures, budgetStatus, splitAmount, summarizeBudget, sharesSumOk } from '../budget';
import { applyPayment, installmentSchedule, planDebts, simulatePayoff } from '../debts';
import { projectGoal, monthlyCommitment } from '../savings';
import { computeContributions } from '../contributions';
import { runScenario, compareScenarios, type Scenario } from '../simulator';
import { groupSpending, netSpending, toCSV, type ReportTx } from '../reports';
import { formatMoney, parseAmount, sum } from '../../lib/money';
import { addMonthsISO, monthGrid, addFrequency } from '../../lib/dates';

describe('money', () => {
  it('formatea en RD$', () => {
    expect(formatMoney(58730)).toBe('RD$58,730.00');
    expect(formatMoney(1234.5, { compact: true })).toBe('RD$1,234.50');
    expect(formatMoney(15000, { compact: true })).toBe('RD$15,000');
    expect(formatMoney(-250)).toBe('-RD$250.00');
    expect(formatMoney(10, { sign: true })).toBe('+RD$10.00');
  });
  it('suma sin errores de coma flotante', () => {
    expect(sum([0.1, 0.2])).toBe(0.3);
    expect(sum([16180, 42550])).toBe(58730);
  });
  it('interpreta montos escritos', () => {
    expect(parseAmount('12,500.50')).toBe(12500.5);
    expect(parseAmount('12500,5')).toBe(12500.5);
    expect(parseAmount('RD$ 1,000')).toBe(1000);
    expect(parseAmount('')).toBeNull();
  });
});

describe('presupuesto', () => {
  it('presupuesto no es gasto: sin gastos está "Sin iniciar"', () => {
    expect(budgetStatus(12000, 0)).toBe('not_started');
    const f = allocationFigures(12000, 0);
    expect(f.spent).toBe(0);
    expect(f.available).toBe(12000);
  });
  it('estados', () => {
    expect(budgetStatus(12000, 5000)).toBe('in_progress');
    expect(budgetStatus(12000, 10200)).toBe('near_limit');
    expect(budgetStatus(12000, 12000)).toBe('exhausted');
    expect(budgetStatus(12000, 12000.01)).toBe('exceeded');
    expect(budgetStatus(0, 10)).toBe('exceeded');
  });
  it('exceso y sobrante', () => {
    expect(allocationFigures(1000, 1250)).toMatchObject({ available: 0, excess: 250, status: 'exceeded' });
    expect(allocationFigures(1000, 400)).toMatchObject({ available: 600, excess: 0 });
  });
  it('resumen del presupuesto inicial = 37,500', () => {
    const rows = [15000, 12000, 1500, 1000, 1000, 4000, 3000].map((a) => ({ effective_amount: a, spent: 0 }));
    const s = summarizeBudget(rows);
    expect(s.budget).toBe(37500);
    expect(s.spent).toBe(0);
    expect(s.available).toBe(37500);
    expect(s.exceeded).toBe(0);
  });
  it('distribución 25/75 exacta', () => {
    expect(splitAmount(15000, { mei: 25, eudys: 75 }, ['mei', 'eudys'])).toEqual({ mei: 3750, eudys: 11250 });
    const odd = splitAmount(100.01, { a: 50, b: 50 }, ['a', 'b']);
    expect(odd.a + odd.b).toBeCloseTo(100.01, 2);
    expect(splitAmount(3000, {}, ['a', 'b'])).toEqual({ a: 1500, b: 1500 });
  });
  it('valida que la distribución sume 100', () => {
    expect(sharesSumOk({ a: 25, b: 75 })).toBe(true);
    expect(sharesSumOk({ a: 25, b: 70 })).toBe(false);
    expect(sharesSumOk({})).toBe(true);
  });
});

describe('deudas', () => {
  it('abono reduce saldo exacto', () => {
    expect(applyPayment(10000, 2000)).toBe(8000);
  });
  it('no permite sobrepago implícito', () => {
    expect(() => applyPayment(1000, 1500)).toThrow('SOBREPAGO_DEUDA');
    expect(applyPayment(1000, 1500, true)).toBe(-500);
  });
  it('sin interés: 10,000 a 2,500 = 4 cuotas', () => {
    const r = simulatePayoff({ id: 'a', name: 'A', balance: 10000, annualRate: null, payment: 2500, frequency: 'monthly' });
    expect(r).toMatchObject({ periods: 4, totalInterest: 0, feasible: true });
  });
  it('con interés genera intereses y abonos extra acortan el plazo', () => {
    const d = { id: 'a', name: 'A', balance: 50000, annualRate: 24, payment: 3000, frequency: 'monthly' as const };
    const base = simulatePayoff(d);
    const extra = simulatePayoff(d, 1000);
    expect(base.totalInterest).toBeGreaterThan(0);
    expect(extra.periods).toBeLessThan(base.periods);
    expect(extra.totalInterest).toBeLessThan(base.totalInterest);
  });
  it('cuota que no cubre interés es inviable', () => {
    expect(simulatePayoff({ id: 'a', name: 'A', balance: 100000, annualRate: 60, payment: 1000, frequency: 'monthly' }).feasible).toBe(false);
  });
  it('estrategias: avalancha ahorra intereses frente a bola de nieve', () => {
    const debts = [
      { id: 'small', name: 'S', balance: 5000, annualRate: 10, payment: 500, frequency: 'monthly' as const },
      { id: 'big', name: 'B', balance: 40000, annualRate: 48, payment: 2000, frequency: 'monthly' as const },
    ];
    const snow = planDebts(debts, 'snowball', 2000);
    const ava = planDebts(debts, 'avalanche', 2000);
    expect(snow.order[0]).toBe('small');
    expect(ava.totalInterest).toBeLessThanOrEqual(snow.totalInterest);
    expect(ava.feasible && snow.feasible).toBe(true);
  });
  it('cronograma de cuotas con pagos parciales', () => {
    const s = installmentSchedule({ startDate: '2026-01-31', frequency: 'monthly', installmentAmount: 2500, installmentsCount: 4, paid: 3000 });
    expect(s.map((i) => i.status)).toEqual(['paid', 'partial', 'pending', 'pending']);
    expect(s[0].dueDate).toBe('2026-02-28');
  });
});

describe('ahorros', () => {
  it('proyección de meta', () => {
    const p = projectGoal({ balance: 2000, target: 50000, monthly: 2000, targetDate: '2029-01-01', today: '2026-11-10' });
    expect(p.remaining).toBe(48000);
    expect(p.monthsToGoal).toBe(24);
    expect(p.projectedDate).toBe('2028-11-10');
    expect(p.onTrack).toBe(true);
    const late = projectGoal({ balance: 2000, target: 50000, monthly: 2000, targetDate: '2028-01-01', today: '2026-11-10' });
    expect(late.onTrack).toBe(false);
    expect(late.requiredMonthly).toBeGreaterThan(2000);
  });
  it('compromiso conjunto Mei 1,000 + Eudys 1,000 = 2,000', () => {
    expect(monthlyCommitment({ mei: 1000, eudys: 1000 })).toBe(2000);
  });
});

describe('aportaciones', () => {
  const members = [{ id: 'mei', display_name: 'Mei' }, { id: 'eudys', display_name: 'Eudys' }];
  const allocations = [
    { amount: 15000, shares: { mei: 25, eudys: 75 } },
    { amount: 12000, shares: { mei: 25, eudys: 75 } },
    { amount: 1500, shares: { mei: 25, eudys: 75 } },
    { amount: 1000, shares: { mei: 25, eudys: 75 } },
    { amount: 1000, shares: { mei: 25, eudys: 75 } },
    { amount: 4000, shares: { mei: 50, eudys: 50 } },
    { amount: 3000, shares: { mei: 50, eudys: 50 } },
  ];
  it('esperado según distribución inicial', () => {
    const r = computeContributions({ members, allocations, savingsCommitments: [{ mei: 1000, eudys: 1000 }], transactions: [] });
    const mei = r.find((x) => x.memberId === 'mei')!;
    const eudys = r.find((x) => x.memberId === 'eudys')!;
    // 30,500 * 25% + 7,000 * 50% + 1,000 = 7,625 + 3,500 + 1,000
    expect(mei.expected).toBe(12125);
    expect(eudys.expected).toBe(22875 + 3500 + 1000);
    expect(mei.expected + eudys.expected).toBe(37500 + 2000);
  });
  it('pagos directos cuentan; anulados y personales no; diferencia no es deuda', () => {
    const r = computeContributions({
      members, allocations: [{ amount: 1000, shares: { mei: 50, eudys: 50 } }], savingsCommitments: [],
      transactions: [
        { type: 'contribution', amount: 300, member_id: 'mei', fund_id: null, status: 'posted', scope: 'household' },
        { type: 'expense', amount: 400, member_id: 'mei', fund_id: null, status: 'posted', scope: 'household' },
        { type: 'expense', amount: 999, member_id: 'mei', fund_id: null, status: 'voided', scope: 'household' },
        { type: 'expense', amount: 999, member_id: 'mei', fund_id: null, status: 'posted', scope: 'personal' },
        { type: 'expense', amount: 100, member_id: 'mei', fund_id: 'f1', status: 'posted', scope: 'household' },
      ],
    });
    const mei = r.find((x) => x.memberId === 'mei')!;
    expect(mei.actual).toBe(700);
    expect(mei.difference).toBe(200);
  });
});

describe('simulador', () => {
  const base: Scenario = {
    id: 's', name: 'Base',
    incomes: [{ memberId: 'mei', name: 'Mei', amount: 16180 }, { memberId: 'eudys', name: 'Eudys', amount: 42550 }],
    budget: [{ categoryId: 'c', name: 'Todo', amount: 37500, shares: { mei: 25, eudys: 75 } }],
    extraExpenses: 0, savingsMonthly: 2000, savingsGoal: { name: 'Casa', target: 100000, current: 10000 }, debts: [],
  };
  it('disponible = ingresos - presupuesto - ahorro', () => {
    const r = runScenario(base);
    expect(r.totalIncome).toBe(58730);
    expect(r.available).toBe(58730 - 37500 - 2000);
    expect(r.monthsToSavingsGoal).toBe(45);
    expect(r.perMember.reduce((a, m) => a + m.contribution, 0)).toBeCloseTo(39500, 2);
  });
  it('compara escenarios sin mutar el original', () => {
    const copy = JSON.parse(JSON.stringify(base));
    const b = { ...base, savingsMonthly: 5000 };
    const diff = compareScenarios(runScenario(base), runScenario(b));
    expect(diff.available).toBe(-3000);
    expect(base).toEqual(copy);
  });
});

describe('reportes', () => {
  const tx = (p: Partial<ReportTx>): ReportTx => ({
    id: Math.random().toString(), type: 'expense', amount: 0, occurred_on: '2026-11-01', category_id: 'c1',
    member_id: 'm1', status: 'posted', scope: 'household', is_extraordinary: false, description: 'x', ...p,
  });
  it('transferencias, aportes, ahorros y abonos no son gasto', () => {
    const txs = [
      tx({ amount: 1000 }), tx({ type: 'transfer', amount: 5000 }), tx({ type: 'contribution', amount: 9000 }),
      tx({ type: 'savings_deposit', amount: 2000 }), tx({ type: 'debt_payment', amount: 3000 }),
      tx({ type: 'refund', amount: 200 }), tx({ amount: 700, status: 'voided' }),
    ];
    expect(netSpending(txs)).toBe(800);
  });
  it('agrupa por categoría', () => {
    const g = groupSpending([tx({ amount: 100, category_id: 'a' }), tx({ amount: 300, category_id: 'b' }), tx({ amount: 50, category_id: 'a' })], 'category_id');
    expect(g).toEqual([{ key: 'b', amount: 300 }, { key: 'a', amount: 150 }]);
  });
  it('CSV escapa comillas y previene fórmulas', () => {
    const csv = toCSV(['a', 'b'], [['=SUM(A1)', 'He said "hi"'], [-5, 'x']]);
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain('"He said ""hi"""');
    expect(csv).toContain('-5,x');
  });
});

describe('fechas', () => {
  it('fin de mes', () => {
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addFrequency('2026-11-10', 'biweekly')).toBe('2026-11-24');
  });
  it('grid mensual empieza en lunes', () => {
    const g = monthGrid({ year: 2026, month: 11 }); // 1 nov 2026 es domingo
    expect(g[0][6]).toBe('2026-11-01');
    expect(g[0][0]).toBeNull();
  });
});
