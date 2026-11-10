import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useBill, useBillCycles, useFinanceMutation, useTransactions, useCategories } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { BillCycleRow, TxRow } from '../../../components/finance';
import { Banner, Button, Card, ConfirmSheet, DateField, Divider, EmptyState, ErrorState, Header, IconButton, IconTile, KeyValue, Loading, Money, Screen, SectionHeader, Sheet, StatusPill, Text } from '../../../components/ui';
import { FREQUENCY_LABEL, formatDate, type Frequency } from '../../../lib/dates';
import { BILL_KIND, BILL_STATUS_UI } from '../../../lib/labels';
import { formatMoney } from '../../../lib/money';
import { db, unwrap } from '../../../lib/api';
import { space } from '../../../theme/tokens';
import type { BillCycleRow as Cycle } from '../../../types/models';

export default function BillDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { memberName } = useHH();
  const bill = useBill(id);
  const cycles = useBillCycles({ billId: id });
  const cats = useCategories(true);
  const [sel, setSel] = useState<Cycle | null>(null);
  const [resched, setResched] = useState<Cycle | null>(null);
  const [newDate, setNewDate] = useState('');
  const [cancel, setCancel] = useState<Cycle | null>(null);
  const current = (cycles.data ?? []).find((c) => ['overdue', 'due_soon', 'pending', 'partial'].includes(c.status ?? ''));
  const payments = useTransactions({ types: ['expense'], limit: 100 }, !!bill.data);
  const cycleIds = new Set((cycles.data ?? []).map((c) => c.id));
  const billPayments = (payments.data ?? []).filter((t) => t.bill_cycle_id && cycleIds.has(t.bill_cycle_id));

  const nextCycle = useFinanceMutation(async () => unwrap(await db.rpc('create_next_bill_cycle', { p_bill: id! })), { success: 'Siguiente ciclo creado' });
  const reschedule = useFinanceMutation(
    async (v: { id: string; date: string }) => unwrap(await db.from('bill_cycles').update({ due_date: v.date }).eq('id', v.id).select('id')),
    { success: 'Vencimiento reprogramado', onSuccess: () => setResched(null) },
  );
  const cancelCycle = useFinanceMutation(
    async (v: { id: string; note: string }) => unwrap(await db.from('bill_cycles').update({ cancelled_at: new Date().toISOString(), note: v.note }).eq('id', v.id).select('id')),
    { success: 'Ciclo cancelado', onSuccess: () => setCancel(null) },
  );

  if (bill.isPending) return <Screen header={<Header title="Servicio" back />}><Loading /></Screen>;
  if (!bill.data) return <Screen header={<Header title="Servicio" back />}><ErrorState error={bill.error} onRetry={bill.refetch} /></Screen>;
  const b = bill.data;
  const kind = BILL_KIND[b.kind] ?? BILL_KIND.other;
  const pending = current ? Math.max(Number(current.expected_amount) - Number(current.paid_amount), 0) : 0;

  return (
    <Screen header={<Header title={b.name} subtitle={b.provider ?? kind.label} back right={<IconButton icon="edit" label="Editar servicio" onPress={() => router.push(`/payments/new?id=${b.id}`)} />} />} refreshing={cycles.isRefetching} onRefresh={cycles.refetch}>
      {current ? (
        <Card>
          <View style={{ gap: space[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <IconTile icon={kind.icon} size={48} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="caption" color="textSecondary">Vence {formatDate(current.due_date, 'long')}</Text>
                <StatusPill label={BILL_STATUS_UI[current.status!].label} tone={BILL_STATUS_UI[current.status!].tone} icon={BILL_STATUS_UI[current.status!].icon} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View><Text variant="caption" color="textSecondary">Estimado</Text><Money value={current.expected_amount} variant="amountM" /></View>
              <View style={{ alignItems: 'flex-end' }}><Text variant="caption" color="textSecondary">Pagado</Text><Money value={current.paid_amount} variant="amountM" color="positive" /></View>
            </View>
            <Button testID="btn-pay-bill" title={Number(current.paid_amount) > 0 ? `Registrar otro pago (resta ${formatMoney(pending)})` : 'Registrar pago'} icon="check" onPress={() => router.push(`/transaction/new?billCycleId=${current.id}`)} />
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <Button title="Reprogramar" icon="calendar" variant="secondary" size="md" full={false} style={{ flex: 1 }} onPress={() => { setResched(current); setNewDate(current.due_date!); }} />
              <Button title="Cancelar ciclo" icon="ban" variant="outline" size="md" full={false} style={{ flex: 1 }} onPress={() => setCancel(current)} />
            </View>
          </View>
        </Card>
      ) : (
        <Banner tone="success" title="Al día" message="No hay ciclos pendientes de este servicio." />
      )}
      <Card>
        <KeyValue label="Monto estimado" value={`${formatMoney(b.estimated_amount)} (${b.amount_type === 'fixed' ? 'fijo' : 'variable'})`} />
        <KeyValue label="Vence" value={`Día ${b.due_day} · ${FREQUENCY_LABEL[b.frequency as Frequency]}`} />
        <KeyValue label="Responsable" value={b.responsible_member_id ? memberName(b.responsible_member_id) : 'Ambos'} />
        <KeyValue label="Categoría" value={cats.data?.find((c) => c.id === b.category_id)?.name ?? '—'} />
        <KeyValue label="Recordatorios" value={b.reminder_offsets.map((o) => (o > 0 ? `${o}d antes` : o === 0 ? 'el día' : `${-o}d después`)).join(', ')} />
      </Card>
      <View>
        <SectionHeader title="Ciclos" action="Crear siguiente" onAction={() => nextCycle.mutate(undefined as never)} />
        <Card>
          {cycles.data?.length ? [...cycles.data].reverse().map((c, i) => (
            <View key={c.id}>{i > 0 && <Divider inset={58} />}<BillCycleRow c={c} onPress={() => setSel(c)} /></View>
          )) : <EmptyState compact icon="calendar" title="Sin ciclos" />}
        </Card>
      </View>
      <View>
        <SectionHeader title="Historial de pagos" />
        <Card>{billPayments.length ? billPayments.map((t) => <TxRow key={t.id} tx={t} memberName={t.member_id ? memberName(t.member_id) : undefined} />) : <EmptyState compact icon="receipt" title="Sin pagos registrados" />}</Card>
      </View>

      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel ? `Ciclo ${formatDate(sel.due_date)}` : ''}>
        {sel && (
          <>
            <KeyValue label="Estado" value={BILL_STATUS_UI[sel.status!].label} />
            <KeyValue label="Estimado" value={formatMoney(sel.expected_amount)} />
            <KeyValue label="Pagado" value={formatMoney(sel.paid_amount)} />
            {sel.original_due_date !== sel.due_date && <KeyValue label="Fecha original" value={formatDate(sel.original_due_date)} />}
            {sel.note && <KeyValue label="Nota" value={sel.note} />}
            {sel.status !== 'cancelled' && sel.status !== 'paid' && <Button title="Registrar pago" onPress={() => { setSel(null); router.push(`/transaction/new?billCycleId=${sel.id}`); }} />}
            {sel.status !== 'cancelled' && <Button title="Reprogramar" variant="secondary" onPress={() => { setResched(sel); setNewDate(sel.due_date!); setSel(null); }} />}
          </>
        )}
      </Sheet>
      <Sheet visible={!!resched} onClose={() => setResched(null)} title="Reprogramar vencimiento" footer={<Button title="Guardar fecha" loading={reschedule.isPending} onPress={() => reschedule.mutate({ id: resched!.id!, date: newDate })} />}>
        <DateField label="Nueva fecha" value={newDate || resched?.due_date || ''} onChange={setNewDate} />
        <Text variant="caption" color="textSecondary">Los recordatorios se recalculan con la nueva fecha. El cambio queda auditado.</Text>
      </Sheet>
      <ConfirmSheet visible={!!cancel} onClose={() => setCancel(null)} title="Cancelar este ciclo" message="No se generarán más recordatorios para este vencimiento." requireReason confirmLabel="Cancelar ciclo" danger loading={cancelCycle.isPending} onConfirm={(r) => cancelCycle.mutate({ id: cancel!.id!, note: r })} />
    </Screen>
  );
}
