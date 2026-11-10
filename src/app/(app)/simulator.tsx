import * as Crypto from 'expo-crypto';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAllocations, useDebts, useGoals } from '../../api/finance';
import { currentIncomes, useHH, useIncomes } from '../../api/household';
import { Banner, Button, Card, Chip, ChipRow, Divider, Header, IconButton, Input, KeyValue, Loading, Money, Screen, SectionHeader, Text } from '../../components/ui';
import { monthlyCommitment } from '../../domain/savings';
import { compareScenarios, runScenario, type Scenario } from '../../domain/simulator';
import { addMonthsISO, currentYM, formatDate, todayISO, type Frequency } from '../../lib/dates';
import { formatMoney, formatPct, parseAmount } from '../../lib/money';
import { useScenarios } from '../../store/scenarios';
import { toast } from '../../store/toast';
import { space } from '../../theme/tokens';
import type { Shares } from '../../types/models';

export default function Simulator() {
  const { members } = useHH();
  const incomes = useIncomes();
  const allocs = useAllocations(currentYM());
  const goals = useGoals();
  const debts = useDebts();
  const { scenarios, upsert, remove } = useScenarios();
  const [editing, setEditing] = useState<Scenario | null>(null);

  const base: Scenario | null = useMemo(() => {
    if (!allocs.data || !goals.data || !debts.data || !incomes.data) return null;
    const inc = currentIncomes(incomes.data, todayISO());
    const mainGoal = goals.data.find((g) => g.status === 'active' && g.target_amount) ?? goals.data[0];
    return {
      id: 'base', name: 'Situación actual',
      incomes: members.map((m) => ({ memberId: m.id, name: m.display_name, amount: inc[m.id] ?? 0 })),
      budget: allocs.data.map((a) => ({ categoryId: a.category_id, name: a.category_name, amount: Number(a.amount), shares: a.shares as Shares })),
      extraExpenses: 0,
      savingsMonthly: goals.data.filter((g) => g.status === 'active').reduce((s, g) => s + monthlyCommitment(g.commitments), 0),
      savingsGoal: mainGoal ? { name: mainGoal.name, target: Number(mainGoal.target_amount ?? 0), current: mainGoal.balance } : null,
      debts: debts.data.filter((d) => Number(d.balance) > 0 && Number(d.installment_amount) > 0).map((d) => ({ id: d.id!, name: d.name!, balance: Number(d.balance), annualRate: d.interest_rate, payment: Number(d.installment_amount), frequency: (d.frequency === 'one_time' ? 'monthly' : d.frequency) as Frequency, extra: 0 })),
    };
  }, [allocs.data, goals.data, debts.data, incomes.data, members]);

  if (!base) return <Screen header={<Header title="Simulador" back />}><Loading label="Preparando escenario base…" /></Screen>;
  const baseR = runScenario(base);
  const current = editing ?? base;
  const r = runScenario(current);
  const diff = compareScenarios(baseR, r);

  const upd = (patch: Partial<Scenario>) => setEditing({ ...current, ...patch, id: current.id === 'base' ? Crypto.randomUUID() : current.id, name: current.id === 'base' ? 'Nuevo escenario' : current.name });
  const num = (v: string) => parseAmount(v) ?? 0;

  return (
    <Screen testID="screen-simulator" header={<Header title="Simulador" subtitle="Hipotético: no cambia tus datos reales" back />}>
      <ChipRow>
        <Chip label="Situación actual" selected={!editing} onPress={() => setEditing(null)} />
        {scenarios.map((s) => <Chip key={s.id} label={s.name} selected={editing?.id === s.id} onPress={() => setEditing(s)} />)}
        <Chip label="Nuevo" icon="plus" onPress={() => setEditing({ ...JSON.parse(JSON.stringify(base)), id: Crypto.randomUUID(), name: `Escenario ${scenarios.length + 1}` })} />
      </ChipRow>
      <Banner tone="info" icon="calculator" title="Los cambios del simulador no alteran tus datos reales" message="Úsalo para probar ingresos, presupuestos, ahorros o abonos extra." />

      <Card tone="brand">
        <Text variant="overline" color="#C9CFEA">Disponible al mes</Text>
        <Money value={r.available} variant="amountXL" color={r.available >= 0 ? 'onBrand' : '#FF9B93'} />
        {editing && <Text variant="caption" color={diff.available >= 0 ? 'accent' : '#FF9B93'}>{diff.available >= 0 ? '+' : ''}{formatMoney(diff.available)} vs. situación actual</Text>}
        <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[3] }}>
          <View style={{ flex: 1 }}><Text variant="caption" color="#C9CFEA">Ingresos</Text><Money value={r.totalIncome} variant="amountS" color="onBrand" compact /></View>
          <View style={{ flex: 1 }}><Text variant="caption" color="#C9CFEA">Presupuesto</Text><Money value={r.totalBudget} variant="amountS" color="onBrand" compact /></View>
          <View style={{ flex: 1 }}><Text variant="caption" color="#C9CFEA">Ahorro</Text><Money value={r.savings} variant="amountS" color="onBrand" compact /></View>
        </View>
      </Card>

      <View>
        <SectionHeader title="Aportación de cada uno" />
        <Card>
          {r.perMember.map((m) => (
            <View key={m.memberId} style={{ paddingVertical: space[1] }}>
              <KeyValue label={m.name}><Money value={m.contribution} variant="amountS" /></KeyValue>
              <Text variant="caption" color="textSecondary">{formatPct(m.share)} de su ingreso · le quedan {formatMoney(m.remaining)}</Text>
            </View>
          ))}
        </Card>
      </View>

      <View>
        <SectionHeader title="Proyecciones" />
        <Card>
          <KeyValue label="Ahorro en 12 meses" value={formatMoney(r.savingsIn12Months)} />
          {current.savingsGoal && <KeyValue label={`Tiempo para "${current.savingsGoal.name}"`} value={r.monthsToSavingsGoal === null ? 'Sin aporte' : r.monthsToSavingsGoal === 0 ? 'Lograda' : `${r.monthsToSavingsGoal} meses (${formatDate(addMonthsISO(todayISO(), r.monthsToSavingsGoal), 'day')} ${addMonthsISO(todayISO(), r.monthsToSavingsGoal).slice(0, 4)})`} />}
          {r.debtPayoff.map((d) => <KeyValue key={d.id} label={`Liquidar ${d.name}`} value={Number.isFinite(d.periods) ? `${d.periods} cuotas` : 'Inviable'} />)}
        </Card>
      </View>

      {editing ? (
        <>
          <SectionHeader title="Ajustar escenario" />
          <Card>
            <View style={{ gap: space[3] }}>
              <Input label="Nombre del escenario" value={current.name} onChangeText={(v) => setEditing({ ...current, name: v })} />
              {current.incomes.map((i, idx) => (
                <Input key={i.memberId} label={`Ingreso de ${i.name}`} defaultValue={String(i.amount)} keyboardType="decimal-pad" onChangeText={(v) => upd({ incomes: current.incomes.map((x, j) => (j === idx ? { ...x, amount: num(v) } : x)) })} />
              ))}
              <Divider />
              {current.budget.map((b, idx) => (
                <Input key={b.categoryId} label={`Presupuesto · ${b.name}`} defaultValue={String(b.amount)} keyboardType="decimal-pad" onChangeText={(v) => upd({ budget: current.budget.map((x, j) => (j === idx ? { ...x, amount: num(v) } : x)) })} />
              ))}
              <Divider />
              <Input label="Gastos adicionales al mes" defaultValue={String(current.extraExpenses)} keyboardType="decimal-pad" onChangeText={(v) => upd({ extraExpenses: num(v) })} />
              <Input label="Ahorro mensual" defaultValue={String(current.savingsMonthly)} keyboardType="decimal-pad" onChangeText={(v) => upd({ savingsMonthly: num(v) })} />
              {current.debts.map((d, idx) => (
                <Input key={d.id} label={`Abono extra · ${d.name} (cuota ${formatMoney(d.payment)})`} defaultValue={String(d.extra)} keyboardType="decimal-pad" onChangeText={(v) => upd({ debts: current.debts.map((x, j) => (j === idx ? { ...x, extra: num(v) } : x)) })} />
              ))}
            </View>
          </Card>
          <Card tone="alt">
            <Text variant="label">Diferencia vs. situación actual</Text>
            <KeyValue label="Ingresos" value={`${diff.income >= 0 ? '+' : ''}${formatMoney(diff.income)}`} />
            <KeyValue label="Presupuesto" value={`${diff.budget >= 0 ? '+' : ''}${formatMoney(diff.budget)}`} />
            <KeyValue label="Ahorro" value={`${diff.savings >= 0 ? '+' : ''}${formatMoney(diff.savings)}`} />
            <KeyValue label="Disponible" value={`${diff.available >= 0 ? '+' : ''}${formatMoney(diff.available)}`} />
          </Card>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Button title="Guardar escenario" icon="check" full={false} style={{ flex: 2 }} onPress={() => { upsert(current); toast.success('Escenario guardado en este teléfono'); }} />
            {scenarios.some((s) => s.id === current.id) && <IconButton icon="trash" label="Eliminar escenario" tone="soft" onPress={() => { remove(current.id); setEditing(null); }} />}
          </View>
        </>
      ) : (
        <Button title="Crear un escenario" icon="plus" onPress={() => setEditing({ ...JSON.parse(JSON.stringify(base)), id: Crypto.randomUUID(), name: `Escenario ${scenarios.length + 1}` })} />
      )}
    </Screen>
  );
}
