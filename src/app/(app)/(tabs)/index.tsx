import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAllocations, useBillCycles, useCategories, useDebts, useFunds, useGoals, useNotifications, useTransactions } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { BillCycleRow, BudgetRow, FundCard, GoalCard, PeriodSelector, TxRow } from '../../../components/finance';
import { Banner, Card, EmptyState, Icon, IconButton, type IconName, ListSkeleton, Money, Pressable, ProgressBar, SectionHeader, Skeleton, Text } from '../../../components/ui';
import { allocationFigures, summarizeBudget } from '../../../domain/budget';
import { addDaysISO, currentYM, monthRange, todayISO } from '../../../lib/dates';
import { formatPct, sum } from '../../../lib/money';
import { usePrefs } from '../../../store/prefs';
import { useTheme } from '../../../theme/ThemeProvider';
import { layout, radius, space } from '../../../theme/tokens';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};

export default function Dashboard() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { me, memberName } = useHH();
  const [ym, setYm] = useState(currentYM());
  const range = monthRange(ym);
  const today = todayISO();
  const hide = usePrefs((s) => s.hideAmounts);
  const toggleHide = usePrefs((s) => s.toggleHideAmounts);

  const allocations = useAllocations(ym);
  const categories = useCategories();
  const recent = useTransactions({ limit: 5 });
  const cycles = useBillCycles({ from: addDaysISO(today, -60), to: addDaysISO(today, 15) });
  const goals = useGoals();
  const funds = useFunds();
  const debts = useDebts();
  const notifications = useNotifications();
  const unread = notifications.data?.filter((n) => !n.read_at).length ?? 0;

  const summary = useMemo(() => summarizeBudget(allocations.data ?? []), [allocations.data]);
  const overdue = (cycles.data ?? []).filter((c) => c.status === 'overdue');
  const upcoming = (cycles.data ?? []).filter((c) => ['due_soon', 'pending', 'partial'].includes(c.status ?? '') && c.due_date! >= today).slice(0, 3);
  const pendingCount = (cycles.data ?? []).filter((c) => ['due_soon', 'pending', 'partial'].includes(c.status ?? '') && c.due_date! >= range.from && c.due_date! <= range.to).length;
  const hot = (allocations.data ?? [])
    .map((a) => ({ a, f: allocationFigures(a.effective_amount, a.spent) }))
    .filter((x) => x.f.status === 'exceeded' || x.f.status === 'near_limit' || x.f.status === 'exhausted')
    .sort((x, y) => y.f.ratio - x.f.ratio);
  const savingsTotal = sum((goals.data ?? []).map((g) => g.balance));
  const fundsTotal = sum((funds.data ?? []).map((f) => f.balance));
  const debtTotal = sum((debts.data ?? []).map((d) => Math.max(Number(d.balance), 0)));
  const nextDebt = (debts.data ?? []).filter((d) => d.next_due_date).sort((a, b) => a.next_due_date!.localeCompare(b.next_due_date!))[0];
  const nearGoals = (goals.data ?? []).filter((g) => g.target_amount && g.status === 'active' && g.balance / Number(g.target_amount) >= 0.75);
  const cats = new Map((categories.data ?? []).map((c) => [c.id, c]));

  const refreshing = allocations.isRefetching || recent.isRefetching;
  const refresh = () => {
    allocations.refetch(); recent.refetch(); cycles.refetch(); goals.refetch(); funds.refetch(); debts.refetch(); notifications.refetch();
  };

  const ratio = summary.ratio;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="screen-dashboard">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.onBrand} colors={[colors.brand]} progressViewOffset={insets.top} />}
      >
        {/* HERO: ¿cuánto tenemos disponible? */}
        <View style={{ backgroundColor: colors.heroFrom, paddingTop: insets.top + space[2], paddingBottom: space[8], paddingHorizontal: layout.screenPadding, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="#C9CFEA">{greeting()},</Text>
              <Text variant="h2" color="onBrand" numberOfLines={1}>{me?.display_name ?? ''}</Text>
            </View>
            <IconButton icon={hide ? 'eye-off' : 'eye'} label={hide ? 'Mostrar montos' : 'Ocultar montos'} tone="onBrand" onPress={toggleHide} />
            <IconButton testID="btn-notifications" icon="bell" label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`} tone="onBrand" badge={unread} onPress={() => router.push('/notifications')} />
          </View>
          <View style={{ alignItems: 'center', marginTop: space[4] }}>
            <PeriodSelector value={ym} onChange={setYm} tone="onBrand" />
          </View>
          <View style={{ marginTop: space[5], gap: space[1] }}>
            <Text variant="overline" color="#C9CFEA">Disponible del presupuesto</Text>
            {allocations.isPending ? (
              <Skeleton width={220} height={40} style={{ opacity: 0.3 }} />
            ) : (
              <Money testID="hero-available" value={summary.available} variant="amountXL" color={summary.available < 0 ? '#FF9B93' : 'onBrand'} />
            )}
            <Text variant="caption" color="#C9CFEA">
              Gastado <Text variant="caption" color="onBrand" style={{ fontFamily: 'Inter_600SemiBold' }}>{hide ? '•••' : formatPct(ratio)}</Text> de un presupuesto de{' '}
              <Money value={summary.budget} variant="caption" color="onBrand" compact />
            </Text>
          </View>
          <View style={{ marginTop: space[4] }}>
            <ProgressBar ratio={ratio} color={colors.accent} track="rgba(255,255,255,0.14)" height={10} accessibilityLabel="Consumo del presupuesto" />
          </View>
          <View style={{ flexDirection: 'row', marginTop: space[5], gap: space[3] }}>
            <HeroStat label="Gasto real" value={summary.spent} />
            <HeroStat label="Por pagar" count={pendingCount} />
            <HeroStat label="Excedidas" count={summary.exceeded} warn={summary.exceeded > 0} />
          </View>
        </View>

        <View style={{ paddingHorizontal: layout.screenPadding, gap: space[5], marginTop: -space[5], maxWidth: layout.maxContentWidth + 40, alignSelf: 'center', width: '100%' }}>
          {/* Accesos rápidos */}
          <Card padded={false} style={{ flexDirection: 'row', paddingVertical: space[3] }}>
            <Quick icon="arrow-out" label="Gasto" onPress={() => router.push('/transaction/new?type=expense')} />
            <Quick icon="hand-coins" label="Aportar" onPress={() => router.push('/transaction/new?type=contribution')} />
            <Quick icon="transfer" label="Transferir" onPress={() => router.push('/transaction/new?type=transfer')} />
            <Quick icon="receipt" label="Pagar" onPress={() => router.push('/payments')} />
          </Card>

          {/* Alertas importantes */}
          {(overdue.length > 0 || hot.some((h) => h.f.status === 'exceeded')) && (
            <Animated.View entering={FadeInDown.duration(260)} style={{ gap: space[2] }}>
              {overdue.length > 0 && (
                <Banner tone="danger" title={`${overdue.length} pago(s) vencido(s)`} message={overdue.map((c) => c.bill_name).join(', ')} action="Ver" onPress={() => router.push('/payments')} />
              )}
              {hot.filter((h) => h.f.status === 'exceeded').slice(0, 2).map((h) => (
                <Banner key={h.a.id} tone="warning" title={`${h.a.category_name} excedido`} message="Revisa opciones: cubrir con fondos, compensar o ajustar." action="Resolver" onPress={() => router.push(`/budget/${h.a.id}`)} />
              ))}
            </Animated.View>
          )}

          {/* Próximos pagos */}
          <View>
            <SectionHeader title="Próximos pagos" action="Ver todo" onAction={() => router.push('/payments')} />
            <Card>
              {cycles.isPending ? <ListSkeleton rows={2} /> : upcoming.length ? (
                upcoming.map((c) => <BillCycleRow key={c.id} c={c} />)
              ) : (
                <EmptyState compact icon="check-circle" title="Nada pendiente pronto" message="No hay vencimientos en los próximos 15 días." />
              )}
            </Card>
          </View>

          {/* Categorías a vigilar */}
          {hot.length > 0 && (
            <View>
              <SectionHeader title="Categorías a vigilar" action="Presupuesto" onAction={() => router.push('/budget')} />
              <Card>{hot.slice(0, 3).map((h) => <BudgetRow key={h.a.id} a={h.a} />)}</Card>
            </View>
          )}

          {/* Ahorros */}
          <View>
            <SectionHeader title="Ahorros" subtitle={hide ? undefined : `Total ahorrado`} action="Ver" onAction={() => router.push('/savings')} />
            {goals.isPending ? <Skeleton height={90} r={radius.lg} /> : goals.data?.length ? (
              <View style={{ gap: space[3] }}>
                <Money value={savingsTotal} variant="amountL" color="savings" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[3] }}>
                  {goals.data.map((g) => <GoalCard key={g.id} g={g} compact />)}
                </ScrollView>
                {nearGoals.length > 0 && <Banner tone="success" title="¡Casi lo logran!" message={`${nearGoals.map((g) => g.name).join(', ')} supera el 75% de su meta.`} />}
              </View>
            ) : (
              <Card><EmptyState compact icon="piggy-bank" title="Aún no hay metas" action="Crear meta" onAction={() => router.push('/savings/new')} /></Card>
            )}
          </View>

          {/* Fondos */}
          <View>
            <SectionHeader title="Fondos disponibles" subtitle="Dinero registrado en caja chica y fondos" action="Ver" onAction={() => router.push('/funds')} />
            {funds.isPending ? <Skeleton height={110} r={radius.lg} /> : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[3] }}>
                <View style={{ width: 176, padding: space[4], borderRadius: radius.lg, backgroundColor: colors.fundSoft, justifyContent: 'space-between', gap: space[2] }}>
                  <Icon name="coins" color={colors.fund} />
                  <View>
                    <Text variant="caption" color="textSecondary">Total en fondos</Text>
                    <Money value={fundsTotal} variant="amountM" compact />
                  </View>
                </View>
                {(funds.data ?? []).map((f) => <FundCard key={f.id} f={f} />)}
              </ScrollView>
            )}
          </View>

          {/* Deudas */}
          <Card onPress={() => router.push('/debts')} testID="card-debts">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.debtSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="card" color={colors.debt} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="caption" color="textSecondary">Deudas pendientes</Text>
                <Money value={debtTotal} variant="amountM" color={debtTotal > 0 ? 'debt' : 'textSecondary'} />
                {nextDebt && <Text variant="caption" color="textSecondary">Próxima cuota: {nextDebt.name}</Text>}
                {!debts.data?.length && !debts.isPending && <Text variant="caption" color="textSecondary">Sin deudas registradas</Text>}
              </View>
              <Icon name="chevron-right" color={colors.textTertiary} />
            </View>
          </Card>

          {/* Últimos movimientos */}
          <View>
            <SectionHeader title="Últimos movimientos" action="Ver todo" onAction={() => router.push('/transactions')} />
            <Card>
              {recent.isPending ? <ListSkeleton rows={3} /> : recent.data?.length ? (
                recent.data.map((t) => <TxRow key={t.id} tx={t} category={t.category_id ? cats.get(t.category_id) : null} memberName={t.member_id ? memberName(t.member_id) : undefined} />)
              ) : (
                <EmptyState compact icon="receipt" title="Sin movimientos todavía" message="Registra el primer gasto o aportación con el botón amarillo." action="Registrar" onAction={() => router.push('/transaction/new')} />
              )}
            </Card>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function HeroStat({ label, value, count, warn }: { label: string; value?: number; count?: number; warn?: boolean }) {
  return (
    <View style={{ flex: 1, padding: space[3], borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.08)', gap: 2 }}>
      <Text variant="caption" color="#C9CFEA" numberOfLines={1} style={{ fontSize: 12 }}>{label}</Text>
      {value !== undefined ? (
        <Money value={value} variant="amountS" color="onBrand" compact />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {warn && <Icon name="alert" size={14} color="#FFCB2F" />}
          <Text variant="amountS" color={warn ? 'accent' : 'onBrand'}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function Quick({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} haptic style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: space[1] }} accessibilityLabel={label}>
      <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={colors.brand} size={21} />
      </View>
      <Text variant="caption" color="text">{label}</Text>
    </Pressable>
  );
}
