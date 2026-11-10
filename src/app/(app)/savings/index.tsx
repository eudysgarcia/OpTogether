import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { useGoals } from '../../../api/finance';
import { GoalCard } from '../../../components/finance';
import { Card, EmptyState, ErrorState, Header, IconButton, ListSkeleton, Money, Screen, Segmented, Text } from '../../../components/ui';
import { monthlyCommitment } from '../../../domain/savings';
import { formatMoney, sum } from '../../../lib/money';
import type { Scope } from '../../../types/models';

export default function Savings() {
  const { scope = 'household' } = useLocalSearchParams<{ scope?: Scope }>();
  const [show, setShow] = useState<'active' | 'all'>('active');
  const q = useGoals(scope, show === 'all');
  const list = q.data ?? [];
  const total = sum(list.filter((g) => g.status !== 'archived').map((g) => g.balance));
  const monthly = sum(list.filter((g) => g.status === 'active').map((g) => monthlyCommitment(g.commitments)));
  return (
    <Screen testID="screen-savings" header={<Header title={scope === 'personal' ? 'Mis ahorros' : 'Ahorros'} subtitle={scope === 'personal' ? 'Privado' : 'Metas compartidas'} back right={<IconButton icon="plus" label="Nueva meta" onPress={() => router.push(`/savings/new?scope=${scope}`)} />} />} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Card>
        <Text variant="caption" color="textSecondary">Total ahorrado</Text>
        <Money value={total} variant="amountXL" color="savings" />
        {monthly > 0 && <Text variant="caption" color="textSecondary">Compromiso mensual: {formatMoney(monthly)}</Text>}
        <Text variant="caption" color="textTertiary" style={{ marginTop: 6 }}>Aportar a una meta no es un gasto: el dinero sigue siendo de ustedes.</Text>
      </Card>
      <Segmented options={[{ value: 'active', label: 'Activas' }, { value: 'all', label: 'Todas (incl. archivadas)' }]} value={show} onChange={setShow} />
      {q.isPending ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : list.length ? list.map((g) => <GoalCard key={g.id} g={g} />) : (
        <EmptyState icon="piggy-bank" title="Sin metas de ahorro" message="Casa, vehículo, emergencias, viajes… Crea su primera meta." action="Crear meta" onAction={() => router.push(`/savings/new?scope=${scope}`)} />
      )}
    </Screen>
  );
}
