import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useAttachments, useAudit, useCategories, useDebts, useFunds, useGoals, usePaymentMethods, useTransaction, useUpdateTransaction, useVoidTransaction } from '../../../api/finance';
import { useHH } from '../../../api/household';
import {
  Banner, Button, Card, ConfirmSheet, DateField, Divider, EmptyState, ErrorState, Header, Icon, IconButton, IconTile, Input, KeyValue,
  Loading, Money, Screen, SectionHeader, Sheet, StatusPill, Switch, Text,
} from '../../../components/ui';
import { deleteAttachment, downloadAndShare, pickDocument, pickFromCamera, pickFromLibrary, signedUrl, uploadAttachment } from '../../../lib/attachments';
import { formatDate } from '../../../lib/dates';
import { errorMessage } from '../../../lib/errors';
import { TX_TYPE } from '../../../lib/labels';
import { formatMoney, parseAmount } from '../../../lib/money';
import { invalidateFinance } from '../../../lib/queryClient';
import { toast } from '../../../store/toast';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import { AuditEntry } from '../../../components/finance/AuditEntry';
import type { Attachment, AuditLog, TxType } from '../../../types/models';


export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { hid, memberName, uid, isAdmin } = useHH();
  const tx = useTransaction(id);
  const atts = useAttachments(id);
  const audit = useAudit('transactions', id);
  const cats = useCategories(true);
  const funds = useFunds(tx.data?.scope === 'personal' ? 'personal' : 'household', true);
  const goals = useGoals(tx.data?.scope === 'personal' ? 'personal' : 'household', true);
  const debts = useDebts(tx.data?.scope === 'personal' ? 'personal' : 'household', true);
  const methods = usePaymentMethods();
  const update = useUpdateTransaction();
  const voidTx = useVoidTransaction();
  const [editing, setEditing] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [edit, setEdit] = useState({ amount: '', description: '', date: '', notes: '', extraordinary: false, reason: '' });
  const [preview, setPreview] = useState<{ url: string; att: Attachment } | null>(null);
  const [delAtt, setDelAtt] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);

  if (tx.isPending) return <Screen header={<Header title="Movimiento" back />}><Loading /></Screen>;
  if (tx.error || !tx.data) return <Screen header={<Header title="Movimiento" back />}><ErrorState error={tx.error} onRetry={tx.refetch} /></Screen>;

  const t = tx.data;
  const meta = TX_TYPE[t.type as TxType];
  const cat = cats.data?.find((c) => c.id === t.category_id);
  const fundName = (fid: string | null) => funds.data?.find((f) => f.id === fid)?.name ?? '—';
  const voided = t.status === 'voided';
  const isBudgetMove = !!t.budget_move_id;

  const addFile = async (picker: () => Promise<import('../../../lib/attachments').PickedFile | null>) => {
    try {
      const f = await picker();
      if (!f) return;
      setBusy(true);
      await uploadAttachment({ householdId: hid, transactionId: t.id, file: f });
      toast.success('Comprobante adjuntado');
      atts.refetch();
      audit.refetch();
    } catch (e) {
      toast.error('No se pudo adjuntar', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const open = async (a: Attachment) => {
    try {
      const url = await signedUrl(a.storage_path, 120);
      if (a.mime_type === 'application/pdf') await WebBrowser.openBrowserAsync(url);
      else setPreview({ url, att: a });
    } catch (e) {
      toast.error('No se pudo abrir', errorMessage(e));
    }
  };

  return (
    <Screen header={<Header title={meta.label} subtitle={t.scope === 'personal' ? 'Personal · privado' : 'Del hogar'} back right={!voided && !isBudgetMove ? <IconButton icon="edit" label="Editar" onPress={() => { setEdit({ amount: String(t.amount), description: t.description, date: t.occurred_on, notes: t.notes ?? '', extraordinary: t.is_extraordinary, reason: '' }); setEditing(true); }} /> : undefined} />}>
      <Card>
        <View style={{ alignItems: 'center', gap: space[2], paddingVertical: space[3] }}>
          <IconTile icon={cat?.icon ?? meta.icon} color={cat?.color} size={56} />
          <Text variant="h2" align="center">{t.description}</Text>
          <Money value={t.amount} variant="amountXL" color={voided ? 'textTertiary' : meta.sign > 0 ? 'positive' : 'text'} style={voided ? { textDecorationLine: 'line-through' } : undefined} />
          <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatusPill label={voided ? 'Anulado' : 'Registrado'} tone={voided ? 'negative' : 'positive'} icon={voided ? 'ban' : 'check'} />
            {t.is_extraordinary && <StatusPill label="Extraordinario" tone="warning" icon="alert" />}
            {meta.sign === 0 && <StatusPill label="No es gasto" tone="brand" icon="info" />}
          </View>
        </View>
      </Card>
      {voided && <Banner tone="danger" title="Movimiento anulado" message={`Motivo: ${t.void_reason ?? '—'} · ${t.voided_at ? new Date(t.voided_at).toLocaleString('es-DO') : ''}`} />}

      <Card>
        <KeyValue label="Fecha" value={formatDate(t.occurred_on, 'long')} />
        {cat && <KeyValue label="Categoría" value={cat.name} />}
        {t.member_id && <KeyValue label={t.type === 'contribution' ? 'Aportó' : 'Pagó'} value={memberName(t.member_id)} />}
        {t.fund_id && <KeyValue label="Sale de" value={fundName(t.fund_id)} />}
        {t.to_fund_id && <KeyValue label="Entra a" value={fundName(t.to_fund_id)} />}
        {t.savings_goal_id && <KeyValue label="Meta de ahorro" value={goals.data?.find((g) => g.id === t.savings_goal_id)?.name ?? '—'} />}
        {t.debt_id && <KeyValue label="Deuda" value={debts.data?.find((d) => d.id === t.debt_id)?.name ?? '—'} />}
        {t.payment_method_id && <KeyValue label="Método" value={methods.data?.find((m) => m.id === t.payment_method_id)?.name ?? '—'} />}
        {t.debt_charge_kind && <KeyValue label="Tipo de cargo" value={{ interest: 'Interés', fee: 'Recargo', other: 'Otro' }[t.debt_charge_kind]} />}
        {t.notes && (
          <View style={{ paddingTop: space[2], gap: 4 }}>
            <Text variant="label" color="textSecondary">Observaciones</Text>
            <Text variant="body">{t.notes}</Text>
          </View>
        )}
        <Divider />
        <KeyValue label="Creado por" value={t.created_by === uid ? 'Ti' : 'Tu pareja'} />
        <KeyValue label="Registrado" value={new Date(t.created_at).toLocaleString('es-DO')} />
      </Card>

      <View>
        <SectionHeader title="Comprobantes" subtitle="Privados: se abren con enlaces temporales" />
        <Card>
          {atts.data?.length ? (
            atts.data.map((a) => (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56 }}>
                <IconTile icon={a.mime_type === 'application/pdf' ? 'file' : 'image'} size={38} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>{a.file_name}</Text>
                  <Text variant="caption" color="textSecondary">{(a.size_bytes / 1024).toFixed(0)} KB · {formatDate(a.created_at.slice(0, 10))}</Text>
                </View>
                <IconButton icon="eye" label={`Ver ${a.file_name}`} onPress={() => open(a)} />
                <IconButton icon="download" label={`Descargar ${a.file_name}`} onPress={() => downloadAndShare(a.storage_path, a.file_name, a.mime_type).catch((e) => toast.error('No se pudo descargar', errorMessage(e)))} />
                {(a.uploaded_by === uid || isAdmin) && <IconButton icon="trash" label={`Eliminar ${a.file_name}`} onPress={() => setDelAtt(a)} />}
              </View>
            ))
          ) : (
            <EmptyState compact icon="paperclip" title="Sin comprobantes" message="Adjunta fotos de facturas, recibos o vouchers." />
          )}
          {!voided && (
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
              <Button title="Cámara" icon="camera" size="sm" variant="secondary" full={false} style={{ flex: 1 }} loading={busy} onPress={() => addFile(pickFromCamera)} />
              <Button title="Galería" icon="image" size="sm" variant="secondary" full={false} style={{ flex: 1 }} disabled={busy} onPress={() => addFile(pickFromLibrary)} />
              <Button title="PDF" icon="file" size="sm" variant="secondary" full={false} style={{ flex: 1 }} disabled={busy} onPress={() => addFile(pickDocument)} />
            </View>
          )}
        </Card>
      </View>

      <View>
        <SectionHeader title="Historial de cambios" />
        <Card>
          {audit.data?.length ? audit.data.map((l) => <AuditEntry key={l.id} l={l} />) : <Text variant="caption" color="textSecondary">Sin cambios registrados.</Text>}
        </Card>
      </View>

      {!voided && !isBudgetMove && <Button testID="btn-void" title="Anular movimiento" variant="danger" icon="ban" onPress={() => setVoiding(true)} />}
      {isBudgetMove && <Banner tone="info" title="Generado por un ajuste de presupuesto" message="Se anula desde el detalle de la categoría correspondiente." />}

      <ConfirmSheet
        visible={voiding}
        onClose={() => setVoiding(false)}
        title="Anular movimiento"
        message="El movimiento no se borra: queda marcado como anulado y deja de contar en saldos y reportes. Quedará registrado quién y por qué."
        confirmLabel="Anular"
        danger
        requireReason
        loading={voidTx.isPending}
        onConfirm={(reason) => voidTx.mutate({ id: t.id, reason }, { onSuccess: () => setVoiding(false) })}
      />
      <ConfirmSheet
        visible={!!delAtt}
        onClose={() => setDelAtt(null)}
        title="Eliminar comprobante"
        message={`Se eliminará "${delAtt?.file_name}". La eliminación queda auditada.`}
        confirmLabel="Eliminar"
        danger
        requireReason
        onConfirm={async (reason) => {
          try {
            await deleteAttachment(delAtt!.id, reason);
            toast.success('Comprobante eliminado');
            setDelAtt(null);
            invalidateFinance();
          } catch (e) {
            toast.error('No se pudo eliminar', errorMessage(e));
          }
        }}
      />
      <Sheet visible={!!preview} onClose={() => setPreview(null)} title={preview?.att.file_name}>
        {preview && <Image source={{ uri: preview.url }} style={{ width: '100%', aspectRatio: 0.75, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }} contentFit="contain" accessibilityLabel="Comprobante" />}
      </Sheet>
      <Sheet
        visible={editing}
        onClose={() => setEditing(false)}
        title="Editar movimiento"
        subtitle="Los cambios quedan en el historial"
        footer={
          <Button
            title="Guardar cambios"
            loading={update.isPending}
            onPress={() => {
              const amount = parseAmount(edit.amount);
              if (!amount || amount <= 0) return toast.error('Monto inválido');
              if (!edit.description.trim()) return toast.error('La descripción es obligatoria');
              update.mutate(
                { id: t.id, patch: { amount, description: edit.description.trim(), occurred_on: edit.date, notes: edit.notes.trim() || null, is_extraordinary: t.type === 'expense' ? edit.extraordinary : false } },
                { onSuccess: () => setEditing(false) },
              );
            }}
          />
        }
      >
        <Input label="Monto (RD$)" value={edit.amount} keyboardType="decimal-pad" onChangeText={(v) => setEdit({ ...edit, amount: v })} />
        <Input label="Descripción" value={edit.description} onChangeText={(v) => setEdit({ ...edit, description: v })} maxLength={120} />
        <DateField label="Fecha" value={edit.date || t.occurred_on} onChange={(v) => setEdit({ ...edit, date: v })} />
        <Input label="Observaciones" value={edit.notes} onChangeText={(v) => setEdit({ ...edit, notes: v })} multiline />
        {t.type === 'expense' && t.scope === 'household' && <Switch label="Extraordinario" value={edit.extraordinary} onChange={(v) => setEdit({ ...edit, extraordinary: v })} />}
      </Sheet>
    </Screen>
  );
}

