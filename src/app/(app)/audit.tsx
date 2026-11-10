import React, { useState } from 'react';
import { useAuditFeed } from '../../api/finance';
import { AuditEntry } from '../../components/finance/AuditEntry';
import { Card, Chip, ChipRow, EmptyState, ErrorState, Header, ListSkeleton, Screen, Text } from '../../components/ui';

export default function Audit() {
  const q = useAuditFeed(300);
  const [filter, setFilter] = useState<'all' | 'void' | 'update'>('all');
  const list = (q.data ?? []).filter((l) => filter === 'all' || l.action === filter);
  return (
    <Screen testID="screen-audit" header={<Header title="Auditoría" subtitle="Nada se elimina en silencio" back />} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Text variant="caption" color="textSecondary">Registro de quién creó, editó o anuló cada dato del hogar, con valores anteriores, nuevos y el motivo. Tus registros personales solo aparecen para ti.</Text>
      <ChipRow>
        <Chip label="Todo" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Ediciones" icon="edit" selected={filter === 'update'} onPress={() => setFilter('update')} />
        <Chip label="Anulaciones" icon="ban" selected={filter === 'void'} onPress={() => setFilter('void')} />
      </ChipRow>
      {q.isPending ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : list.length ? (
        <Card>{list.map((l) => <AuditEntry key={l.id} l={l} showTable />)}</Card>
      ) : <EmptyState icon="history" title="Sin registros" />}
    </Screen>
  );
}
