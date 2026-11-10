import React, { useState } from 'react';
import { View } from 'react-native';
import { useFinanceMutation, usePaymentMethods } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { Button, Card, Divider, Header, IconButton, Input, ListRow, Screen, Select, Sheet } from '../../../components/ui';
import { db, unwrap } from '../../../lib/api';

const KINDS = [{ value: 'cash', label: 'Efectivo', icon: 'cash' }, { value: 'debit', label: 'Débito', icon: 'card' }, { value: 'credit', label: 'Crédito', icon: 'card' }, { value: 'transfer', label: 'Transferencia', icon: 'transfer' }, { value: 'other', label: 'Otro', icon: 'more' }];

export default function PaymentMethods() {
  const { hid } = useHH();
  const q = usePaymentMethods();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('other');
  const add = useFinanceMutation(async () => unwrap(await db.from('payment_methods').insert({ household_id: hid, name: name.trim(), kind }).select('id')), { success: 'Método agregado', onSuccess: () => { setOpen(false); setName(''); } });
  const archive = useFinanceMutation(async (id: string) => unwrap(await db.from('payment_methods').update({ archived_at: new Date().toISOString() }).eq('id', id).select('id')), { success: 'Método archivado' });
  return (
    <Screen header={<Header title="Métodos de pago" back right={<IconButton icon="plus" label="Agregar" onPress={() => setOpen(true)} />} />}>
      <Card>
        {(q.data ?? []).map((m, i) => (
          <View key={m.id}>
            {i > 0 && <Divider inset={52} />}
            <ListRow icon={KINDS.find((k) => k.value === m.kind)?.icon ?? 'card'} title={m.name} subtitle={KINDS.find((k) => k.value === m.kind)?.label} right={<IconButton icon="archive" label={`Archivar ${m.name}`} onPress={() => archive.mutate(m.id)} />} />
          </View>
        ))}
      </Card>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Nuevo método" footer={<Button title="Agregar" disabled={!name.trim()} loading={add.isPending} onPress={() => add.mutate(undefined as never)} />}>
        <Input label="Nombre" value={name} onChangeText={setName} placeholder="Ej.: Tarjeta Popular" maxLength={40} />
        <Select label="Tipo" value={kind} options={KINDS} onChange={(v) => setKind(v ?? 'other')} />
      </Sheet>
    </Screen>
  );
}
