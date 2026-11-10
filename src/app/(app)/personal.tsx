import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useCategories, useDebts, useFunds, useGoals, useTransactions } from '../../api/finance';
import { PeriodSelector, TxList } from '../../components/finance';
import { DonutChart } from '../../components/charts/Charts';
import { Banner, Button, Card, Divider, EmptyState, Header, Icon, ListRow, ListSkeleton, Money, Screen, SectionHeader, Text } from '../../components/ui';
import { groupSpending, netSpending } from '../../domain/reports';
import { currentYM, monthRange } from '../../lib/dates';
import { formatMoney, sum } from '../../lib/money';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

/** Espacio privado: todas las consultas usan scope=personal y la RLS garantiza que solo el dueño las ve. */
export default function Personal() {
  const { colors } = useTheme();
  const [ym, setYm] = useState(currentYM());
  const r = monthRange(ym);
  const txs = useTransactions({ scope: 'personal', from: r.from, to: r.to });
  const funds = useFunds('personal');
  const goals = useGoals('personal');
  const debts = useDebts('personal');
  const cats = useCategories(true);
  const list = txs.data ?? [];
  const income = sum(list.filter((t) => t.type === 'income').map((t) => t.amount));
  const spent = netSpending(list);
  const balance = sum((funds.data ?? []).map((f) => f.balance));
  const saved = sum((goals.data ?? []).map((g) => g.balance));
  const owed = sum((debts.data ?? []).map((d) => Math.max(Number(d.balance), 0)));
  const byCat = groupSpending(list, 'category_id').slice(0, 6).map((g) => ({ label: cats.data?.find((c) => c.id === g.key)?.name ?? 'Sin categoría', value: g.amount }));

  return (
    <Screen testID="screen-personal" header={<Header title="Mi dinero" subtitle="Privado · solo tú lo ves" back />} refreshing={txs.isRefetching} onRefresh={() => { txs.refetch(); funds.refetch(); goals.refetch(); debts.refetch(); }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], justifyContent: 'center' }}>
        <Icon name="lock" size={14} color={colors.textSecondary} />
        <Text variant="caption" color="textSecondary">Tu pareja no puede ver esta sección, ni en reportes, notificaciones o búsquedas.</Text>
      </View>
      <View style={{ alignItems: 'center' }}><PeriodSelector value={ym} onChange={setYm} /></View>
      <Card tone="brand">
        <Text variant="overline" color="#C9CFEA">Disponible del mes</Text>
        <Money value={income - spent} variant="amountXL" color={income - spent >= 0 ? 'onBrand' : '#FF9B93'} />
        <View style={{ flexDirection: 'row', gap: space[4], marginTop: space[3] }}>
          <View style={{ flex: 1 }}><Text variant="caption" color="#C9CFEA">Ingresos</Text><Money value={income} variant="amountS" color="onBrand" /></View>
          <View style={{ flex: 1 }}><Text variant="caption" color="#C9CFEA">Gastos</Text><Money value={spent} variant="amountS" color="onBrand" /></View>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Button title="Gasto" icon="arrow-out" full={false} style={{ flex: 1 }} onPress={() => router.push('/transaction/new?type=expense&scope=personal')} />
        <Button title="Ingreso" icon="arrow-in" variant="secondary" full={false} style={{ flex: 1 }} onPress={() => router.push('/transaction/new?type=income&scope=personal')} />
      </View>
      <Card>
        <ListRow icon="wallet" iconColor={colors.fund} title="Mis cuentas y fondos" subtitle={`Saldo: ${formatMoney(balance)}`} onPress={() => router.push('/funds?scope=personal')} />
        <Divider inset={52} />
        <ListRow icon="piggy-bank" iconColor={colors.savings} title="Mis ahorros y metas" subtitle={`Ahorrado: ${formatMoney(saved)}`} onPress={() => router.push('/savings?scope=personal')} />
        <Divider inset={52} />
        <ListRow icon="card" iconColor={colors.debt} title="Mis deudas" subtitle={`Pendiente: ${formatMoney(owed)}`} onPress={() => router.push('/debts?scope=personal')} />
        <Divider inset={52} />
        <ListRow icon="chart" title="Mi reporte" subtitle="Exportar mis movimientos (privado)" onPress={() => router.push('/reports?scope=personal')} />
      </Card>
      <Card>
        <Text variant="caption" color="textSecondary">Patrimonio neto (cuentas + ahorros − deudas)</Text>
        <Money value={balance + saved - owed} variant="amountL" color={balance + saved - owed >= 0 ? 'positive' : 'negative'} />
      </Card>
      {(funds.data?.length ?? 0) === 0 && !funds.isPending && <Banner tone="info" title="Crea tu primera cuenta" message="Registra tu cartera o cuenta para llevar tu saldo personal." action="Crear" onPress={() => router.push('/funds/new?scope=personal')} />}
      {byCat.length > 0 && <View><SectionHeader title="Mis gastos por categoría" /><Card><DonutChart data={byCat} centerValue={formatMoney(spent, { compact: true })} centerLabel="gastado" /></Card></View>}
      <View>
        <SectionHeader title="Mis movimientos" />
        {txs.isPending ? <ListSkeleton /> : list.length ? <Card><TxList txs={list} categories={cats.data ?? []} memberName={() => ''} /></Card> : <EmptyState icon="lock" title="Sin movimientos personales" message="Lo que registres como Personal aparecerá aquí." />}
      </View>
    </Screen>
  );
}
