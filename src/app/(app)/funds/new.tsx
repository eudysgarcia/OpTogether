import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useFinanceMutation, useFunds } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { Banner, Button, Header, Input, Screen, Select } from '../../../components/ui';
import { FUND_KIND } from '../../../lib/labels';
import { parseAmount } from '../../../lib/money';
import { supabase, unwrap } from '../../../lib/supabase';
import type { Scope } from '../../../types/models';

export default function FundForm() {
  const { id, scope = 'household' } = useLocalSearchParams<{ id?: string; scope?: Scope }>();
  const { hid, members } = useHH();
  const funds = useFunds(scope, true);
  const existing = funds.data?.find((f) => f.id === id);
  const [f, setF] = useState({ name: '', kind: scope === 'personal' ? 'wallet' : 'custom', initial: '0', responsible: null as string | null });
  useEffect(() => {
    if (existing) setF({ name: existing.name, kind: existing.kind, initial: String(existing.initial_balance), responsible: existing.responsible_member_id });
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useFinanceMutation(
    async () => {
      const row = { name: f.name.trim(), kind: f.kind, icon: FUND_KIND[f.kind].icon, initial_balance: parseAmount(f.initial) ?? 0, responsible_member_id: f.responsible };
      if (id) return unwrap(await supabase.from('funds').update(row).eq('id', id).select('id').single());
      return unwrap(await supabase.from('funds').insert({ ...row, household_id: hid, scope }).select('id').single());
    },
    { success: id ? 'Fondo actualizado' : 'Fondo creado', onSuccess: (r) => (id ? router.back() : router.replace(`/funds/${r!.id}`)) },
  );
  return (
    <Screen header={<Header title={id ? 'Editar fondo' : 'Nuevo fondo'} back />} footer={<Button title="Guardar" disabled={!f.name.trim() || parseAmount(f.initial) === null} loading={save.isPending} onPress={() => save.mutate(undefined as never)} />}>
      <Select label="Tipo" value={f.kind} options={Object.entries(FUND_KIND).map(([k, v]) => ({ value: k, label: v.label, icon: v.icon }))} onChange={(v) => setF({ ...f, kind: v ?? 'custom', name: f.name || FUND_KIND[v ?? 'custom'].label })} />
      <Input label="Nombre" required value={f.name} onChangeText={(v) => setF({ ...f, name: v })} maxLength={50} />
      <Input label="Saldo inicial real (RD$)" value={f.initial} onChangeText={(v) => setF({ ...f, initial: v })} keyboardType="decimal-pad" helper="Solo el dinero que realmente hay hoy en este fondo." />
      {scope === 'household' && <Select label="Responsable" value={f.responsible} allowClear placeholder="Ambos" options={members.map((m) => ({ value: m.id, label: m.display_name, icon: 'user' }))} onChange={(v) => setF({ ...f, responsible: v })} />}
      {id && <Banner tone="warning" title="Cambiar el saldo inicial recalcula el saldo actual" message="El cambio queda auditado. Para ajustes del día a día usa Reponer o Retirar." />}
    </Screen>
  );
}
