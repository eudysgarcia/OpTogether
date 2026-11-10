import React, { useEffect, useState } from 'react';
import { useFinanceMutation } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { Banner, Button, Header, Input, KeyValue, Screen } from '../../../components/ui';
import { supabase, unwrap } from '../../../lib/supabase';

export default function HouseholdSettings() {
  const { household, isAdmin } = useHH();
  const [name, setName] = useState('');
  useEffect(() => { if (household) setName(household.name); }, [household?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useFinanceMutation(async () => unwrap(await supabase.from('households').update({ name: name.trim() }).eq('id', household!.id).select('id')), { success: 'Hogar actualizado' });
  return (
    <Screen header={<Header title="Hogar" back />} footer={isAdmin ? <Button title="Guardar" disabled={!name.trim()} loading={save.isPending} onPress={() => save.mutate(undefined as never)} /> : undefined}>
      {!isAdmin && <Banner tone="info" title="Solo el administrador puede editar el hogar" />}
      <Input label="Nombre del hogar" value={name} onChangeText={setName} editable={isAdmin} maxLength={80} />
      <KeyValue label="Moneda" value="DOP (RD$)" />
      <KeyValue label="Zona horaria" value={household?.timezone ?? 'America/Santo_Domingo'} />
    </Screen>
  );
}
