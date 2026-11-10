import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useBill, useCategories, useFinanceMutation } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { Button, Chip, ChipRow, Header, Input, Loading, Screen, Segmented, Select, Switch, Text } from '../../../components/ui';
import { BILL_KIND } from '../../../lib/labels';
import { parseAmount } from '../../../lib/money';
import { supabase, unwrap } from '../../../lib/supabase';
import { space } from '../../../theme/tokens';

const OFFSETS = [10, 5, 3, 1, 0, -1, -3];
const offsetLabel = (o: number) => (o > 0 ? `${o} días antes` : o === 0 ? 'El día' : `${-o} día(s) después`);

type BillFormState = { name: string; provider: string; kind: string; categoryId: string | null; amount: string; amountType: string; dueDay: string; frequency: string; responsible: string | null; offsets: number[]; active: boolean };

export default function BillFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useBill(id);
  if (id && !existing.data) return <Screen header={<Header title="Editar servicio" back />}><Loading /></Screen>;
  const b = existing.data;
  const initial = b ? { name: b.name, provider: b.provider ?? '', kind: b.kind, categoryId: b.category_id, amount: String(b.estimated_amount), amountType: b.amount_type, dueDay: String(b.due_day), frequency: b.frequency, responsible: b.responsible_member_id, offsets: b.reminder_offsets, active: b.active } : undefined;
  return <BillForm key={id ?? 'new'} id={id} initial={initial} />;
}

function BillForm({ id, initial }: { id?: string; initial?: BillFormState }) {
  const { hid, members } = useHH();
  const cats = useCategories();
  const [f, setF] = useState<BillFormState>(initial ?? {
    name: '', provider: '', kind: 'other', categoryId: null, amount: '', amountType: 'fixed', dueDay: '1',
    frequency: 'monthly', responsible: null, offsets: [10, 5, 1, 0, -1], active: true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const day = Number(f.dueDay);
  const valid = f.name.trim() && f.categoryId && parseAmount(f.amount) !== null && Number.isInteger(day) && day >= 1 && day <= 31;
  const save = useFinanceMutation(
    async () => {
      const row = {
        name: f.name.trim(), provider: f.provider.trim() || null, kind: f.kind, category_id: f.categoryId!, estimated_amount: parseAmount(f.amount) ?? 0,
        amount_type: f.amountType, due_day: day, frequency: f.frequency, responsible_member_id: f.responsible, reminder_offsets: [...f.offsets].sort((a, b) => b - a), active: f.active,
      };
      if (id) return unwrap(await supabase.from('bills').update(row).eq('id', id).select('id').single());
      return unwrap(await supabase.from('bills').insert({ ...row, household_id: hid, scope: 'household' }).select('id').single());
    },
    { success: id ? 'Servicio actualizado' : 'Servicio creado', onSuccess: (r) => (id ? router.back() : router.replace(`/payments/${r!.id}`)) },
  );
  return (
    <Screen header={<Header title={id ? 'Editar servicio' : 'Nuevo servicio'} back />} footer={<Button title="Guardar" disabled={!valid} loading={save.isPending} onPress={() => save.mutate(undefined as never)} />}>
      <Select label="Tipo" value={f.kind} options={Object.entries(BILL_KIND).map(([k, v]) => ({ value: k, label: v.label, icon: v.icon }))} onChange={(v) => { set('kind', v ?? 'other'); if (!f.name) set('name', BILL_KIND[v ?? 'other'].label); }} />
      <Input label="Nombre" value={f.name} onChangeText={(v) => set('name', v)} maxLength={50} required />
      <Input label="Proveedor" value={f.provider} onChangeText={(v) => set('provider', v)} placeholder="Ej.: Edesur, Claro, Altice" />
      <Select label="Categoría del presupuesto" value={f.categoryId} options={(cats.data ?? []).filter((c) => c.scope === 'household' && c.kind !== 'income').map((c) => ({ value: c.id, label: c.name, icon: c.icon, color: c.color }))} onChange={(v) => set('categoryId', v)} />
      <Segmented options={[{ value: 'fixed', label: 'Monto fijo' }, { value: 'variable', label: 'Variable' }]} value={f.amountType} onChange={(v) => set('amountType', v)} />
      <Input label={f.amountType === 'fixed' ? 'Monto (RD$)' : 'Monto estimado (RD$)'} value={f.amount} keyboardType="decimal-pad" onChangeText={(v) => set('amount', v)} />
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <View style={{ flex: 1 }}><Input label="Día de vencimiento" value={f.dueDay} keyboardType="number-pad" maxLength={2} onChangeText={(v) => set('dueDay', v.replace(/\D/g, ''))} /></View>
        <View style={{ flex: 1 }}><Select label="Frecuencia" value={f.frequency} options={[{ value: 'weekly', label: 'Semanal' }, { value: 'monthly', label: 'Mensual' }, { value: 'bimonthly', label: 'Bimestral' }, { value: 'quarterly', label: 'Trimestral' }, { value: 'yearly', label: 'Anual' }]} onChange={(v) => set('frequency', v ?? 'monthly')} /></View>
      </View>
      {f.frequency === 'weekly' && <Text variant="caption" color="textSecondary">Para pagos semanales el día se interpreta como día de la semana (1 = lunes … 7 = domingo).</Text>}
      <Select label="Responsable" value={f.responsible} allowClear placeholder="Ambos" options={members.map((m) => ({ value: m.id, label: m.display_name, icon: 'user' }))} onChange={(v) => set('responsible', v)} />
      <View style={{ gap: space[2] }}>
        <Text variant="label" color="textSecondary">Recordatorios</Text>
        <ChipRow>
          {OFFSETS.map((o) => <Chip key={o} label={offsetLabel(o)} selected={f.offsets.includes(o)} onPress={() => set('offsets', f.offsets.includes(o) ? f.offsets.filter((x) => x !== o) : [...f.offsets, o])} />)}
        </ChipRow>
        <Text variant="caption" color="textSecondary">Al registrar el pago del ciclo se detienen sus recordatorios.</Text>
      </View>
      {id && <Switch label="Servicio activo" description="Si lo desactivas no se crearán nuevos ciclos." value={f.active} onChange={(v) => set('active', v)} />}
    </Screen>
  );
}
