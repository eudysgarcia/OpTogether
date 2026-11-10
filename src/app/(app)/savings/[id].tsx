import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useFinanceMutation, useGoals, useTransactions } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { TxRow } from '../../../components/finance';
import { TrendLine } from '../../../components/charts/Charts';
import { Banner, Button, Card, ConfirmSheet, EmptyState, Header, Icon, IconButton, KeyValue, Loading, Money, Ring, Screen, SectionHeader, Text } from '../../../components/ui';
import { monthlyCommitment, projectGoal } from '../../../domain/savings';
import { MONTHS_SHORT, formatDate, todayISO } from '../../../lib/dates';
import { formatMoney, formatPct } from '../../../lib/money';
import { supabase, unwrap } from '../../../lib/supabase';
import { useTheme } from '../../../theme/ThemeProvider';
import { space } from '../../../theme/tokens';
import type { Scope } from '../../../types/models';

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { memberName, members } = useHH();
  const hh = useGoals('household', true);
  const pe = useGoals('personal', true);
  const g = [...(hh.data ?? []), ...(pe.data ?? [])].find((x) => x.id === id);
  const txs = useTransactions({ goalId: id, scope: g?.scope as Scope | undefined, limit: 200 }, !!g);
  const [confirm, setConfirm] = useState<'complete' | 'archive' | 'reactivate' | null>(null);
  const status = useFinanceMutation(
    async (s: string) => unwrap(await supabase.from('savings_goals').update({ status: s, completed_at: s === 'completed' ? new Date().toISOString() : null }).eq('id', id!).select('id')),
    { success: 'Meta actualizada', onSuccess: () => setConfirm(null) },
  );
  if (!g) return <Screen header={<Header title="Meta" back />}><Loading /></Screen>;
  const monthly = monthlyCommitment(g.commitments);
  const p = projectGoal({ balance: g.balance, target: g.target_amount ? Number(g.target_amount) : null, monthly, targetDate: g.target_date, today: todayISO() });
  const reached = !!g.target_amount && g.balance >= Number(g.target_amount);
  // Evolución acumulada por mes
  const byMonth = new Map<string, number>();
  for (const t of [...(txs.data ?? [])].reverse()) {
    const k = t.occurred_on.slice(0, 7);
    byMonth.set(k, (byMonth.get(k) ?? 0) + (t.type === 'savings_deposit' ? Number(t.amount) : -Number(t.amount)));
  }
  let acc = 0;
  const evo = [...byMonth.entries()].sort().map(([k, v]) => { acc += v; return { label: MONTHS_SHORT[Number(k.slice(5)) - 1], value: acc }; }).slice(-6);

  return (
    <Screen header={<Header title={g.name} subtitle={g.scope === 'personal' ? 'Privada' : 'Compartida'} back right={<IconButton icon="edit" label="Editar" onPress={() => router.push(`/savings/new?id=${g.id}&scope=${g.scope}`)} />} />} refreshing={txs.isRefetching} onRefresh={() => { hh.refetch(); pe.refetch(); txs.refetch(); }}>
      <Card>
        <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[2] }}>
          <Ring ratio={p.progress} size={140} stroke={12} color={colors.savings}>
            <Animated.View entering={ZoomIn.springify()} style={{ alignItems: 'center' }}>
              <Icon name={g.icon} size={28} color={colors.savings} />
              <Text variant="amountS" color="savings">{g.target_amount ? formatPct(p.progress) : ''}</Text>
            </Animated.View>
          </Ring>
          <Money value={g.balance} variant="amountXL" color="savings" />
          {g.target_amount && <Text variant="caption" color="textSecondary">de {formatMoney(g.target_amount)} · faltan {formatMoney(p.remaining)}</Text>}
          {reached && g.status === 'active' && <Banner tone="success" title="¡Meta alcanzada!" message="Pueden marcarla como completada." action="Completar" onPress={() => setConfirm('complete')} />}
        </View>
      </Card>
      {g.status !== 'archived' && (
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Button testID="btn-goal-deposit" title="Aportar" icon="plus" full={false} style={{ flex: 1 }} onPress={() => router.push(`/transaction/new?type=savings_deposit&goalId=${g.id}&scope=${g.scope}`)} />
          <Button title="Retirar / transferir" icon="arrow-out" variant="secondary" full={false} style={{ flex: 1 }} disabled={g.balance <= 0} onPress={() => router.push(`/transaction/new?type=savings_withdrawal&goalId=${g.id}&scope=${g.scope}`)} />
        </View>
      )}
      <Card>
        <KeyValue label="Aporte mensual comprometido" value={monthly ? formatMoney(monthly) : 'Sin definir'} />
        {Object.entries((g.commitments as Record<string, number>) ?? {}).map(([mid, v]) => <KeyValue key={mid} label={`· ${memberName(mid)}`} value={formatMoney(v)} />)}
        {p.projectedDate && <KeyValue label="Al ritmo actual llegan el" value={formatDate(p.projectedDate)} />}
        {g.target_date && <KeyValue label="Fecha objetivo" value={formatDate(g.target_date)} />}
        {p.requiredMonthly !== null && !reached && <KeyValue label="Necesario por mes para la fecha" value={formatMoney(p.requiredMonthly)} />}
        {p.onTrack === false && <Banner tone="warning" title="Van atrasados" message={`Para llegar a tiempo necesitan ${formatMoney(p.requiredMonthly)} al mes.`} />}
        {p.onTrack === true && !reached && <Banner tone="success" title="Van a tiempo" />}
        {members.length > 0 && <Text variant="caption" color="textTertiary">Total aportado: {formatMoney(g.deposits)} · Retirado: {formatMoney(g.withdrawals)}</Text>}
      </Card>
      {evo.length > 1 && <View><SectionHeader title="Evolución" /><Card><TrendLine data={evo} color={colors.savings} /></Card></View>}
      <View>
        <SectionHeader title="Historial" />
        <Card>{txs.data?.length ? txs.data.map((t) => <TxRow key={t.id} tx={t} memberName={t.member_id ? memberName(t.member_id) : undefined} />) : <EmptyState compact icon="piggy-bank" title="Sin aportes todavía" />}</Card>
      </View>
      {g.status === 'active' && <Button title="Marcar como completada" variant="ghost" icon="check-circle" onPress={() => setConfirm('complete')} />}
      {g.status !== 'archived' ? <Button title="Archivar meta" variant="ghost" icon="archive" onPress={() => setConfirm('archive')} /> : <Button title="Reactivar meta" variant="ghost" icon="refresh" onPress={() => setConfirm('reactivate')} />}
      <ConfirmSheet visible={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'complete' ? 'Completar meta' : confirm === 'archive' ? 'Archivar meta' : 'Reactivar meta'}
        message={confirm === 'archive' ? 'El saldo y el historial se conservan. Una meta archivada no recibe aportes.' : undefined} loading={status.isPending}
        onConfirm={() => status.mutate(confirm === 'complete' ? 'completed' : confirm === 'archive' ? 'archived' : 'active')} />
    </Screen>
  );
}
