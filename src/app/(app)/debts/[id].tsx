import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useDebt, useFinanceMutation, useTransactions } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { TxRow } from '../../../components/finance';
import { Banner, Button, Card, ConfirmSheet, Divider, EmptyState, ErrorState, Header, IconButton, IconTile, Input, KeyValue, Loading, Money, ProgressBar, Screen, SectionHeader, StatusPill, Text } from '../../../components/ui';
import { installmentSchedule, payoffDate, simulatePayoff } from '../../../domain/debts';
import { FREQUENCY_LABEL, formatDate, relativeDays, todayISO, type Frequency } from '../../../lib/dates';
import { DEBT_KIND } from '../../../lib/labels';
import { formatMoney, formatPct, parseAmount } from '../../../lib/money';
import { supabase, unwrap } from '../../../lib/supabase';
import { useTheme } from '../../../theme/ThemeProvider';
import { space } from '../../../theme/tokens';

export default function DebtDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { memberName } = useHH();
  const q = useDebt(id);
  const txs = useTransactions({ debtId: id, scope: q.data?.scope as 'household' | 'personal' | undefined, includeVoided: true }, !!q.data);
  const [extra, setExtra] = useState('');
  const [archive, setArchive] = useState(false);
  const arch = useFinanceMutation(
    async () => unwrap(await supabase.from('debts').update({ status: q.data?.status === 'archived' ? 'active' : 'archived' }).eq('id', id!).select('id')),
    { success: 'Deuda actualizada', onSuccess: () => setArchive(false) },
  );

  if (q.isPending) return <Screen header={<Header title="Deuda" back />}><Loading /></Screen>;
  if (!q.data) return <Screen header={<Header title="Deuda" back />}><ErrorState error={q.error} onRetry={q.refetch} /></Screen>;
  const d = q.data;
  const kind = DEBT_KIND[d.kind ?? 'other'];
  const balance = Number(d.balance);
  const totalOwed = Number(d.original_amount) + Number(d.interest_charged) + Number(d.fees_charged);
  const progress = totalOwed ? Number(d.paid) / totalOwed : 0;
  const freq = d.frequency as Frequency;
  const schedule = installmentSchedule({ startDate: d.start_date!, frequency: freq, installmentAmount: d.installment_amount, installmentsCount: d.installments_count, paid: Number(d.paid) });
  const payment = Number(d.installment_amount ?? 0);
  const base = payment > 0 ? simulatePayoff({ id: d.id!, name: d.name!, balance, annualRate: d.interest_rate, payment, frequency: freq === 'one_time' ? 'monthly' : freq }) : null;
  const extraN = parseAmount(extra) ?? 0;
  const withExtra = payment > 0 && extraN > 0 ? simulatePayoff({ id: d.id!, name: d.name!, balance, annualRate: d.interest_rate, payment, frequency: freq === 'one_time' ? 'monthly' : freq }, extraN) : null;
  const today = todayISO();

  return (
    <Screen header={<Header title={d.name!} subtitle={[kind.label, d.creditor, d.scope === 'personal' ? 'Privada' : null].filter(Boolean).join(' · ')} back right={<IconButton icon="edit" label="Editar" onPress={() => router.push(`/debts/new?id=${d.id}&scope=${d.scope}`)} />} />} refreshing={q.isRefetching} onRefresh={() => { q.refetch(); txs.refetch(); }}>
      <Card>
        <View style={{ gap: space[3] }}>
          <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
            <IconTile icon={kind.icon} color={colors.debt} size={48} />
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="textSecondary">Saldo pendiente</Text>
              <Money value={balance} variant="amountL" color={balance <= 0 ? 'positive' : 'debt'} />
            </View>
            {balance <= 0 && <StatusPill label="Saldada" tone="positive" icon="check" />}
          </View>
          <ProgressBar ratio={progress} color={colors.positive} showExcess={false} height={10} />
          <Text variant="caption" color="textSecondary">Pagado {formatMoney(d.paid)} ({formatPct(progress)}) de {formatMoney(totalOwed)}</Text>
          {d.next_due_date && balance > 0 && <Banner tone={d.next_due_date < today ? 'danger' : 'info'} icon="calendar" title={`Próxima cuota: ${formatDate(d.next_due_date, 'long')}`} message={`${relativeDays(d.next_due_date)}${d.installment_amount ? ` · ${formatMoney(d.installment_amount)}` : ''}`} />}
        </View>
      </Card>
      {balance > 0 && (
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Button testID="btn-debt-payment" title="Registrar abono" icon="check" full={false} style={{ flex: 2 }} onPress={() => router.push(`/transaction/new?type=debt_payment&debtId=${d.id}&scope=${d.scope}`)} />
          <Button title="Interés/recargo" variant="secondary" full={false} style={{ flex: 1.4 }} onPress={() => router.push(`/transaction/new?type=debt_charge&debtId=${d.id}&scope=${d.scope}`)} />
        </View>
      )}
      <Card>
        <KeyValue label="Monto original" value={formatMoney(d.original_amount)} />
        <KeyValue label="Interés anual" value={d.interest_rate != null ? `${d.interest_rate}%` : 'No registrado'} />
        <KeyValue label="Intereses cargados" value={formatMoney(d.interest_charged)} />
        <KeyValue label="Recargos" value={formatMoney(d.fees_charged)} />
        <KeyValue label="Cuota" value={d.installment_amount ? `${formatMoney(d.installment_amount)} · ${FREQUENCY_LABEL[freq]}` : '—'} />
        <KeyValue label="Fecha inicial" value={formatDate(d.start_date)} />
        {d.due_date && <KeyValue label="Vencimiento final" value={formatDate(d.due_date)} />}
        {d.scope === 'household' && <KeyValue label="Responsable" value={d.responsible_member_id ? memberName(d.responsible_member_id) : 'Compartida'} />}
      </Card>

      {base && balance > 0 && (
        <View>
          <SectionHeader title="Proyección de liquidación" />
          <Card>
            {base.feasible ? (
              <>
                <KeyValue label="Cuotas restantes" value={`${base.periods}`} />
                <KeyValue label="Fecha estimada" value={formatDate(payoffDate(today, freq === 'one_time' ? 'monthly' : freq, base.periods))} />
                <KeyValue label="Intereses estimados" value={d.interest_rate ? formatMoney(base.totalInterest) : 'Sin tasa registrada'} />
              </>
            ) : <Banner tone="warning" title="La cuota no cubre los intereses" message="Con esta cuota la deuda no se liquidaría. Considera abonos adicionales." />}
            <Divider />
            <Input label="Simular abono adicional por cuota (RD$)" value={extra} onChangeText={setExtra} keyboardType="decimal-pad" />
            {withExtra && withExtra.feasible && base.feasible && (
              <Banner tone="success" title={`Terminarías ${base.periods - withExtra.periods} cuota(s) antes`} message={`Nueva fecha: ${formatDate(payoffDate(today, freq === 'one_time' ? 'monthly' : freq, withExtra.periods))}${d.interest_rate ? ` · Ahorro en intereses: ${formatMoney(base.totalInterest - withExtra.totalInterest)}` : ''}`} />
            )}
          </Card>
        </View>
      )}

      {schedule.length > 0 && (
        <View>
          <SectionHeader title="Cuotas" subtitle={`${schedule.filter((s) => s.status === 'paid').length} de ${schedule.length} pagadas`} />
          <Card>
            {schedule.map((s) => (
              <View key={s.number} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44 }}>
                <Text variant="label" color="textSecondary" style={{ width: 28 }}>#{s.number}</Text>
                <Text variant="body" style={{ flex: 1 }}>{formatDate(s.dueDate)}</Text>
                <Money value={s.amount} variant="amountS" />
                <StatusPill small label={s.status === 'paid' ? 'Pagada' : s.status === 'partial' ? 'Parcial' : s.dueDate < today ? 'Vencida' : 'Pendiente'} tone={s.status === 'paid' ? 'positive' : s.status === 'partial' ? 'brand' : s.dueDate < today ? 'negative' : 'neutral'} />
              </View>
            ))}
          </Card>
        </View>
      )}

      <View>
        <SectionHeader title="Historial" />
        <Card>{txs.data?.length ? txs.data.map((t) => <TxRow key={t.id} tx={t} memberName={t.member_id ? memberName(t.member_id) : undefined} />) : <EmptyState compact icon="history" title="Sin abonos ni cargos" />}</Card>
      </View>
      <Button title={d.status === 'archived' ? 'Reactivar deuda' : 'Archivar deuda'} variant="ghost" icon="archive" onPress={() => setArchive(true)} />
      <ConfirmSheet visible={archive} onClose={() => setArchive(false)} title={d.status === 'archived' ? 'Reactivar deuda' : 'Archivar deuda'} message="El historial se conserva. Las deudas archivadas no aparecen en el resumen." onConfirm={() => arch.mutate(undefined as never)} loading={arch.isPending} />
    </Screen>
  );
}
