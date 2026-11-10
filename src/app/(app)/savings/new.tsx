import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { useFinanceMutation, useGoals } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { Button, DateField, Header, Input, Loading, Screen, Select, Switch } from '../../../components/ui';
import { addMonthsISO, todayISO } from '../../../lib/dates';
import { GOAL_KIND } from '../../../lib/labels';
import { parseAmount } from '../../../lib/money';
import { db, unwrap } from '../../../lib/api';
import type { Scope } from '../../../types/models';

type GoalFormState = { name: string; kind: string; target: string; hasDate: boolean; date: string; commitments: Record<string, string> };

export default function GoalFormScreen() {
  const { id, scope = 'household' } = useLocalSearchParams<{ id?: string; scope?: Scope }>();
  const goals = useGoals(scope, true);
  const existing = goals.data?.find((g) => g.id === id);
  if (id && !existing) return <Screen header={<Header title="Editar meta" back />}><Loading /></Screen>;
  const initial = existing ? { name: existing.name, kind: existing.kind, target: existing.target_amount ? String(existing.target_amount) : '', hasDate: !!existing.target_date, date: existing.target_date ?? addMonthsISO(todayISO(), 12), commitments: Object.fromEntries(Object.entries((existing.commitments as Record<string, number>) ?? {}).map(([k, v]) => [k, String(v)])) } : undefined;
  return <GoalForm key={id ?? 'new'} id={id} scope={scope} initial={initial} />;
}

function GoalForm({ id, scope, initial }: { id?: string; scope: Scope; initial?: GoalFormState }) {
  const { hid, members, me } = useHH();
  const [f, setF] = useState<GoalFormState>(initial ?? { name: '', kind: 'house', target: '', hasDate: false, date: addMonthsISO(todayISO(), 12), commitments: {} });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = useFinanceMutation(
    async () => {
      const commitments = Object.fromEntries(Object.entries(f.commitments).map(([k, v]) => [k, parseAmount(v) ?? 0]).filter(([, v]) => (v as number) > 0));
      const row = { name: f.name.trim(), kind: f.kind, icon: GOAL_KIND[f.kind].icon, target_amount: parseAmount(f.target) || null, target_date: f.hasDate ? f.date : null, commitments };
      if (id) return unwrap(await db.from('savings_goals').update(row).eq('id', id).select('id').single());
      return unwrap(await db.from('savings_goals').insert({ ...row, household_id: hid, scope }).select('id').single());
    },
    { success: id ? 'Meta actualizada' : 'Meta creada', onSuccess: (r) => (id ? router.back() : router.replace(`/savings/${r!.id}`)) },
  );
  const people = scope === 'personal' ? members.filter((m) => m.id === me?.id) : members;
  return (
    <Screen header={<Header title={id ? 'Editar meta' : 'Nueva meta'} subtitle={scope === 'personal' ? 'Privada' : 'Compartida'} back />} footer={<Button title="Guardar" disabled={!f.name.trim()} loading={save.isPending} onPress={() => save.mutate(undefined as never)} />}>
      <Select label="Tipo" value={f.kind} options={Object.entries(GOAL_KIND).map(([k, v]) => ({ value: k, label: v.label, icon: v.icon }))} onChange={(v) => { set('kind', v ?? 'other'); if (!f.name) set('name', GOAL_KIND[v ?? 'other'].label); }} />
      <Input label="Nombre" required value={f.name} onChangeText={(v) => set('name', v)} maxLength={50} />
      <Input label="Monto objetivo (RD$)" value={f.target} onChangeText={(v) => set('target', v)} keyboardType="decimal-pad" helper="Opcional" />
      <Switch label="Fecha objetivo" value={f.hasDate} onChange={(v) => set('hasDate', v)} />
      {f.hasDate && <DateField label="Lograrlo para" value={f.date} onChange={(v) => set('date', v)} />}
      {people.map((m) => (
        <Input key={m.id} label={`Aporte mensual de ${m.display_name} (RD$)`} value={f.commitments[m.id] ?? ''} keyboardType="decimal-pad" onChangeText={(v) => set('commitments', { ...f.commitments, [m.id]: v })} />
      ))}
    </Screen>
  );
}
