import React, { useState } from 'react';
import { useFinanceMutation } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { Banner, Button, Header, Input, KeyValue, Loading, Screen } from '../../../components/ui';
import { db, unwrap } from '../../../lib/api';

export default function HouseholdSettingsScreen() {
  const { household } = useHH();
  if (!household) return <Screen header={<Header title="Hogar" back />}><Loading /></Screen>;
  return <HouseholdSettings key={household.id} initialName={household.name} />;
}

function HouseholdSettings({ initialName }: { initialName: string }) {
  const { household, isAdmin } = useHH();
  const [name, setName] = useState(initialName);
  const save = useFinanceMutation(async () => unwrap(await db.from('households').update({ name: name.trim() }).eq('id', household!.id).select('id')), { success: 'Hogar actualizado' });
  return (
    <Screen header={<Header title="Hogar" back />} footer={isAdmin ? <Button title="Guardar" disabled={!name.trim()} loading={save.isPending} onPress={() => save.mutate(undefined as never)} /> : undefined}>
      {!isAdmin && <Banner tone="info" title="Solo el administrador puede editar el hogar" />}
      <Input label="Nombre del hogar" value={name} onChangeText={setName} editable={isAdmin} maxLength={80} />
      <KeyValue label="Moneda" value="DOP (RD$)" />
      <KeyValue label="Zona horaria" value={household?.timezone ?? 'America/Santo_Domingo'} />
    </Screen>
  );
}
