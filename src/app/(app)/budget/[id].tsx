import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useAllocation, useAllocations, useAllocationsHistory, useBudgetMoves, useCategories, useFinanceMutation, useFunds, useGoals, useTransactions } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { TxRow } from '../../../components/finance';
import { TrendLine } from '../../../components/charts/Charts';
import {
  Banner, Button, Card, ConfirmSheet, Divider, EmptyState, ErrorState, Header, IconButton, IconTile, Input, KeyValue, ListRow, Loading, Money,
  ProgressBar, Screen, SectionHeader, Select, Sheet, StatusPill, Switch, Text,
} from '../../../components/ui';
import { allocationFigures, sharesSumOk, splitAmount } from '../../../domain/budget';
import { MONTHS_SHORT, capitalize, monthRange, ymLabel } from '../../../lib/dates';
import { BUDGET_STATUS_UI } from '../../../lib/labels';
import { formatMoney, formatPct, parseAmount } from '../../../lib/money';
import { supabase, unwrap } from '../../../lib/supabase';
import { space } from '../../../theme/tokens';
import type { Shares } from '../../../types/models';

type Action = 'to_fund' | 'to_savings' | 'rollover' | 'reassign' | 'from_fund' | 'compensate' | 'adjust' | null;

const MOVE_LABEL: Record<string, string> = {
  reassign: 'Reasignación', rollover: 'Reservado para el próximo mes', to_fund: 'Transferido a fondo', to_savings: 'Transferido a ahorro', from_fund: 'Cubierto con fondo',
};

export default function AllocationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { members, memberName } = useHH();
  const a = useAllocation(id);
  const ym = a.data ? { year: a.data.year, month: a.data.month } : { year: 2000, month: 1 };
  const siblings = useAllocations(ym);
  const cats = useCategories();
  const funds = useFunds();
  const goals = useGoals();
  const moves = useBudgetMoves(id);
  const history = useAllocationsHistory(a.data?.category_id, 6);
  const range = monthRange(ym);
  const txs = useTransactions({ from: range.from, to: range.to, types: ['expense', 'refund'] }, !!a.data);
  const [action, setAction] = useState<Action>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState<string | null>(null);
  const [voidMove, setVoidMove] = useState<string | null>(null);
  const [editShares, setEditShares] = useState<Record<string, string> | null>(null);
  const [recurring, setRecurring] = useState<boolean | null>(null);

  const move = useFinanceMutation(
    async (v: { kind: string; from?: string; to?: string; fund?: string; goal?: string }) =>
      unwrap(await supabase.rpc('move_budget', {
        p_kind: v.kind, p_amount: parseAmount(amount) ?? 0, p_reason: reason,
        p_from_allocation: v.from, p_to_allocation: v.to, p_fund: v.fund, p_goal: v.goal,
      })),
    { success: 'Movimiento de presupuesto registrado', onSuccess: () => closeAction() },
  );
  const adjust = useFinanceMutation(
    async () => unwrap(await supabase.rpc('adjust_allocation', { p_allocation: id!, p_amount: parseAmount(amount) ?? -1, p_reason: reason })),
    { success: 'Presupuesto ajustado', onSuccess: () => closeAction() },
  );
  const voidM = useFinanceMutation(
    async (v: { id: string; reason: string }) => unwrap(await supabase.rpc('void_budget_move', { p_move: v.id, p_reason: v.reason })),
    { success: 'Movimiento revertido', onSuccess: () => setVoidMove(null) },
  );
  const saveMeta = useFinanceMutation(
    async (patch: { shares?: Shares; is_recurring?: boolean }) => unwrap(await supabase.from('budget_allocations').update(patch).eq('id', id!).select('id')),
    { success: 'Cambios guardados', onSuccess: () => setEditShares(null) },
  );

  const closeAction = () => { setAction(null); setAmount(''); setReason(''); setTarget(null); };

  if (a.isPending) return <Screen header={<Header title="Categoría" back />}><Loading /></Screen>;
  if (a.error || !a.data) return <Screen header={<Header title="Categoría" back />}><ErrorState error={a.error} onRetry={a.refetch} /></Screen>;

  const al = a.data;
  const f = allocationFigures(al.effective_amount, al.spent);
  const ui = BUDGET_STATUS_UI[f.status];
  const ids = members.map((m) => m.id);
  const parts = splitAmount(Number(al.effective_amount), al.shares as Shares, ids);
  const catIds = new Set((cats.data ?? []).filter((c) => c.id === al.category_id || c.parent_id === al.category_id).map((c) => c.id));
  const catTx = (txs.data ?? []).filter((t) => t.category_id && catIds.has(t.category_id));
  const otherAllocs = (siblings.data ?? []).filter((x) => x.id !== al.id);
  const fundOpts = (funds.data ?? []).map((x) => ({ value: x.id, label: x.name, icon: x.icon, description: `Saldo: ${formatMoney(x.balance)}` }));
  const goalOpts = (goals.data ?? []).filter((g) => g.status === 'active').map((g) => ({ value: g.id, label: g.name, icon: g.icon }));
  const allocOpts = otherAllocs.map((x) => {
    const ff = allocationFigures(x.effective_amount, x.spent);
    return { value: x.id, label: x.category_name, icon: x.category_icon, color: x.category_color, description: `Disponible: ${formatMoney(ff.available)}` };
  });

  const submitAction = () => {
    if (action === 'adjust') return adjust.mutate(undefined as never);
    if (action === 'to_fund') return move.mutate({ kind: 'to_fund', from: al.id, fund: target! });
    if (action === 'to_savings') return move.mutate({ kind: 'to_savings', from: al.id, goal: target! });
    if (action === 'rollover') return move.mutate({ kind: 'rollover', from: al.id });
    if (action === 'reassign') return move.mutate({ kind: 'reassign', from: al.id, to: target! });
    if (action === 'from_fund') return move.mutate({ kind: 'from_fund', to: al.id, fund: target! });
    if (action === 'compensate') return move.mutate({ kind: 'reassign', from: target!, to: al.id });
  };
  const needsTarget = action && !['rollover', 'adjust'].includes(action);
  const canSubmit = (parseAmount(amount) ?? 0) > 0 && reason.trim().length >= 3 && (!needsTarget || !!target) || (action === 'adjust' && parseAmount(amount) !== null && reason.trim().length >= 3);

  const ACTION_TITLE: Record<string, string> = {
    to_fund: 'Transferir sobrante a un fondo', to_savings: 'Transferir sobrante a ahorro', rollover: 'Reservar para el próximo mes', reassign: 'Reasignar a otra categoría',
    from_fund: 'Cubrir exceso con un fondo', compensate: 'Compensar con otra categoría', adjust: 'Ajustar presupuesto',
  };

  return (
    <Screen header={<Header title={al.category_name} subtitle={capitalize(ymLabel(ym))} back />} refreshing={a.isRefetching} onRefresh={() => { a.refetch(); txs.refetch(); moves.refetch(); }}>
      <Card>
        <View style={{ gap: space[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <IconTile icon={al.category_icon} color={al.category_color} size={48} />
            <View style={{ flex: 1, gap: 4 }}>
              <StatusPill label={ui.label} tone={ui.tone} icon={ui.icon} />
              <Text variant="caption" color="textSecondary">{al.tx_count ?? 0} gasto(s) este mes</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <Fig label="Presupuesto" value={f.budget} color="budget" />
            <Fig label="Gasto real" value={f.spent} color="text" />
            <Fig label={f.excess ? 'Exceso' : 'Disponible'} value={f.excess || f.available} color={f.excess ? 'excess' : 'available'} />
          </View>
          <ProgressBar ratio={f.ratio} height={10} accessibilityLabel={`Consumido ${formatPct(f.ratio)}`} />
          <Text variant="caption" color="textSecondary">{formatPct(f.ratio)} consumido{Number(al.moved_in) || Number(al.moved_out) ? ` · Original ${formatMoney(al.amount)}${Number(al.moved_in) ? `, +${formatMoney(al.moved_in)} recibido` : ''}${Number(al.moved_out) ? `, −${formatMoney(al.moved_out)} movido` : ''}` : ''}</Text>
          {Number(al.extraordinary_spent) > 0 && <Text variant="caption" color="warning">Extraordinarios (no consumen este presupuesto): {formatMoney(al.extraordinary_spent)}</Text>}
        </View>
      </Card>

      {f.excess > 0 && (
        <View style={{ gap: space[2] }}>
          <Banner tone="danger" title={`Exceso de ${formatMoney(f.excess)}`} message="El gasto quedó registrado. Elige cómo resolverlo; nada se ajusta sin tu confirmación." />
          <Card>
            <ListRow icon="coins" title="Cubrir con dinero disponible" subtitle="Usa el saldo de un fondo (p. ej. fondo común)" onPress={() => { setAction('from_fund'); setAmount(String(f.excess)); }} />
            <Divider inset={52} />
            <ListRow icon="split" title="Compensar con otra categoría" subtitle="Toma el sobrante de otra categoría del mes" onPress={() => { setAction('compensate'); setAmount(String(f.excess)); }} />
            <Divider inset={52} />
            <ListRow icon="edit" title="Ajustar el presupuesto" subtitle="Cambia el monto planificado (queda auditado)" onPress={() => { setAction('adjust'); setAmount(String(Number(al.amount) + f.excess)); }} />
            <Divider inset={52} />
            <ListRow icon="alert" title="Marcar un gasto como extraordinario" subtitle="Abre el gasto y actívalo en Editar" onPress={() => catTx[0] && router.push(`/transaction/${catTx[0].id}`)} />
          </Card>
        </View>
      )}

      {f.available > 0 && (
        <View>
          <SectionHeader title="Sobrante disponible" subtitle={`${formatMoney(f.available)} sin gastar`} />
          <Card>
            <ListRow icon="check" title="Conservarlo" subtitle="Sigue disponible en esta categoría este mes" />
            <Divider inset={52} />
            <ListRow icon="users" title="Transferir a un fondo" subtitle="Fondo común, emergencia u otro" onPress={() => { setAction('to_fund'); setAmount(String(f.available)); setTarget(funds.data?.find((x) => x.kind === 'common')?.id ?? null); }} />
            <Divider inset={52} />
            <ListRow icon="piggy-bank" title="Transferir a ahorro" onPress={() => { setAction('to_savings'); setAmount(String(f.available)); setTarget(goals.data?.[0]?.id ?? null); }} />
            <Divider inset={52} />
            <ListRow icon="calendar" title="Reservar para el próximo mes" onPress={() => { setAction('rollover'); setAmount(String(f.available)); }} />
            <Divider inset={52} />
            <ListRow icon="transfer" title="Reasignar a otra categoría" onPress={() => { setAction('reassign'); setAmount(String(f.available)); }} />
          </Card>
        </View>
      )}

      <View>
        <SectionHeader title="Distribución" action="Editar" onAction={() => setEditShares(Object.fromEntries(ids.map((mid) => [mid, String((al.shares as Shares)?.[mid] ?? (100 / ids.length))])))} />
        <Card>
          {members.map((m) => (
            <KeyValue key={m.id} label={`${m.display_name} · ${(al.shares as Shares)?.[m.id] ?? Math.round(100 / members.length)}%`}><Money value={parts[m.id]} variant="amountS" /></KeyValue>
          ))}
          <Divider />
          <Switch label="Presupuesto recurrente" description="Se copia automáticamente al mes siguiente" value={recurring ?? al.is_recurring} onChange={(v) => { setRecurring(v); saveMeta.mutate({ is_recurring: v }); }} />
          <Button title="Ajustar monto" variant="secondary" icon="edit" size="md" onPress={() => { setAction('adjust'); setAmount(String(al.amount)); }} />
        </Card>
      </View>

      <View>
        <SectionHeader title="Gastos del mes" action="Registrar" onAction={() => router.push(`/transaction/new?type=expense&categoryId=${al.category_id}`)} />
        <Card>
          {catTx.length ? catTx.map((t) => <TxRow key={t.id} tx={t} category={cats.data?.find((c) => c.id === t.category_id)} memberName={t.member_id ? memberName(t.member_id) : undefined} />) : (
            <EmptyState compact icon="receipt" title="Sin gastos en esta categoría" message="El presupuesto no se consume hasta que registres gastos reales." />
          )}
        </Card>
      </View>

      {(history.data?.length ?? 0) > 1 && (
        <View>
          <SectionHeader title="Últimos meses" subtitle="Gasto real por mes" />
          <Card>
            <TrendLine data={[...history.data!].reverse().map((h) => ({ label: MONTHS_SHORT[h.month - 1], value: Number(h.spent) }))} />
          </Card>
        </View>
      )}

      {(moves.data?.length ?? 0) > 0 && (
        <View>
          <SectionHeader title="Ajustes y traslados" />
          <Card>
            {moves.data!.map((m) => (
              <ListRow
                key={m.id}
                icon={m.to_allocation_id === al.id ? 'arrow-in' : 'arrow-out'}
                title={`${MOVE_LABEL[m.kind]} · ${formatMoney(m.amount)}`}
                subtitle={`${m.reason}${m.voided_at ? ' · REVERTIDO' : ''}`}
                right={!m.voided_at ? <IconButton icon="undo" label="Revertir" onPress={() => setVoidMove(m.id)} /> : <StatusPill small label="Revertido" tone="neutral" />}
              />
            ))}
          </Card>
        </View>
      )}

      <Sheet visible={!!action} onClose={closeAction} title={action ? ACTION_TITLE[action] : ''}
        footer={<Button title="Confirmar" icon="check" disabled={!canSubmit} loading={move.isPending || adjust.isPending} onPress={submitAction} />}>
        {action === 'adjust' ? (
          <Input label="Nuevo presupuesto (RD$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" helper={`Actual: ${formatMoney(al.amount)}`} />
        ) : (
          <Input label="Monto (RD$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" helper={action === 'from_fund' || action === 'compensate' ? `Exceso: ${formatMoney(f.excess)}` : `Disponible: ${formatMoney(f.available)}`} />
        )}
        {(action === 'to_fund' || action === 'from_fund') && <Select label="Fondo" value={target} options={fundOpts} onChange={setTarget} />}
        {action === 'to_savings' && <Select label="Meta de ahorro" value={target} options={goalOpts} onChange={setTarget} />}
        {(action === 'reassign' || action === 'compensate') && <Select label={action === 'reassign' ? 'Categoría destino' : 'Tomar de la categoría'} value={target} options={allocOpts} onChange={setTarget} />}
        <Input label="Motivo" required value={reason} onChangeText={setReason} placeholder="Ej.: Sobró del súper" maxLength={300} />
        <Text variant="caption" color="textSecondary">
          {action === 'to_fund' || action === 'to_savings' ? 'Es una transferencia: no genera un gasto adicional.' : action === 'from_fund' ? 'Se descuenta del fondo y aumenta el presupuesto de esta categoría.' : 'Queda registrado quién lo hizo y por qué.'}
        </Text>
      </Sheet>

      <ConfirmSheet visible={!!voidMove} onClose={() => setVoidMove(null)} title="Revertir ajuste" message="Se anula el traslado y, si movió dinero a un fondo o ahorro, también ese movimiento." requireReason danger confirmLabel="Revertir" loading={voidM.isPending} onConfirm={(r) => voidM.mutate({ id: voidMove!, reason: r })} />

      <Sheet visible={!!editShares} onClose={() => setEditShares(null)} title="Distribución" subtitle="Porcentaje que aporta cada persona"
        footer={<Button title="Guardar distribución" loading={saveMeta.isPending} disabled={!editShares || !sharesSumOk(Object.fromEntries(Object.entries(editShares).map(([k, v]) => [k, Number(v)])))} onPress={() => saveMeta.mutate({ shares: Object.fromEntries(Object.entries(editShares!).map(([k, v]) => [k, Number(v)])) })} />}>
        {editShares && members.map((m) => (
          <Input key={m.id} label={`${m.display_name} (%)`} value={editShares[m.id]} keyboardType="decimal-pad" onChangeText={(v) => setEditShares({ ...editShares, [m.id]: v })} />
        ))}
        {editShares && <Text variant="caption" color={sharesSumOk(Object.fromEntries(Object.entries(editShares).map(([k, v]) => [k, Number(v)]))) ? 'positive' : 'negative'}>Suma: {Object.values(editShares).reduce((s, v) => s + (Number(v) || 0), 0)}% (debe ser 100%)</Text>}
      </Sheet>
    </Screen>
  );
}

function Fig({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="caption" color="textSecondary">{label}</Text>
      <Money value={value} variant="amountS" color={color} compact />
    </View>
  );
}
