import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useBillCycles, useBills } from '../../../api/finance';
import { BillCycleRow } from '../../../components/finance';
import { Banner, Card, Divider, EmptyState, ErrorState, Header, IconButton, KeyValue, ListRow, ListSkeleton, Money, Screen, SectionHeader, Segmented, Text } from '../../../components/ui';
import { addDaysISO, todayISO } from '../../../lib/dates';
import { BILL_KIND } from '../../../lib/labels';
import { formatMoney, sum } from '../../../lib/money';
import { FREQUENCY_LABEL, type Frequency } from '../../../lib/dates';

export default function Payments() {
  const [tab, setTab] = useState<'cycles' | 'services'>('cycles');
  const today = todayISO();
  const cycles = useBillCycles({ from: addDaysISO(today, -120), to: addDaysISO(today, 45), scope: 'household' });
  const bills = useBills();
  const all = cycles.data ?? [];
  const overdue = all.filter((c) => c.status === 'overdue');
  const upcoming = all.filter((c) => ['due_soon', 'pending', 'partial'].includes(c.status ?? ''));
  const paid = all.filter((c) => c.status === 'paid').reverse().slice(0, 12);
  const pendingTotal = sum([...overdue, ...upcoming].map((c) => Math.max(Number(c.expected_amount) - Number(c.paid_amount), 0)));

  return (
    <Screen testID="screen-payments" header={<Header title="Pagos y servicios" back right={<IconButton icon="plus" label="Nuevo servicio" onPress={() => router.push('/payments/new')} />} />} refreshing={cycles.isRefetching} onRefresh={() => { cycles.refetch(); bills.refetch(); }}>
      <Segmented options={[{ value: 'cycles', label: 'Vencimientos' }, { value: 'services', label: 'Servicios' }]} value={tab} onChange={setTab} />
      {tab === 'cycles' ? (
        cycles.isPending ? <ListSkeleton rows={5} /> : cycles.error ? <ErrorState error={cycles.error} onRetry={cycles.refetch} /> : (
          <>
            <Card tone="alt">
              <KeyValue label="Pendiente por pagar"><Money value={pendingTotal} variant="amountM" color={overdue.length ? 'negative' : 'text'} /></KeyValue>
              <Text variant="caption" color="textSecondary">El monto real puede diferir del estimado. Registra lo que realmente pagaste.</Text>
            </Card>
            {overdue.length > 0 && (
              <View>
                <Banner tone="danger" title={`${overdue.length} vencido(s)`} message="Págalos o reprográmalos para dejar de recibir alertas." />
                <Card style={{ marginTop: 8 }}>{overdue.map((c) => <BillCycleRow key={c.id} c={c} />)}</Card>
              </View>
            )}
            <View>
              <SectionHeader title="Próximos" />
              <Card>{upcoming.length ? upcoming.map((c) => <BillCycleRow key={c.id} c={c} />) : <EmptyState compact icon="check-circle" title="Todo al día" />}</Card>
            </View>
            {paid.length > 0 && (
              <View>
                <SectionHeader title="Pagados recientemente" />
                <Card>{paid.map((c) => <BillCycleRow key={c.id} c={c} />)}</Card>
              </View>
            )}
          </>
        )
      ) : bills.isPending ? <ListSkeleton /> : bills.data?.length ? (
        <Card>
          {bills.data.map((b, i) => (
            <View key={b.id}>
              {i > 0 && <Divider inset={52} />}
              <ListRow icon={BILL_KIND[b.kind]?.icon ?? 'receipt'} title={b.name + (b.active ? '' : ' (inactivo)')} subtitle={`${formatMoney(b.estimated_amount)} ${b.amount_type === 'variable' ? 'aprox.' : ''} · día ${b.due_day} · ${FREQUENCY_LABEL[b.frequency as Frequency]}${b.provider ? ` · ${b.provider}` : ''}`} onPress={() => router.push(`/payments/${b.id}`)} />
            </View>
          ))}
        </Card>
      ) : (
        <EmptyState icon="receipt" title="Sin servicios" message="Agrega alquiler, luz, internet, suscripciones…" action="Nuevo servicio" onAction={() => router.push('/payments/new')} />
      )}
    </Screen>
  );
}
