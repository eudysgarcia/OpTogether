import React, { useState } from 'react';
import { View } from 'react-native';
import { useFinanceMutation } from '../../../api/finance';
import { currentIncomes, useHH, useIncomes } from '../../../api/household';
import { Avatar, Banner, Button, Card, DateField, Divider, Header, Input, KeyValue, Money, Screen, SectionHeader, Sheet, Text } from '../../../components/ui';
import { formatDate, todayISO } from '../../../lib/dates';
import { formatMoney, parseAmount, sum } from '../../../lib/money';
import { db, unwrap } from '../../../lib/api';
import { space } from '../../../theme/tokens';
import type { Member } from '../../../types/models';

export default function Incomes() {
  const { hid, members, memberName } = useHH();
  const q = useIncomes();
  const cur = currentIncomes(q.data, todayISO());
  const [edit, setEdit] = useState<Member | null>(null);
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState(todayISO().slice(0, 8) + '01');
  const save = useFinanceMutation(
    async () => unwrap(await db.from('income_records').upsert({ household_id: hid, member_id: edit!.id, amount: parseAmount(amount)!, effective_from: from, note: 'Actualización' }, { onConflict: 'member_id,effective_from' }).select('id')),
    { success: 'Ingreso actualizado', onSuccess: () => setEdit(null) },
  );
  return (
    <Screen header={<Header title="Ingresos" back />} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Card>
        <Text variant="caption" color="textSecondary">Ingreso total del hogar</Text>
        <Money value={sum(Object.values(cur))} variant="amountXL" />
      </Card>
      <Card>
        {members.map((m, i) => (
          <View key={m.id}>
            {i > 0 && <Divider inset={52} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] }}>
              <Avatar name={m.display_name} color={m.color} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{m.display_name}</Text>
                <Money value={cur[m.id] ?? 0} variant="amountS" />
              </View>
              <Button title="Actualizar" size="sm" variant="secondary" full={false} onPress={() => { setEdit(m); setAmount(String(cur[m.id] ?? '')); }} />
            </View>
          </View>
        ))}
      </Card>
      <Banner tone="info" title="Se usa para referencias y el simulador" message="Las aportaciones esperadas dependen de la distribución de cada categoría, que configuras en Presupuesto." />
      <View>
        <SectionHeader title="Historial" />
        <Card>{(q.data ?? []).map((r) => <KeyValue key={r.id} label={`${memberName(r.member_id)} · desde ${formatDate(r.effective_from)}`} value={formatMoney(r.amount)} />)}</Card>
      </View>
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={`Ingreso de ${edit?.display_name ?? ''}`} footer={<Button title="Guardar" disabled={parseAmount(amount) === null} loading={save.isPending} onPress={() => save.mutate(undefined as never)} />}>
        <Input label="Ingreso mensual (RD$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <DateField label="Vigente desde" value={from} onChange={setFrom} />
        <Text variant="caption" color="textSecondary">Se conserva el historial de ingresos anteriores.</Text>
      </Sheet>
    </Screen>
  );
}
