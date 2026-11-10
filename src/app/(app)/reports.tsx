import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAllocationsRange, useBillCycles, useCategories, useDebts, useFunds, useGoals, useTransactions } from '../../api/finance';
import { useHH } from '../../api/household';
import { BudgetBars, DonutChart, TrendLine } from '../../components/charts/Charts';
import { Banner, Button, Card, Chip, ChipRow, EmptyState, Header, KeyValue, ListSkeleton, Money, Screen, SectionHeader, Segmented, Text } from '../../components/ui';
import { groupSpending, netSpending, totalsByType } from '../../domain/reports';
import { MONTHS_SHORT, addMonthsYM, capitalize, currentYM, formatDate, monthRange, ymLabel, type YearMonth } from '../../lib/dates';
import { errorMessage } from '../../lib/errors';
import { exportCSV, exportExcel, exportPDF, type Sheet } from '../../lib/export';
import { TX_TYPE, BILL_STATUS_UI } from '../../lib/labels';
import { formatMoney, formatPct, sum } from '../../lib/money';
import { toast } from '../../store/toast';
import { space } from '../../theme/tokens';
import type { Scope, TxType } from '../../types/models';

type Preset = 'month' | 'prev' | 'q' | 'year';

export default function Reports() {
  const { scope = 'household' } = useLocalSearchParams<{ scope?: Scope }>();
  const personal = scope === 'personal';
  const { members, memberName, household } = useHH();
  const [preset, setPreset] = useState<Preset>('month');
  const [tab, setTab] = useState<'spend' | 'evolution' | 'other'>('spend');
  const [busy, setBusy] = useState<string | null>(null);
  const now = currentYM();
  const range: { from: YearMonth; to: YearMonth } = {
    month: { from: now, to: now }, prev: { from: addMonthsYM(now, -1), to: addMonthsYM(now, -1) },
    q: { from: addMonthsYM(now, -2), to: now }, year: { from: { year: now.year, month: 1 }, to: now },
  }[preset];
  const fromISO = monthRange(range.from).from;
  const toISO = monthRange(range.to).to;
  const evoFrom = addMonthsYM(now, -5);

  const txs = useTransactions({ scope, from: fromISO, to: toISO, limit: 5000, includeVoided: false });
  const evoTx = useTransactions({ scope, from: monthRange(evoFrom).from, to: monthRange(now).to, types: ['expense', 'refund'], limit: 5000 });
  const allocs = useAllocationsRange(range.from, range.to);
  const cats = useCategories(true);
  const cycles = useBillCycles({ from: fromISO, to: toISO, scope });
  const debts = useDebts(scope);
  const goals = useGoals(scope);
  const funds = useFunds(scope);

  const list = txs.data ?? [];
  const catName = (id: string | null) => cats.data?.find((c) => c.id === id)?.name ?? 'Sin categoría';
  const spent = netSpending(list);
  const totals = totalsByType(list);
  const byCat = groupSpending(list, 'category_id').map((g) => ({ label: catName(g.key), value: g.amount }));
  const byMember = groupSpending(list, 'member_id').map((g) => ({ label: g.key === 'none' ? 'Sin asignar' : memberName(g.key), value: g.amount }));
  const bva = useMemo(() => {
    const m = new Map<string, { label: string; budget: number; spent: number }>();
    for (const a of allocs.data ?? []) {
      const x = m.get(a.category_id) ?? { label: a.category_name, budget: 0, spent: 0 };
      x.budget += Number(a.effective_amount);
      x.spent += Number(a.spent);
      m.set(a.category_id, x);
    }
    return [...m.values()];
  }, [allocs.data]);
  const evo = useMemo(() => {
    const g = groupSpending(evoTx.data ?? [], 'month');
    return Array.from({ length: 6 }, (_, i) => {
      const ym = addMonthsYM(evoFrom, i);
      const key = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
      return { label: MONTHS_SHORT[ym.month - 1], value: g.find((x) => x.key === key)?.amount ?? 0 };
    });
  }, [evoTx.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevMonth = evo[evo.length - 2]?.value ?? 0;
  const thisMonth = evo[evo.length - 1]?.value ?? 0;
  const periodLabel = range.from.month === range.to.month && range.from.year === range.to.year ? capitalize(ymLabel(range.from)) : `${capitalize(ymLabel(range.from, true))} – ${ymLabel(range.to, true)}`;

  const sheets = (): Sheet[] => {
    const s: Sheet[] = [{
      name: 'Movimientos',
      headers: ['Fecha', 'Tipo', 'Descripción', 'Categoría', ...(personal ? [] : ['Persona']), 'Monto', 'Observaciones'],
      rows: list.map((t) => [t.occurred_on, TX_TYPE[t.type as TxType].label, t.description, t.category_id ? catName(t.category_id) : '', ...(personal ? [] : [t.member_id ? memberName(t.member_id) : '']), Number(t.amount), t.notes ?? '']),
    }, {
      name: 'Por categoría', headers: ['Categoría', 'Gasto real'], rows: byCat.map((c) => [c.label, c.value]),
    }];
    if (!personal) {
      s.push({ name: 'Presupuesto vs real', headers: ['Categoría', 'Presupuesto', 'Gasto real', 'Diferencia'], rows: bva.map((b) => [b.label, b.budget, b.spent, b.budget - b.spent]) });
      s.push({ name: 'Pagos', headers: ['Servicio', 'Vence', 'Estimado', 'Pagado', 'Estado'], rows: (cycles.data ?? []).map((c) => [c.bill_name ?? '', c.due_date ?? '', Number(c.expected_amount), Number(c.paid_amount), BILL_STATUS_UI[c.status ?? 'pending'].label]) });
    }
    s.push({ name: 'Deudas', headers: ['Deuda', 'Original', 'Pagado', 'Intereses/recargos', 'Saldo'], rows: (debts.data ?? []).map((d) => [d.name ?? '', Number(d.original_amount), Number(d.paid), Number(d.interest_charged) + Number(d.fees_charged), Number(d.balance)]) });
    s.push({ name: 'Ahorros', headers: ['Meta', 'Objetivo', 'Ahorrado'], rows: (goals.data ?? []).map((g) => [g.name, Number(g.target_amount ?? 0), g.balance]) });
    s.push({ name: 'Fondos', headers: ['Fondo', 'Entradas', 'Salidas', 'Saldo'], rows: (funds.data ?? []).map((f) => [f.name, f.inflow, f.outflow, f.balance]) });
    return s;
  };
  const base = `optogether-${personal ? 'personal' : 'hogar'}-${fromISO}`;
  const run = async (kind: 'csv' | 'xlsx' | 'pdf') => {
    setBusy(kind);
    try {
      if (kind === 'csv') await exportCSV(base, sheets()[0]);
      else if (kind === 'xlsx') await exportExcel(base, sheets());
      else await exportPDF({ title: personal ? 'Reporte personal' : `Reporte del hogar · ${household?.name ?? ''}`, subtitle: periodLabel, kpis: [{ label: 'Gasto real', value: spent }, { label: 'Aportaciones', value: totals.contribution ?? 0 }, { label: 'Ahorro aportado', value: totals.savings_deposit ?? 0 }, { label: 'Abonos a deudas', value: totals.debt_payment ?? 0 }], sheets: sheets() });
    } catch (e) {
      toast.error('No se pudo exportar', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen testID="screen-reports" header={<Header title={personal ? 'Mi reporte' : 'Reportes'} subtitle={personal ? 'Privado' : periodLabel} back />} refreshing={txs.isRefetching} onRefresh={txs.refetch}>
      <ChipRow>
        {([['month', 'Este mes'], ['prev', 'Mes anterior'], ['q', 'Últimos 3 meses'], ['year', 'Este año']] as [Preset, string][]).map(([k, l]) => <Chip key={k} label={l} selected={preset === k} onPress={() => setPreset(k)} />)}
      </ChipRow>
      <Card>
        <Text variant="caption" color="textSecondary">Gasto real · {periodLabel}</Text>
        <Money value={spent} variant="amountXL" />
        <View style={{ marginTop: space[2] }}>
          {!personal && <KeyValue label="Aportaciones (no son gasto)"><Money value={totals.contribution ?? 0} variant="amountS" color="contribution" /></KeyValue>}
          <KeyValue label="Ingresos"><Money value={totals.income ?? 0} variant="amountS" color="positive" /></KeyValue>
          <KeyValue label="Ahorro aportado"><Money value={totals.savings_deposit ?? 0} variant="amountS" color="savings" /></KeyValue>
          <KeyValue label="Abonos a deudas"><Money value={totals.debt_payment ?? 0} variant="amountS" color="debt" /></KeyValue>
        </View>
      </Card>
      <Segmented options={[{ value: 'spend', label: 'Gastos' }, { value: 'evolution', label: 'Evolución' }, { value: 'other', label: 'Pagos y más' }]} value={tab} onChange={setTab} />
      {txs.isPending ? <ListSkeleton /> : tab === 'spend' ? (
        <>
          <View>
            <SectionHeader title="Por categoría" />
            <Card>{byCat.length ? <DonutChart data={byCat} centerValue={formatMoney(spent, { compact: true })} centerLabel="total" /> : <EmptyState compact icon="pie" title="Sin gastos en el periodo" />}</Card>
          </View>
          {!personal && byMember.length > 0 && (
            <View>
              <SectionHeader title="Por persona (quién pagó)" />
              <Card>{byMember.map((m) => <KeyValue key={m.label} label={`${m.label} · ${formatPct(spent ? m.value / spent : 0)}`}><Money value={m.value} variant="amountS" /></KeyValue>)}</Card>
            </View>
          )}
          {!personal && bva.length > 0 && (
            <View>
              <SectionHeader title="Presupuesto vs. real" />
              <Card><BudgetBars data={bva} /></Card>
            </View>
          )}
        </>
      ) : tab === 'evolution' ? (
        <>
          <Card>
            <Text variant="label" color="textSecondary">Gasto mensual · últimos 6 meses</Text>
            <TrendLine data={evo} />
          </Card>
          <Card>
            <KeyValue label="Este mes" value={formatMoney(thisMonth)} />
            <KeyValue label="Mes anterior" value={formatMoney(prevMonth)} />
            <KeyValue label="Variación"><Text variant="bodyStrong" color={thisMonth > prevMonth ? 'negative' : 'positive'}>{prevMonth ? `${thisMonth >= prevMonth ? '+' : ''}${formatPct((thisMonth - prevMonth) / prevMonth)}` : '—'}</Text></KeyValue>
            <KeyValue label="Promedio 6 meses" value={formatMoney(sum(evo.map((e) => e.value)) / 6)} />
          </Card>
        </>
      ) : (
        <>
          {!personal && (
            <View>
              <SectionHeader title="Pagos y vencimientos" />
              <Card>
                {(cycles.data ?? []).length ? (cycles.data ?? []).map((c) => <KeyValue key={c.id} label={`${c.bill_name} · ${formatDate(c.due_date, 'day')}`} value={`${formatMoney(c.paid_amount)} / ${formatMoney(c.expected_amount)} · ${BILL_STATUS_UI[c.status ?? 'pending'].label}`} />) : <Text variant="caption" color="textSecondary">Sin vencimientos en el periodo.</Text>}
              </Card>
            </View>
          )}
          <View>
            <SectionHeader title="Deudas" />
            <Card>{(debts.data ?? []).length ? debts.data!.map((d) => <KeyValue key={d.id} label={d.name!} value={`Saldo ${formatMoney(d.balance)}`} />) : <Text variant="caption" color="textSecondary">Sin deudas.</Text>}</Card>
          </View>
          <View>
            <SectionHeader title="Ahorros y fondos" />
            <Card>
              {(goals.data ?? []).map((g) => <KeyValue key={g.id} label={g.name} value={formatMoney(g.balance)} />)}
              {(funds.data ?? []).map((f) => <KeyValue key={f.id} label={f.name} value={formatMoney(f.balance)} />)}
            </Card>
          </View>
        </>
      )}
      <View>
        <SectionHeader title="Exportar" subtitle={personal ? 'Incluye solo tus datos personales' : 'Solo datos del hogar; nunca incluye finanzas personales'} />
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Button title="PDF" icon="file" variant="secondary" full={false} style={{ flex: 1 }} loading={busy === 'pdf'} disabled={!!busy} onPress={() => run('pdf')} />
          <Button title="Excel" icon="sheet" variant="secondary" full={false} style={{ flex: 1 }} loading={busy === 'xlsx'} disabled={!!busy} onPress={() => run('xlsx')} />
          <Button title="CSV" icon="download" variant="secondary" full={false} style={{ flex: 1 }} loading={busy === 'csv'} disabled={!!busy} onPress={() => run('csv')} />
        </View>
      </View>
      {members.length === 1 && !personal && <Banner tone="info" title="Invita a tu pareja" message="Los reportes por persona serán más útiles cuando ambos registren movimientos." />}
    </Screen>
  );
}
