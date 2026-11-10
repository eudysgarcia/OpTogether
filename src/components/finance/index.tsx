import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { allocationFigures } from '../../domain/budget';
import { capitalize, formatDate, relativeDays, ymLabel, type YearMonth, addMonthsYM, currentYM } from '../../lib/dates';
import { BILL_KIND, BILL_STATUS_UI, BUDGET_STATUS_UI, DEBT_KIND, TX_TYPE } from '../../lib/labels';
import { formatMoney, formatPct } from '../../lib/money';
import { usePrefs } from '../../store/prefs';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import type { AllocationRow, BillCycleRow, Category, DebtRow, Transaction, TxType } from '../../types/models';
import type { FundWithBalance, GoalWithBalance } from '../../api/finance';
import { Card, IconButton, IconTile, Money, Pressable, ProgressBar, Ring, StatusPill, Text, Icon } from '../ui';

// ------------------------------------------------------------------ Movimiento
export function TxRow({
  tx, category, memberName, onPress, showDate = true,
}: { tx: Transaction; category?: Category | null; memberName?: string; onPress?: () => void; showDate?: boolean }) {
  const { colors } = useTheme();
  const meta = TX_TYPE[tx.type as TxType];
  const voided = tx.status === 'voided';
  const icon = tx.type === 'expense' || tx.type === 'refund' ? category?.icon ?? meta.icon : meta.icon;
  const color =
    tx.type === 'expense' || tx.type === 'refund'
      ? category?.color ?? colors.brand
      : meta.tone === 'savings' ? colors.savings : meta.tone === 'debt' ? colors.debt : meta.tone === 'fund' ? colors.fund : meta.tone === 'positive' ? colors.positive : colors.brand;
  const amountColor = voided ? 'textTertiary' : meta.sign > 0 ? 'positive' : 'text';
  const parts = [meta.label, category?.name, memberName, showDate ? formatDate(tx.occurred_on, 'day') : null].filter(Boolean);
  return (
    <Pressable
      testID={`tx-${tx.id}`}
      onPress={onPress ?? (() => router.push(`/transaction/${tx.id}`))}
      scaleTo={0.985}
      accessibilityLabel={`${tx.description}, ${parts.join(', ')}${voided ? ', anulado' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 62, paddingVertical: space[2], opacity: voided ? 0.6 : 1 }}
    >
      <IconTile icon={icon} color={color} size={42} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1} style={voided ? { textDecorationLine: 'line-through' } : undefined}>{tx.description}</Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>{parts.join(' · ')}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Money value={meta.sign < 0 ? -Number(tx.amount) : Number(tx.amount)} sign={meta.sign > 0} variant="amountS" color={amountColor} />
        {voided && <Text variant="caption" color="negative">Anulado</Text>}
        {tx.is_extraordinary && !voided && <Text variant="caption" color="warning">Extraordinario</Text>}
      </View>
    </Pressable>
  );
}

/** Agrupa movimientos por día con encabezados. */
export function TxList({ txs, categories, memberName }: { txs: Transaction[]; categories: Category[]; memberName: (id: string | null) => string }) {
  const cats = new Map(categories.map((c) => [c.id, c]));
  const groups: { date: string; items: Transaction[] }[] = [];
  for (const t of txs) {
    const g = groups[groups.length - 1];
    if (g && g.date === t.occurred_on) g.items.push(t);
    else groups.push({ date: t.occurred_on, items: [t] });
  }
  return (
    <View style={{ gap: space[4] }}>
      {groups.map((g) => (
        <View key={g.date}>
          <Text variant="overline" color="textTertiary" style={{ marginBottom: space[1] }}>
            {relativeDays(g.date) === 'Hoy' || relativeDays(g.date) === 'Ayer' ? relativeDays(g.date) : formatDate(g.date, 'long')}
          </Text>
          {g.items.map((t) => (
            <TxRow key={t.id} tx={t} category={t.category_id ? cats.get(t.category_id) : null} memberName={t.member_id ? memberName(t.member_id) : undefined} showDate={false} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ Presupuesto
export function BudgetRow({ a, onPress }: { a: AllocationRow; onPress?: () => void }) {
  const { colors } = useTheme();
  const f = allocationFigures(a.effective_amount, a.spent);
  const ui = BUDGET_STATUS_UI[f.status];
  return (
    <Pressable
      testID={`budget-${a.category_name}`}
      onPress={onPress ?? (() => router.push(`/budget/${a.id}`))}
      scaleTo={0.985}
      accessibilityLabel={`${a.category_name}: gastado ${f.spent} de ${f.budget}, ${ui.label}`}
      style={{ gap: space[2], paddingVertical: space[3] }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <IconTile icon={a.category_icon} color={a.category_color} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{a.category_name}</Text>
            {a.category_kind === 'fund' && <Icon name="wallet" size={13} color={colors.fund} />}
          </View>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            <Text variant="caption" color="text" tabular>{fmt(f.spent)}</Text> de {fmt(f.budget)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {f.excess > 0 ? (
            <Money value={-f.excess} variant="amountS" color="excess" />
          ) : (
            <Money value={f.available} variant="amountS" color={f.available > 0 ? 'available' : 'textSecondary'} />
          )}
          <Text variant="caption" color="textTertiary">{f.excess > 0 ? 'excedido' : 'disponible'}</Text>
        </View>
      </View>
      <ProgressBar ratio={f.ratio} color={f.status === 'near_limit' || f.status === 'exhausted' ? colors.warning : colors.brand} />
      {(f.status === 'near_limit' || f.status === 'exceeded' || f.status === 'exhausted') && (
        <StatusPill small label={`${ui.label} · ${formatPct(f.ratio)}`} tone={ui.tone} icon={ui.icon} />
      )}
    </Pressable>
  );
}

const fmt = (n: number) => formatMoney(Math.round(n), { compact: true, hidden: usePrefs.getState().hideAmounts });

// ------------------------------------------------------------------ Pagos
export function BillCycleRow({ c, onPress }: { c: BillCycleRow; onPress?: () => void }) {
  const ui = BILL_STATUS_UI[c.status ?? 'pending'];
  const kind = BILL_KIND[c.bill_kind ?? 'other'];
  const pending = Math.max(Number(c.expected_amount) - Number(c.paid_amount), 0);
  return (
    <Pressable
      testID={`cycle-${c.id}`}
      onPress={onPress ?? (() => router.push(`/payments/${c.bill_id}`))}
      scaleTo={0.985}
      accessibilityLabel={`${c.bill_name}, ${ui.label}, vence ${formatDate(c.due_date)}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 64, paddingVertical: space[2] }}
    >
      <DateBadge iso={c.due_date!} tone={c.status === 'overdue' ? 'negative' : c.status === 'paid' ? 'positive' : 'neutral'} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={kind.icon} size={14} />
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{c.bill_name}</Text>
        </View>
        <StatusPill small label={ui.label} tone={ui.tone} icon={ui.icon} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Money value={c.status === 'paid' ? c.paid_amount : pending} variant="amountS" color={c.status === 'overdue' ? 'negative' : 'text'} />
        <Text variant="caption" color="textTertiary">{c.status === 'paid' ? 'pagado' : relativeDays(c.due_date!)}</Text>
      </View>
    </Pressable>
  );
}

export function DateBadge({ iso, tone = 'neutral' }: { iso: string; tone?: 'neutral' | 'negative' | 'positive' }) {
  const { colors } = useTheme();
  const d = new Date(iso + 'T12:00:00');
  const bg = tone === 'negative' ? colors.negativeSoft : tone === 'positive' ? colors.positiveSoft : colors.surfaceAlt;
  const fg = tone === 'negative' ? colors.negative : tone === 'positive' ? colors.positive : colors.brand;
  return (
    <View style={{ width: 46, height: 50, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="overline" color={fg} style={{ fontSize: 10 }}>{['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]}</Text>
      <Text variant="h3" color={fg}>{d.getDate()}</Text>
    </View>
  );
}

// ------------------------------------------------------------------ Ahorros
export function GoalCard({ g, onPress, compact }: { g: GoalWithBalance; onPress?: () => void; compact?: boolean }) {
  const { colors } = useTheme();
  const ratio = g.target_amount ? g.balance / Number(g.target_amount) : 0;
  return (
    <Card onPress={onPress ?? (() => router.push(`/savings/${g.id}`))} testID={`goal-${g.name}`} style={compact ? { width: 220 } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Ring ratio={ratio} size={58} stroke={6} color={colors.savings}>
          <Icon name={g.icon} size={20} color={colors.savings} />
        </Ring>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{g.name}</Text>
          <Money value={g.balance} variant="amountM" color="savings" />
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {g.target_amount ? `${formatPct(ratio)} de ${fmt(Number(g.target_amount))}` : 'Sin monto objetivo'}
          </Text>
        </View>
        {g.status === 'completed' && <StatusPill small label="Completada" tone="positive" icon="check" />}
      </View>
    </Card>
  );
}

// ------------------------------------------------------------------ Deudas
export function DebtCard({ d, onPress }: { d: DebtRow; onPress?: () => void }) {
  const { colors } = useTheme();
  const kind = DEBT_KIND[d.kind ?? 'other'];
  const original = Number(d.original_amount) + Number(d.interest_charged ?? 0) + Number(d.fees_charged ?? 0);
  const progress = original > 0 ? Number(d.paid ?? 0) / original : 0;
  const paidOff = Number(d.balance) <= 0;
  return (
    <Card onPress={onPress ?? (() => router.push(`/debts/${d.id}`))} testID={`debt-${d.name}`}>
      <View style={{ gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <IconTile icon={kind.icon} color={colors.debt} size={40} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>{d.name}</Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>{[kind.label, d.creditor].filter(Boolean).join(' · ')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Money value={d.balance} variant="amountM" color={paidOff ? 'positive' : 'debt'} />
            <Text variant="caption" color="textTertiary">{paidOff ? 'saldada' : 'pendiente'}</Text>
          </View>
        </View>
        <ProgressBar ratio={progress} color={colors.positive} showExcess={false} accessibilityLabel={`Pagado ${formatPct(progress)}`} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" color="textSecondary">Pagado {formatPct(progress)}</Text>
          {d.next_due_date && !paidOff && <Text variant="caption" color="textSecondary">Próxima cuota: {formatDate(d.next_due_date, 'day')} ({relativeDays(d.next_due_date)})</Text>}
        </View>
      </View>
    </Card>
  );
}

// ------------------------------------------------------------------ Fondos
export function FundCard({ f, onPress }: { f: FundWithBalance; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={`fund-${f.name}`}
      onPress={onPress ?? (() => router.push(`/funds/${f.id}`))}
      scaleTo={0.97}
      accessibilityLabel={`${f.name}, saldo`}
      style={{ width: 168, padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: space[3] }}
    >
      <IconTile icon={f.icon} color={f.color} size={36} />
      <View style={{ gap: 2 }}>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>{f.name}</Text>
        <Money value={f.balance} variant="amountM" color={f.balance > 0 ? 'text' : 'textTertiary'} />
      </View>
    </Pressable>
  );
}

// ------------------------------------------------------------------ Selector de periodo
export function PeriodSelector({ value, onChange, tone = 'default' }: { value: YearMonth; onChange: (v: YearMonth) => void; tone?: 'default' | 'onBrand' }) {
  const isCurrent = value.year === currentYM().year && value.month === currentYM().month;
  const color = tone === 'onBrand' ? 'onBrand' : 'text';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }} accessibilityRole="adjustable" accessibilityLabel={`Periodo: ${ymLabel(value)}`}>
      <IconButton icon="chevron-left" label="Mes anterior" onPress={() => onChange(addMonthsYM(value, -1))} tone={tone === 'onBrand' ? 'onBrand' : 'soft'} size={36} />
      <Pressable onPress={() => onChange(currentYM())} style={{ minWidth: 128, alignItems: 'center', paddingHorizontal: space[2] }} accessibilityLabel="Ir al mes actual">
        <Text variant="bodyStrong" color={color}>{capitalize(ymLabel(value))}</Text>
        {!isCurrent && <Text variant="caption" color={tone === 'onBrand' ? 'accent' : 'brand'}>Volver a hoy</Text>}
      </Pressable>
      <IconButton icon="chevron-right" label="Mes siguiente" onPress={() => onChange(addMonthsYM(value, 1))} tone={tone === 'onBrand' ? 'onBrand' : 'soft'} size={36} />
    </View>
  );
}

/** Mini selector de categoría en grilla (registro rápido). */
export function CategoryGrid({ categories, value, onChange }: { categories: Category[]; value: string | null; onChange: (id: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {categories.map((c) => {
        const sel = c.id === value;
        return (
          <Pressable
            key={c.id}
            testID={`cat-${c.name}`}
            onPress={() => onChange(c.id)}
            haptic
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={c.name}
            style={{ width: '23%', minWidth: 72, flexGrow: 1, alignItems: 'center', gap: 6, paddingVertical: space[3], borderRadius: radius.md, borderWidth: 1.5, borderColor: sel ? colors.brand : colors.border, backgroundColor: sel ? colors.brandSoft : colors.surface }}
          >
            <IconTile icon={c.icon} color={c.color} size={34} />
            <Text variant="caption" numberOfLines={1} style={{ fontSize: 12, paddingHorizontal: 4 }} color={sel ? 'brand' : 'text'}>{c.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
