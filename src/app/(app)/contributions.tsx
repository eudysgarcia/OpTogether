import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAllocations, useGoals, usePeriod, useTransactions } from '../../api/finance';
import { currentIncomes, useHH, useIncomes } from '../../api/household';
import { PeriodSelector, TxRow } from '../../components/finance';
import { StackedBar } from '../../components/charts/Charts';
import { Avatar, Banner, Button, Card, Divider, EmptyState, Header, KeyValue, ListSkeleton, Money, ProgressBar, Screen, SectionHeader, StatusPill, Text } from '../../components/ui';
import { computeContributions, contributionLabel } from '../../domain/contributions';
import { currentYM, monthRange } from '../../lib/dates';
import { formatMoney, formatPct } from '../../lib/money';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';
import type { Shares } from '../../types/models';

export default function Contributions() {
  const { colors } = useTheme();
  const { members, memberName } = useHH();
  const [ym, setYm] = useState(currentYM());
  const period = usePeriod(ym);
  const allocs = useAllocations(ym);
  const goals = useGoals();
  const incomes = useIncomes();
  const txs = useTransactions({ periodId: period.data, types: ['contribution', 'expense', 'refund', 'savings_deposit'], limit: 1000 }, !!period.data);
  const inc = currentIncomes(incomes.data, monthRange(ym).to);

  const rows = useMemo(() => computeContributions({
    members: members.map((m) => ({ id: m.id, display_name: m.display_name })),
    allocations: (allocs.data ?? []).map((a) => ({ amount: Number(a.amount), shares: a.shares as Shares })),
    savingsCommitments: (goals.data ?? []).filter((g) => g.status === 'active').map((g) => g.commitments as Record<string, number>),
    transactions: (txs.data ?? []).map((t) => ({ type: t.type, amount: Number(t.amount), member_id: t.member_id, fund_id: t.fund_id, status: t.status, scope: t.scope })),
  }), [members, allocs.data, goals.data, txs.data]);
  const contribTx = (txs.data ?? []).filter((t) => t.type === 'contribution');
  const totalExpected = rows.reduce((a, r) => a + r.expected, 0);

  return (
    <Screen testID="screen-contributions" header={<Header title="Aportaciones" back />} refreshing={txs.isRefetching} onRefresh={() => { txs.refetch(); allocs.refetch(); }}>
      <View style={{ alignItems: 'center' }}><PeriodSelector value={ym} onChange={setYm} /></View>
      <Banner tone="info" title="Aportar no es gastar" message="Lo esperado sale del presupuesto y la distribución de cada categoría, más los compromisos de ahorro. Los pagos directos de gastos del hogar cuentan como aportación." />
      {totalExpected > 0 && (
        <Card>
          <Text variant="label" color="textSecondary">Distribución esperada</Text>
          <View style={{ marginVertical: space[3] }}>
            <StackedBar parts={rows.map((r, i) => ({ value: r.expected, color: members.find((m) => m.id === r.memberId)?.color ?? (i ? colors.accent : colors.brand), label: r.name }))} />
          </View>
          {rows.map((r) => <KeyValue key={r.memberId} label={`${r.name} · ${formatPct(r.expected / totalExpected)}`} value={formatMoney(r.expected)} />)}
        </Card>
      )}
      {allocs.isPending || txs.isPending ? <ListSkeleton rows={2} /> : rows.map((r) => {
        const m = members.find((x) => x.id === r.memberId);
        const lab = contributionLabel(r.difference);
        const income = inc[r.memberId];
        return (
          <Card key={r.memberId}>
            <View style={{ gap: space[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <Avatar name={r.name} color={m?.color} size={42} />
                <View style={{ flex: 1 }}>
                  <Text variant="h3">{r.name}</Text>
                  {income ? <Text variant="caption" color="textSecondary">Ingreso {formatMoney(income)} · aporta {formatPct(r.expected / income)}</Text> : null}
                </View>
                <StatusPill small label={lab.text} tone={lab.tone === 'positive' ? 'positive' : lab.tone === 'warning' ? 'warning' : 'neutral'} icon={lab.tone === 'neutral' ? 'check' : lab.tone === 'positive' ? 'trending-up' : 'clock'} />
              </View>
              <ProgressBar ratio={r.expected ? r.actual / r.expected : 0} color={colors.contribution} showExcess={false} />
              <KeyValue label="Esperado"><Money value={r.expected} variant="amountS" /></KeyValue>
              <Text variant="caption" color="textTertiary">Presupuesto {formatMoney(r.expectedBudget)} + ahorro {formatMoney(r.expectedSavings)}</Text>
              <Divider />
              <KeyValue label="Aportaciones"><Money value={r.contributed} variant="amountS" color="contribution" /></KeyValue>
              <KeyValue label="Pagos directos"><Money value={r.directPayments} variant="amountS" /></KeyValue>
              <KeyValue label="Ahorro directo"><Money value={r.savingsDirect} variant="amountS" color="savings" /></KeyValue>
              <Divider />
              <KeyValue label={r.difference >= 0 ? 'Saldo a favor' : 'Pendiente por aportar'}><Money value={Math.abs(r.difference)} variant="amountM" color={r.difference >= 0 ? 'positive' : 'warning'} /></KeyValue>
            </View>
          </Card>
        );
      })}
      <Text variant="caption" color="textSecondary">Las diferencias son saldos por compensar entre ustedes. No se convierten automáticamente en deudas personales.</Text>
      <View style={{ gap: space[2] }}>
        <Button title="Registrar aportación" icon="hand-coins" onPress={() => router.push('/transaction/new?type=contribution')} />
        <Button title="Registrar pago directo de un servicio" icon="receipt" variant="secondary" onPress={() => router.push('/payments')} />
        <Button title="Registrar adelanto del próximo mes" icon="calendar" variant="secondary" onPress={() => router.push('/transaction/new?type=contribution')} />
      </View>
      <View>
        <SectionHeader title="Aportaciones del periodo" />
        <Card>{contribTx.length ? contribTx.map((t) => <TxRow key={t.id} tx={t} memberName={memberName(t.member_id)} />) : <EmptyState compact icon="hand-coins" title="Sin aportaciones registradas" />}</Card>
      </View>
    </Screen>
  );
}
