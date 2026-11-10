import React, { useState } from 'react';
import { View } from 'react-native';
import { useCategories, useFinanceMutation, useFunds } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { Button, Card, Divider, Header, IconButton, IconTile, Input, ListRow, PICKABLE_ICONS, Pressable, Screen, Segmented, Select, Sheet, Switch, Text } from '../../../components/ui';
import { CHART_COLORS } from '../../../components/charts/Charts';
import { supabase, unwrap } from '../../../lib/supabase';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import type { Category } from '../../../types/models';

type Form = { id?: string; name: string; icon: string; color: string; kind: string; parent: string | null; variable: boolean; fund: string | null; personal: boolean };
const EMPTY: Form = { name: '', icon: 'tag', color: CHART_COLORS[0], kind: 'expense', parent: null, variable: true, fund: null, personal: false };

export default function Categories() {
  const { colors } = useTheme();
  const { hid } = useHH();
  const q = useCategories(true);
  const funds = useFunds();
  const [form, setForm] = useState<Form | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const list = (q.data ?? []).filter((c) => (showArchived ? true : !c.archived_at));
  const parents = list.filter((c) => !c.parent_id);
  const save = useFinanceMutation(async () => {
    const f = form!;
    const row = { name: f.name.trim(), icon: f.icon, color: f.color, kind: f.kind, parent_id: f.parent, is_variable: f.variable, linked_fund_id: f.personal ? null : f.fund };
    if (f.id) return unwrap(await supabase.from('categories').update(row).eq('id', f.id).select('id'));
    return unwrap(await supabase.from('categories').insert({ ...row, household_id: hid, scope: f.personal ? 'personal' : 'household' }).select('id'));
  }, { success: 'Categoría guardada', onSuccess: () => setForm(null) });
  const archive = useFinanceMutation(async (c: Category) => unwrap(await supabase.from('categories').update({ archived_at: c.archived_at ? null : new Date().toISOString() }).eq('id', c.id).select('id')), { success: 'Categoría actualizada' });
  const open = (c?: Category) => setForm(c ? { id: c.id, name: c.name, icon: c.icon, color: c.color, kind: c.kind, parent: c.parent_id, variable: c.is_variable, fund: c.linked_fund_id, personal: c.scope === 'personal' } : { ...EMPTY });
  return (
    <Screen header={<Header title="Categorías" back right={<IconButton icon="plus" label="Nueva categoría" onPress={() => open()} />} />}>
      <Switch label="Mostrar archivadas" value={showArchived} onChange={setShowArchived} />
      <Card>
        {parents.map((p, i) => (
          <View key={p.id}>
            {i > 0 && <Divider inset={52} />}
            <ListRow icon={p.icon} iconColor={p.color} title={`${p.name}${p.archived_at ? ' (archivada)' : ''}`} subtitle={[p.kind === 'fund' ? 'Fondo' : p.kind === 'income' ? 'Ingreso' : 'Gasto', p.scope === 'personal' ? 'Privada' : null, p.is_variable ? 'Variable' : 'Fija'].filter(Boolean).join(' · ')} onPress={() => open(p)} right={<IconButton icon="archive" label="Archivar" onPress={() => archive.mutate(p)} />} />
            {list.filter((c) => c.parent_id === p.id).map((c) => (
              <View key={c.id} style={{ paddingLeft: space[8] }}>
                <ListRow icon={c.icon} iconColor={c.color} title={c.name} subtitle="Subcategoría" onPress={() => open(c)} />
              </View>
            ))}
          </View>
        ))}
      </Card>
      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? 'Editar categoría' : 'Nueva categoría'} footer={<Button title="Guardar" disabled={!form?.name.trim()} loading={save.isPending} onPress={() => save.mutate(undefined as never)} />}>
        {form && (
          <>
            <Input label="Nombre" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} maxLength={50} />
            {!form.id && <Segmented options={[{ value: 'household', label: 'Del hogar' }, { value: 'personal', label: 'Personal (privada)' }]} value={form.personal ? 'personal' : 'household'} onChange={(v) => setForm({ ...form, personal: v === 'personal' })} />}
            <Segmented options={[{ value: 'expense', label: 'Gasto' }, { value: 'fund', label: 'Fondo' }, { value: 'income', label: 'Ingreso' }]} value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} />
            <Select label="Categoría padre (para subcategorías)" value={form.parent} allowClear placeholder="Ninguna (principal)" options={parents.filter((p) => p.id !== form.id && p.kind === form.kind).map((p) => ({ value: p.id, label: p.name, icon: p.icon }))} onChange={(v) => setForm({ ...form, parent: v })} />
            {form.kind === 'fund' && !form.personal && <Select label="Fondo vinculado" value={form.fund} allowClear options={(funds.data ?? []).map((f) => ({ value: f.id, label: f.name, icon: f.icon }))} onChange={(v) => setForm({ ...form, fund: v })} />}
            <Switch label="Monto variable" value={form.variable} onChange={(v) => setForm({ ...form, variable: v })} />
            <Text variant="label" color="textSecondary">Icono</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              {PICKABLE_ICONS.map((ic) => (
                <Pressable key={ic} onPress={() => setForm({ ...form, icon: ic })} accessibilityLabel={ic} style={{ borderRadius: radius.md, borderWidth: 2, borderColor: form.icon === ic ? colors.brand : 'transparent' }}>
                  <IconTile icon={ic} color={form.color} size={40} />
                </Pressable>
              ))}
            </View>
            <Text variant="label" color="textSecondary">Color</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              {CHART_COLORS.map((c) => (
                <Pressable key={c} onPress={() => setForm({ ...form, color: c })} accessibilityLabel={`Color ${c}`} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: 3, borderColor: form.color === c ? colors.text : 'transparent' }} />
              ))}
            </View>
          </>
        )}
      </Sheet>
    </Screen>
  );
}
