import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useDebts } from '../../../api/finance';
import { DebtCard } from '../../../components/finance';
import { Button, Card, EmptyState, ErrorState, Header, IconButton, KeyValue, ListSkeleton, Money, Screen, Text } from '../../../components/ui';
import { sum } from '../../../lib/money';
import { space } from '../../../theme/tokens';
import type { Scope } from '../../../types/models';

export default function Debts() {
  const { scope = 'household' } = useLocalSearchParams<{ scope?: Scope }>();
  const q = useDebts(scope);
  const list = q.data ?? [];
  const total = sum(list.map((d) => Math.max(Number(d.balance), 0)));
  const interest = sum(list.map((d) => Number(d.interest_charged) + Number(d.fees_charged)));
  const monthly = sum(list.filter((d) => Number(d.balance) > 0).map((d) => Number(d.installment_amount ?? 0)));
  return (
    <Screen testID="screen-debts" header={<Header title={scope === 'personal' ? 'Mis deudas' : 'Deudas'} subtitle={scope === 'personal' ? 'Privado' : 'Compartidas del hogar'} back right={<IconButton icon="plus" label="Nueva deuda" onPress={() => router.push(`/debts/new?scope=${scope}`)} />} />} refreshing={q.isRefetching} onRefresh={q.refetch}>
      {list.length > 0 && (
        <Card>
          <Text variant="caption" color="textSecondary">Saldo pendiente total</Text>
          <Money value={total} variant="amountXL" color="debt" />
          <View style={{ marginTop: space[3] }}>
            <KeyValue label="Cuotas por periodo"><Money value={monthly} variant="amountS" /></KeyValue>
            <KeyValue label="Intereses y recargos registrados"><Money value={interest} variant="amountS" /></KeyValue>
          </View>
        </Card>
      )}
      {list.length > 1 && <Button title="Planificador de deudas" icon="target" variant="secondary" onPress={() => router.push(`/debts/planner?scope=${scope}`)} />}
      {q.isPending ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : list.length ? list.map((d) => <DebtCard key={d.id} d={d} />) : (
        <EmptyState icon="card" title="Sin deudas" message="¡Excelente! Si tienen préstamos, tarjetas o financiamientos, regístralos para controlar abonos y cuotas." action="Registrar deuda" onAction={() => router.push(`/debts/new?scope=${scope}`)} />
      )}
    </Screen>
  );
}
