import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useBillCycles, useDebts, useFinanceMutation, useGoals, useReminders, useTransactions } from '../../api/finance';
import { useHH } from '../../api/household';
import { PeriodSelector } from '../../components/finance';
import { Button, Card, DateField, EmptyState, Header, Icon, IconButton, type IconName, Input, Pressable, Screen, Segmented, Sheet, Text, Switch } from '../../components/ui';
import { installmentSchedule } from '../../domain/debts';
import { WEEKDAYS_SHORT, addDaysISO, currentYM, formatDate, monthGrid, monthRange, todayISO, weekOf, type Frequency } from '../../lib/dates';
import { BILL_STATUS_UI } from '../../lib/labels';
import { formatMoney } from '../../lib/money';
import { supabase, unwrap } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

type Ev = { date: string; title: string; subtitle: string; icon: IconName; color: string; route?: string; done?: boolean };

export default function CalendarScreen() {
  const { colors } = useTheme();
  const { hid, memberName } = useHH();
  const [ym, setYm] = useState(currentYM());
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [selected, setSelected] = useState(todayISO());
  const [adding, setAdding] = useState(false);
  const [rem, setRem] = useState({ title: '', date: todayISO(), note: '', personal: false });
  const r = monthRange(ym);
  const from = addDaysISO(r.from, -7);
  const to = addDaysISO(r.to, 7);
  const cycles = useBillCycles({ from, to });
  const debts = useDebts();
  const goals = useGoals();
  const reminders = useReminders(from, to);
  const txs = useTransactions({ from, to, types: ['income', 'contribution', 'savings_deposit'] });

  const events = useMemo(() => {
    const ev: Ev[] = [];
    for (const c of cycles.data ?? []) {
      const ui = BILL_STATUS_UI[c.status ?? 'pending'];
      ev.push({ date: c.due_date!, title: c.bill_name!, subtitle: `${ui.label} · ${formatMoney(c.expected_amount)}`, icon: 'receipt', color: c.status === 'overdue' ? colors.negative : c.status === 'paid' ? colors.positive : colors.brand, route: `/payments/${c.bill_id}`, done: c.status === 'paid' || c.status === 'cancelled' });
    }
    for (const d of debts.data ?? []) {
      const sched = installmentSchedule({ startDate: d.start_date!, frequency: d.frequency as Frequency, installmentAmount: d.installment_amount, installmentsCount: d.installments_count, paid: Number(d.paid) });
      const items = sched.length ? sched : d.next_due_date ? [{ number: 0, dueDate: d.next_due_date, amount: d.installment_amount ?? Number(d.balance), status: 'pending' as const }] : [];
      for (const i of items) if (i.dueDate >= from && i.dueDate <= to) ev.push({ date: i.dueDate, title: `Cuota ${d.name}${i.number ? ` #${i.number}` : ''}`, subtitle: `${formatMoney(i.amount)}${i.status === 'paid' ? ' · pagada' : ''}`, icon: 'card', color: colors.debt, route: `/debts/${d.id}`, done: i.status === 'paid' });
    }
    for (const g of goals.data ?? []) if (g.target_date && g.target_date >= from && g.target_date <= to) ev.push({ date: g.target_date, title: `Meta: ${g.name}`, subtitle: 'Fecha objetivo', icon: 'target', color: colors.savings, route: `/savings/${g.id}` });
    for (const x of reminders.data ?? []) ev.push({ date: x.remind_on, title: x.title, subtitle: x.scope === 'personal' ? 'Recordatorio privado' : 'Recordatorio', icon: 'bell', color: colors.warning, done: !!x.done_at });
    for (const t of txs.data ?? []) ev.push({ date: t.occurred_on, title: t.description, subtitle: `${t.type === 'income' ? 'Ingreso' : t.type === 'contribution' ? 'Aportación' : 'Ahorro'} · ${formatMoney(t.amount)}${t.member_id ? ` · ${memberName(t.member_id)}` : ''}`, icon: t.type === 'income' ? 'arrow-in' : t.type === 'contribution' ? 'hand-coins' : 'piggy-bank', color: t.type === 'savings_deposit' ? colors.savings : colors.positive, route: `/transaction/${t.id}`, done: true });
    return ev;
  }, [cycles.data, debts.data, goals.data, reminders.data, txs.data, colors, from, to, memberName]);

  const byDay = useMemo(() => {
    const m = new Map<string, Ev[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);

  const addReminder = useFinanceMutation(
    async () => unwrap(await supabase.from('reminders').insert({ household_id: hid, scope: rem.personal ? 'personal' : 'household', title: rem.title.trim(), note: rem.note.trim() || null, remind_on: rem.date })),
    { success: 'Recordatorio creado', onSuccess: () => { setAdding(false); setRem({ title: '', date: todayISO(), note: '', personal: false }); } },
  );

  const weeks = mode === 'month' ? monthGrid(ym) : [weekOf(selected)];
  const today = todayISO();
  const dayEvents = (byDay.get(selected) ?? []).sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <Screen testID="screen-calendar" header={<Header title="Calendario" back right={<IconButton icon="plus" label="Nuevo recordatorio" onPress={() => { setRem((p) => ({ ...p, date: selected })); setAdding(true); }} />} />}>
      <Segmented options={[{ value: 'month', label: 'Mes' }, { value: 'week', label: 'Semana' }]} value={mode} onChange={setMode} />
      {mode === 'month' ? (
        <View style={{ alignItems: 'center' }}><PeriodSelector value={ym} onChange={setYm} /></View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2] }}>
          <IconButton icon="chevron-left" label="Semana anterior" tone="soft" size={36} onPress={() => setSelected(addDaysISO(selected, -7))} />
          <Text variant="bodyStrong">{formatDate(weekOf(selected)[0], 'day')} – {formatDate(weekOf(selected)[6], 'day')}</Text>
          <IconButton icon="chevron-right" label="Semana siguiente" tone="soft" size={36} onPress={() => setSelected(addDaysISO(selected, 7))} />
        </View>
      )}
      <Card padded={false} style={{ padding: space[2] }}>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS_SHORT.map((d, i) => <Text key={i} variant="overline" color="textTertiary" align="center" style={{ flex: 1, paddingVertical: space[2] }}>{d}</Text>)}
        </View>
        {weeks.map((w, i) => (
          <View key={i} style={{ flexDirection: 'row' }}>
            {w.map((d, j) => {
              if (!d) return <View key={j} style={{ flex: 1, aspectRatio: 1 }} />;
              const evs = byDay.get(d) ?? [];
              const sel = d === selected;
              const isToday = d === today;
              const hasOverdue = evs.some((e) => e.color === colors.negative && !e.done);
              return (
                <Pressable key={d} onPress={() => setSelected(d)} scaleTo={0.9} accessibilityLabel={`${formatDate(d, 'long')}, ${evs.length} evento(s)`}
                  style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: sel ? colors.brand : isToday ? colors.brandSoft : 'transparent', gap: 3 }}>
                  <Text variant="label" color={sel ? 'onBrand' : 'text'}>{Number(d.slice(8))}</Text>
                  <View style={{ flexDirection: 'row', gap: 2, height: 5 }}>
                    {evs.slice(0, 3).map((e, k) => <View key={k} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: sel ? colors.accent : hasOverdue ? colors.negative : e.color, opacity: e.done ? 0.4 : 1 }} />)}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>
      <Text variant="h3">{formatDate(selected, 'long')}</Text>
      <Card>
        {dayEvents.length ? dayEvents.map((e, i) => (
          <Pressable key={i} onPress={e.route ? () => router.push(e.route as never) : undefined} disabled={!e.route} scaleTo={0.985}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2], minHeight: 56, opacity: e.done ? 0.65 : 1 }}>
            <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: e.color }} />
            <Icon name={e.icon} size={18} color={e.color} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" numberOfLines={1}>{e.title}</Text>
              <Text variant="caption" color="textSecondary">{e.subtitle}</Text>
            </View>
            {e.done && <Icon name="check" size={16} color={colors.positive} />}
          </Pressable>
        )) : <EmptyState compact icon="calendar" title="Sin eventos este día" />}
      </Card>
      <Sheet visible={adding} onClose={() => setAdding(false)} title="Nuevo recordatorio" footer={<Button title="Crear" disabled={rem.title.trim().length < 1} loading={addReminder.isPending} onPress={() => addReminder.mutate(undefined as never)} />}>
        <Input label="Título" value={rem.title} onChangeText={(v) => setRem({ ...rem, title: v })} maxLength={80} placeholder="Ej.: Renovar seguro del carro" />
        <DateField label="Fecha" value={rem.date} onChange={(v) => setRem({ ...rem, date: v })} />
        <Input label="Nota" value={rem.note} onChangeText={(v) => setRem({ ...rem, note: v })} multiline />
        <Switch label="Privado" description="Solo tú lo verás" value={rem.personal} onChange={(v) => setRem({ ...rem, personal: v })} />
      </Sheet>
    </Screen>
  );
}
