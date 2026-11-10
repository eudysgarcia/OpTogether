import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useCategories, useFinanceMutation, useFunds, useTransactions } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { TxRow } from '../../../components/finance';
import { Button, Card, ConfirmSheet, EmptyState, Header, IconButton, IconTile, KeyValue, Loading, Money, Screen, SectionHeader, Text } from '../../../components/ui';
import { FUND_KIND } from '../../../lib/labels';
import { formatMoney } from '../../../lib/money';
import { db, unwrap } from '../../../lib/api';
import { space } from '../../../theme/tokens';
import type { Scope } from '../../../types/models';

export default function FundDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { memberName } = useHH();
  const hh = useFunds('household', true);
  const pe = useFunds('personal', true);
  const f = [...(hh.data ?? []), ...(pe.data ?? [])].find((x) => x.id === id);
  const cats = useCategories(true);
  const txs = useTransactions({ fundId: id, scope: f?.scope as Scope | undefined, limit: 200 }, !!f);
  const [archive, setArchive] = useState(false);
  const arch = useFinanceMutation(
    async () => unwrap(await db.from('funds').update({ archived_at: f?.archived_at ? null : new Date().toISOString() }).eq('id', id!).select('id')),
    { success: 'Fondo actualizado', onSuccess: () => setArchive(false) },
  );
  if (!f) return <Screen header={<Header title="Fondo" back />}><Loading /></Screen>;
  const q = `scope=${f.scope}`;
  return (
    <Screen header={<Header title={f.name} subtitle={FUND_KIND[f.kind]?.label} back right={<IconButton icon="edit" label="Editar" onPress={() => router.push(`/funds/new?id=${f.id}&${q}`)} />} />} refreshing={txs.isRefetching} onRefresh={() => { hh.refetch(); pe.refetch(); txs.refetch(); }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <IconTile icon={f.icon} color={f.color} size={52} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="textSecondary">Saldo actual</Text>
            <Money value={f.balance} variant="amountXL" />
          </View>
        </View>
        <View style={{ marginTop: space[3] }}>
          <KeyValue label="Saldo inicial" value={formatMoney(f.initial_balance)} />
          <KeyValue label="Entradas"><Money value={f.inflow} variant="amountS" color="positive" sign /></KeyValue>
          <KeyValue label="Salidas"><Money value={-f.outflow} variant="amountS" /></KeyValue>
          {f.responsible_member_id && <KeyValue label="Responsable" value={memberName(f.responsible_member_id)} />}
        </View>
      </Card>
      {!f.archived_at && (
        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Button testID="btn-fund-expense" title="Gasto" icon="arrow-out" full={false} style={{ flex: 1 }} disabled={f.balance <= 0} onPress={() => router.push(`/transaction/new?type=expense&fundId=${f.id}&${q}`)} />
            <Button testID="btn-fund-deposit" title="Reponer" icon="arrow-in" variant="secondary" full={false} style={{ flex: 1 }} onPress={() => router.push(`/transaction/new?type=deposit&${q}`)} />
          </View>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Button title="Transferir" icon="transfer" variant="outline" full={false} style={{ flex: 1 }} disabled={f.balance <= 0} onPress={() => router.push(`/transaction/new?type=transfer&fundId=${f.id}&${q}`)} />
            <Button title="Retirar" icon="undo" variant="outline" full={false} style={{ flex: 1 }} disabled={f.balance <= 0} onPress={() => router.push(`/transaction/new?type=withdrawal&fundId=${f.id}&${q}`)} />
          </View>
        </View>
      )}
      <View>
        <SectionHeader title="Movimientos del fondo" />
        <Card>{txs.data?.length ? txs.data.map((t) => <TxRow key={t.id} tx={t} category={cats.data?.find((c) => c.id === t.category_id)} memberName={t.member_id ? memberName(t.member_id) : undefined} />) : <EmptyState compact icon="wallet" title="Sin movimientos" message="Usa Reponer para registrar el dinero que entra al fondo." />}</Card>
      </View>
      <Button title={f.archived_at ? 'Reactivar fondo' : 'Archivar fondo'} variant="ghost" icon="archive" onPress={() => setArchive(true)} />
      <ConfirmSheet visible={archive} onClose={() => setArchive(false)} title={f.archived_at ? 'Reactivar fondo' : 'Archivar fondo'} message={f.balance > 0 && !f.archived_at ? `Aún tiene ${formatMoney(f.balance)}. Transfiérelo antes de archivar para no perder el registro.` : 'El historial se conserva.'} loading={arch.isPending} onConfirm={() => arch.mutate(undefined as never)} />
    </Screen>
  );
}
