import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useCategories, useTransactions } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { PeriodSelector, TxList } from '../../../components/finance';
import { Card, Chip, ChipRow, EmptyState, ErrorState, Header, IconButton, Input, KeyValue, ListSkeleton, Money, Screen, Sheet, Switch, Select, Button } from '../../../components/ui';
import { netSpending, totalsByType } from '../../../domain/reports';
import { currentYM, monthRange } from '../../../lib/dates';
import { space } from '../../../theme/tokens';
import type { TxType } from '../../../types/models';

const TYPE_FILTERS: { key: string; label: string; types?: TxType[] }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'expense', label: 'Gastos', types: ['expense', 'refund'] },
  { key: 'income', label: 'Ingresos', types: ['income'] },
  { key: 'contribution', label: 'Aportes', types: ['contribution'] },
  { key: 'moves', label: 'Transferencias', types: ['transfer', 'deposit', 'withdrawal'] },
  { key: 'savings', label: 'Ahorros', types: ['savings_deposit', 'savings_withdrawal'] },
  { key: 'debts', label: 'Deudas', types: ['debt_payment', 'debt_charge'] },
];

export default function Transactions() {
  const { members, memberName } = useHH();
  const [ym, setYm] = useState(currentYM());
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [includeVoided, setIncludeVoided] = useState(false);
  const r = monthRange(ym);
  const cats = useCategories(true);
  const q = useTransactions({
    from: search ? undefined : r.from, to: search ? undefined : r.to, types: TYPE_FILTERS.find((t) => t.key === type)?.types,
    search: search || undefined, memberId: memberId ?? undefined, categoryId: categoryId ?? undefined, includeVoided,
  });
  const totals = totalsByType(q.data ?? []);
  const activeFilters = [memberId, categoryId, includeVoided || null].filter(Boolean).length;

  return (
    <Screen
      testID="screen-transactions"
      header={<Header title="Movimientos" large right={<IconButton icon="filter" label="Filtros" badge={activeFilters} onPress={() => setFiltersOpen(true)} />} />}
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
    >
      <Input testID="input-search" icon="search" placeholder="Buscar descripción u observaciones" value={search} onChangeText={setSearch} returnKeyType="search" clearButtonMode="while-editing" />
      {!search && <View style={{ alignItems: 'center' }}><PeriodSelector value={ym} onChange={setYm} /></View>}
      <ChipRow>
        {TYPE_FILTERS.map((t) => <Chip key={t.key} label={t.label} selected={type === t.key} onPress={() => setType(t.key)} />)}
      </ChipRow>
      {!!q.data?.length && (
        <Card tone="alt">
          <KeyValue label="Gasto real del periodo"><Money value={netSpending(q.data)} variant="amountS" /></KeyValue>
          {!!totals.contribution && <KeyValue label="Aportaciones (no son gasto)"><Money value={totals.contribution} variant="amountS" color="contribution" /></KeyValue>}
          {!!totals.income && <KeyValue label="Ingresos"><Money value={totals.income} variant="amountS" color="positive" /></KeyValue>}
        </Card>
      )}
      {q.isPending ? <ListSkeleton rows={6} /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : q.data?.length ? (
        <TxList txs={q.data} categories={cats.data ?? []} memberName={memberName} />
      ) : (
        <EmptyState icon={search ? 'search' : 'receipt'} title={search ? 'Sin resultados' : 'Sin movimientos en este periodo'} message={search ? 'Prueba con otra palabra.' : 'Registra gastos, aportaciones o transferencias con el botón amarillo.'} action={search ? undefined : 'Registrar movimiento'} onAction={() => router.push('/transaction/new')} />
      )}
      <Sheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros" footer={<Button title="Aplicar" onPress={() => setFiltersOpen(false)} />}>
        <Select label="Persona" value={memberId} allowClear options={members.map((m) => ({ value: m.id, label: m.display_name, icon: 'user' }))} onChange={setMemberId} placeholder="Todas" />
        <Select label="Categoría" value={categoryId} allowClear options={(cats.data ?? []).filter((c) => c.scope === 'household').map((c) => ({ value: c.id, label: c.name, icon: c.icon, color: c.color }))} onChange={setCategoryId} placeholder="Todas" />
        <Switch label="Incluir anulados" value={includeVoided} onChange={setIncludeVoided} />
        <Button title="Limpiar filtros" variant="ghost" onPress={() => { setMemberId(null); setCategoryId(null); setIncludeVoided(false); }} />
      </Sheet>
      <View style={{ height: space[2] }} />
    </Screen>
  );
}
