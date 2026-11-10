import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAllocations, useCategories, usePeriod } from '../../../api/finance';
import { BudgetRow, PeriodSelector } from '../../../components/finance';
import { BudgetBars } from '../../../components/charts/Charts';
import { Banner, Button, Card, Divider, EmptyState, ErrorState, Header, IconButton, ListSkeleton, Money, ProgressBar, Screen, SectionHeader, Segmented, Text } from '../../../components/ui';
import { summarizeBudget, allocationFigures } from '../../../domain/budget';
import { currentYM } from '../../../lib/dates';
import { formatPct } from '../../../lib/money';
import { supabase } from '../../../lib/supabase';
import { invalidateFinance } from '../../../lib/queryClient';
import { errorMessage } from '../../../lib/errors';
import { toast } from '../../../store/toast';
import { useTheme } from '../../../theme/ThemeProvider';
import { space } from '../../../theme/tokens';

export default function Budget() {
  const { colors } = useTheme();
  const [ym, setYm] = useState(currentYM());
  const [view, setView] = useState<'list' | 'chart'>('list');
  const q = useAllocations(ym);
  const period = usePeriod(ym);
  const cats = useCategories();
  const rows = useMemo(() => q.data ?? [], [q.data]);
  const s = useMemo(() => summarizeBudget(rows), [rows]);
  const extra = rows.reduce((a, r) => a + Number(r.extraordinary_spent ?? 0), 0);
  const unbudgeted = (cats.data ?? []).filter((c) => c.scope === 'household' && !c.parent_id && c.kind !== 'income' && !rows.some((r) => r.category_id === c.id));
  const [copying, setCopying] = useState(false);

  const copyPrevious = async () => {
    if (!period.data) return;
    setCopying(true);
    const r = await supabase.rpc('copy_previous_budget', { p_period: period.data });
    setCopying(false);
    if (r.error) return toast.error('No se pudo copiar', errorMessage(r.error));
    toast.success(r.data ? `${r.data} categoría(s) copiada(s)` : 'El presupuesto ya estaba completo');
    invalidateFinance();
  };

  return (
    <Screen
      testID="screen-budget"
      header={<Header title="Presupuesto" large right={<IconButton icon="plus" label="Agregar categoría al presupuesto" onPress={() => router.push(`/budget/add?y=${ym.year}&m=${ym.month}`)} />} />}
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
    >
      <View style={{ alignItems: 'center' }}><PeriodSelector value={ym} onChange={setYm} /></View>
      <Card>
        <View style={{ gap: space[3] }}>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="textSecondary">Gasto real</Text>
              <Money value={s.spent} variant="amountM" compact />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text variant="caption" color="textSecondary">{s.available >= 0 ? 'Disponible' : 'Exceso neto'}</Text>
              <Money value={Math.abs(s.available)} variant="amountM" compact color={s.available >= 0 ? 'available' : 'excess'} align="right" />
            </View>
          </View>
          <ProgressBar ratio={s.ratio} height={10} accessibilityLabel="Consumo del presupuesto" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" color="textSecondary">Presupuesto: <Money value={s.budget} variant="caption" color="text" /></Text>
            <Text variant="caption" color="textSecondary">{formatPct(s.ratio)} consumido</Text>
          </View>
          {extra > 0 && <><Divider /><Text variant="caption" color="warning">Gastos extraordinarios (fuera del presupuesto): <Money value={extra} variant="caption" color="warning" /></Text></>}
        </View>
      </Card>
      <Text variant="caption" color="textTertiary" align="center">El presupuesto es lo planificado; solo los gastos reales consumen dinero.</Text>

      {s.exceeded > 0 && <Banner tone="danger" title={`${s.exceeded} categoría(s) excedida(s)`} message="Toca la categoría para cubrir el exceso con fondos, compensar con otra categoría o ajustar." />}

      <Segmented options={[{ value: 'list', label: 'Categorías' }, { value: 'chart', label: 'Comparar' }]} value={view} onChange={setView} />

      {q.isPending ? <Card><ListSkeleton rows={5} /></Card> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : rows.length === 0 ? (
        <Card>
          <EmptyState icon="pie" title="Sin presupuesto este mes" message="Copia el presupuesto del mes anterior o agrega categorías." action="Copiar mes anterior" onAction={copyPrevious} />
        </Card>
      ) : view === 'list' ? (
        <Card>
          {rows.map((a, i) => (
            <View key={a.id}>
              {i > 0 && <Divider />}
              <BudgetRow a={a} />
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <BudgetBars data={rows.map((r) => ({ label: r.category_name, budget: Number(r.effective_amount), spent: Number(r.spent) }))} />
          <View style={{ marginTop: space[4], gap: space[2] }}>
            {rows.map((r) => {
              const f = allocationFigures(r.effective_amount, r.spent);
              return (
                <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="caption">{r.category_name}</Text>
                  <Text variant="caption" color={f.excess ? 'excess' : 'textSecondary'} tabular>{formatPct(f.ratio)}</Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {rows.length > 0 && (
        <View style={{ gap: space[2] }}>
          <SectionHeader title="Acciones" />
          <Button title="Copiar categorías faltantes del mes anterior" variant="secondary" icon="copy" loading={copying} onPress={copyPrevious} />
          {unbudgeted.length > 0 && <Text variant="caption" color="textSecondary">Sin presupuesto este mes: {unbudgeted.map((c) => c.name).join(', ')}</Text>}
          <Button title="Historial y comparaciones" variant="ghost" icon="history" onPress={() => router.push('/reports')} />
        </View>
      )}
      <View style={{ height: 1, backgroundColor: colors.background }} />
    </Screen>
  );
}
