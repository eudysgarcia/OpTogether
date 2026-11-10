import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useDebt, useFinanceMutation } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { Banner, Button, DateField, Header, Input, Screen, Select } from '../../../components/ui';
import { FREQUENCY_LABEL, todayISO, type Frequency } from '../../../lib/dates';
import { DEBT_KIND } from '../../../lib/labels';
import { parseAmount } from '../../../lib/money';
import { supabase, unwrap } from '../../../lib/supabase';
import { space } from '../../../theme/tokens';
import type { Scope } from '../../../types/models';

export default function DebtForm() {
  const { id, scope = 'household' } = useLocalSearchParams<{ id?: string; scope?: Scope }>();
  const { hid, members } = useHH();
  const existing = useDebt(id);
  const [f, setF] = useState({ name: '', creditor: '', kind: 'loan', original: '', rate: '', start: todayISO(), due: '', installment: '', frequency: 'monthly', count: '', responsible: null as string | null, notes: '' });
  useEffect(() => {
    const d = existing.data;
    if (d) setF({ name: d.name!, creditor: d.creditor ?? '', kind: d.kind!, original: String(d.original_amount), rate: d.interest_rate != null ? String(d.interest_rate) : '', start: d.start_date!, due: d.due_date ?? '', installment: d.installment_amount ? String(d.installment_amount) : '', frequency: d.frequency!, count: d.installments_count ? String(d.installments_count) : '', responsible: d.responsible_member_id, notes: d.notes ?? '' });
  }, [existing.data]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const original = parseAmount(f.original);
  const valid = f.name.trim() && original && original > 0 && (!f.rate || Number(f.rate) >= 0);
  const save = useFinanceMutation(
    async () => {
      const row = {
        name: f.name.trim(), creditor: f.creditor.trim() || null, kind: f.kind, original_amount: original!, interest_rate: f.rate ? Number(f.rate) : null,
        start_date: f.start, due_date: f.due || null, installment_amount: parseAmount(f.installment) || null, frequency: f.frequency,
        installments_count: f.count ? Number(f.count) : null, responsible_member_id: f.responsible, notes: f.notes.trim() || null,
      };
      if (id) return unwrap(await supabase.from('debts').update(row).eq('id', id).select('id').single());
      return unwrap(await supabase.from('debts').insert({ ...row, household_id: hid, scope }).select('id').single());
    },
    { success: id ? 'Deuda actualizada' : 'Deuda registrada', onSuccess: (r) => (id ? router.back() : router.replace(`/debts/${r!.id}`)) },
  );
  return (
    <Screen header={<Header title={id ? 'Editar deuda' : 'Nueva deuda'} subtitle={scope === 'personal' ? 'Privada' : 'Del hogar'} back />} footer={<Button title="Guardar" disabled={!valid} loading={save.isPending} onPress={() => save.mutate(undefined as never)} />}>
      <Select label="Tipo" value={f.kind} options={Object.entries(DEBT_KIND).map(([k, v]) => ({ value: k, label: v.label, icon: v.icon }))} onChange={(v) => set('kind', v ?? 'other')} />
      <Input label="Nombre" required value={f.name} onChangeText={(v) => set('name', v)} placeholder="Ej.: Préstamo del carro" maxLength={60} />
      <Input label="Acreedor" value={f.creditor} onChangeText={(v) => set('creditor', v)} placeholder="Banco, tienda o persona" />
      <Input label="Monto original (RD$)" required value={f.original} onChangeText={(v) => set('original', v)} keyboardType="decimal-pad" helper={id ? 'Cambiarlo recalcula el saldo; queda auditado.' : undefined} />
      <Input label="Tasa de interés anual (%)" value={f.rate} onChangeText={(v) => set('rate', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" helper="Déjalo vacío si no tiene interés o no lo conoces. Nunca se inventa una tasa." />
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <View style={{ flex: 1 }}><Input label="Cuota (RD$)" value={f.installment} onChangeText={(v) => set('installment', v)} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Input label="Nº de cuotas" value={f.count} onChangeText={(v) => set('count', v.replace(/\D/g, ''))} keyboardType="number-pad" /></View>
      </View>
      <Select label="Frecuencia" value={f.frequency} options={(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'one_time'] as Frequency[]).map((k) => ({ value: k, label: FREQUENCY_LABEL[k] }))} onChange={(v) => set('frequency', v ?? 'monthly')} />
      <DateField label="Fecha inicial" value={f.start} onChange={(v) => set('start', v)} />
      <DateField label="Vencimiento final (opcional)" value={f.due || f.start} onChange={(v) => set('due', v)} />
      {scope === 'household' && <Select label="Responsable" value={f.responsible} allowClear placeholder="Compartida" options={members.map((m) => ({ value: m.id, label: m.display_name, icon: 'user' }))} onChange={(v) => set('responsible', v)} />}
      <Input label="Notas" value={f.notes} onChangeText={(v) => set('notes', v)} multiline />
      {scope === 'personal' && <Banner tone="info" icon="lock" title="Deuda privada" message="Tu pareja no podrá verla." />}
    </Screen>
  );
}
