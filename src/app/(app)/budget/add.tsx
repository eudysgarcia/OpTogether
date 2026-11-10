import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { useAllocations, useCategories, useFinanceMutation, usePeriod } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { Banner, Button, Header, Input, Screen, Select, Switch, Text } from '../../../components/ui';
import { capitalize, ymLabel } from '../../../lib/dates';
import { parseAmount } from '../../../lib/money';
import { supabase, unwrap } from '../../../lib/supabase';

/** Agrega una categoría al presupuesto del mes (recurrente o extraordinaria). */
export default function AddAllocation() {
  const p = useLocalSearchParams<{ y: string; m: string }>();
  const ym = { year: Number(p.y), month: Number(p.m) };
  const { hid, members } = useHH();
  const period = usePeriod(ym);
  const allocs = useAllocations(ym);
  const cats = useCategories();
  const [cat, setCat] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [recurring, setRecurring] = useState(true);
  const used = new Set((allocs.data ?? []).map((a) => a.category_id));
  const options = (cats.data ?? []).filter((c) => c.scope === 'household' && !c.parent_id && c.kind !== 'income' && !used.has(c.id)).map((c) => ({ value: c.id, label: c.name, icon: c.icon, color: c.color }));
  const save = useFinanceMutation(
    async () => unwrap(await supabase.from('budget_allocations').insert({
      household_id: hid, period_id: period.data!, category_id: cat!, amount: parseAmount(amount) ?? 0, is_recurring: recurring,
      shares: Object.fromEntries(members.map((m) => [m.id, 100 / members.length])),
    }).select('id').single()),
    { success: 'Categoría agregada al presupuesto', onSuccess: (r) => router.replace(`/budget/${r!.id}`) },
  );
  return (
    <Screen header={<Header title="Agregar al presupuesto" subtitle={capitalize(ymLabel(ym))} back />} footer={<Button title="Agregar" disabled={!cat || parseAmount(amount) === null || !period.data} loading={save.isPending} onPress={() => save.mutate(undefined as never)} />}>
      {options.length === 0 && <Banner tone="info" title="Todas las categorías ya tienen presupuesto" message="Crea una categoría nueva en Configuración → Categorías." action="Ir" onPress={() => router.push('/settings/categories')} />}
      <Select label="Categoría" value={cat} options={options} onChange={setCat} />
      <Input label="Monto estimado (RD$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Switch label="Recurrente" description="Desactívalo para un presupuesto extraordinario solo de este mes." value={recurring} onChange={setRecurring} />
      <Text variant="caption" color="textSecondary">La distribución inicia en partes iguales; puedes cambiarla luego en la categoría.</Text>
    </Screen>
  );
}
