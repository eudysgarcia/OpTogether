import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useFunds } from '../../../api/finance';
import { Banner, Card, Divider, EmptyState, ErrorState, Header, IconButton, ListRow, ListSkeleton, Money, Screen, Text } from '../../../components/ui';
import { FUND_KIND } from '../../../lib/labels';
import { sum } from '../../../lib/money';
import type { Scope } from '../../../types/models';

export default function Funds() {
  const { scope = 'household' } = useLocalSearchParams<{ scope?: Scope }>();
  const q = useFunds(scope);
  const list = q.data ?? [];
  return (
    <Screen testID="screen-funds" header={<Header title={scope === 'personal' ? 'Mis cuentas' : 'Fondos'} back right={<IconButton icon="plus" label="Nuevo fondo" onPress={() => router.push(`/funds/new?scope=${scope}`)} />} />} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Card>
        <Text variant="caption" color="textSecondary">Dinero registrado en fondos</Text>
        <Money value={sum(list.map((f) => f.balance))} variant="amountXL" color="text" />
      </Card>
      {scope === 'household' && <Banner tone="info" title="Dinero virtual registrado" message="Los saldos se calculan solo con lo que registran (aportes, reposiciones, gastos). No reflejan cuentas bancarias reales." />}
      {q.isPending ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : list.length ? (
        <Card>
          {list.map((f, i) => (
            <View key={f.id}>
              {i > 0 && <Divider inset={52} />}
              <ListRow icon={f.icon} iconColor={f.color} title={f.name} subtitle={FUND_KIND[f.kind]?.label} onPress={() => router.push(`/funds/${f.id}`)} right={<Money value={f.balance} variant="amountS" color={f.balance > 0 ? 'text' : 'textTertiary'} />} />
            </View>
          ))}
        </Card>
      ) : <EmptyState icon="wallet" title="Sin fondos" action="Crear fondo" onAction={() => router.push(`/funds/new?scope=${scope}`)} />}
    </Screen>
  );
}
