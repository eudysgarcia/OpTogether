import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import {
  useBillCycles, useCategories, useCreateTransaction, useDebts, useFunds, useGoals, usePaymentMethods,
} from '../../../api/finance';
import { useHH } from '../../../api/household';
import { CategoryGrid } from '../../../components/finance';
import {
  AmountInput, Banner, Button, Chip, ChipRow, DateField, Icon, IconButton, Input, Screen, Segmented, Select, Switch, Text,
} from '../../../components/ui';
import { pickDocument, pickFromCamera, pickFromLibrary, uploadAttachment, type PickedFile } from '../../../lib/attachments';
import { addMonthsYM, capitalize, currentYM, todayISO, ymLabel } from '../../../lib/dates';
import { errorMessage } from '../../../lib/errors';
import { TX_TYPE } from '../../../lib/labels';
import { formatMoney, parseAmount } from '../../../lib/money';
import { supabase } from '../../../lib/supabase';
import { useDrafts } from '../../../store/drafts';
import { toast } from '../../../store/toast';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import type { Scope, TxType } from '../../../types/models';

const PRIMARY: { value: TxType; label: string }[] = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
  { value: 'contribution', label: 'Aporte' },
  { value: 'transfer', label: 'Transferir' },
];
const MORE: TxType[] = ['savings_deposit', 'savings_withdrawal', 'debt_payment', 'debt_charge', 'refund', 'deposit', 'withdrawal'];

type Form = {
  type: TxType;
  scope: Scope;
  amount: string;
  categoryId: string | null;
  description: string;
  date: string;
  memberId: string | null;
  fundId: string | null;
  toFundId: string | null;
  goalId: string | null;
  debtId: string | null;
  paymentMethodId: string | null;
  notes: string;
  extraordinary: boolean;
  chargeKind: 'interest' | 'fee' | 'other';
  periodOffset: '0' | '1';
};

const DRAFT_KEY = 'tx-new';

export default function NewTransaction() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ type?: TxType; scope?: Scope; billCycleId?: string; debtId?: string; goalId?: string; fundId?: string; categoryId?: string }>();
  const { hid, me, members, uid } = useHH();
  const draft = useDrafts((s) => s.drafts[DRAFT_KEY]);
  const saveDraft = useDrafts((s) => s.save);
  const clearDraft = useDrafts((s) => s.clear);
  const fromParams = !!(params.type || params.billCycleId || params.debtId || params.goalId || params.fundId);

  const [f, setF] = useState<Form>(() => {
    const base: Form = {
      type: params.type ?? (params.billCycleId ? 'expense' : 'expense'),
      scope: params.scope ?? 'household',
      amount: '', categoryId: params.categoryId ?? null, description: '', date: todayISO(), memberId: null,
      fundId: params.fundId ?? null, toFundId: null, goalId: params.goalId ?? null, debtId: params.debtId ?? null,
      paymentMethodId: null, notes: '', extraordinary: false, chargeKind: 'interest', periodOffset: '0',
    };
    if (!fromParams && draft && Date.now() - draft.savedAt < 1000 * 60 * 60 * 24) return { ...base, ...(draft.data as Partial<Form>) };
    return base;
  });
  const [restored] = useState(!fromParams && !!draft);
  const [showMore, setShowMore] = useState(false);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [overpayConfirm, setOverpayConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState<{ amount: number; queued: boolean } | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const categories = useCategories();
  const funds = useFunds(f.scope);
  const goals = useGoals(f.scope);
  const debts = useDebts(f.scope);
  const methods = usePaymentMethods();
  const cycle = useBillCycles({ scope: undefined });
  const billCycle = params.billCycleId ? cycle.data?.find((c) => c.id === params.billCycleId) : undefined;

  // Valores por defecto
  useEffect(() => {
    if (me && !f.memberId) set('memberId', me.id);
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (billCycle && !f.amount) {
      const pending = Math.max(Number(billCycle.expected_amount) - Number(billCycle.paid_amount), 0);
      setF((p) => ({ ...p, type: 'expense', amount: pending ? String(pending) : '', categoryId: billCycle.category_id, description: `Pago ${billCycle.bill_name}` }));
    }
  }, [billCycle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Borrador automático (no se pierde lo escrito)
  useEffect(() => {
    if (fromParams || done) return;
    const t = setTimeout(() => saveDraft(DRAFT_KEY, f as unknown as Record<string, unknown>), 400);
    return () => clearTimeout(t);
  }, [f, fromParams, done, saveDraft]);

  const expenseCats = useMemo(
    () => (categories.data ?? []).filter((c) => c.kind !== 'income' && (f.scope === 'personal' ? true : c.scope === 'household')),
    [categories.data, f.scope],
  );
  const incomeCats = useMemo(() => (categories.data ?? []).filter((c) => c.kind === 'income'), [categories.data]);
  const selectedCat = categories.data?.find((c) => c.id === f.categoryId);

  // Al elegir una categoría de fondo (p. ej. Caja chica) se sugiere pagar desde ese fondo.
  useEffect(() => {
    if (f.type === 'expense' && selectedCat?.linked_fund_id && f.scope === selectedCat.scope && !f.fundId) set('fundId', selectedCat.linked_fund_id);
  }, [selectedCat?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fundOpts = (funds.data ?? []).map((x) => ({ value: x.id, label: x.name, icon: x.icon, color: x.color, description: `Saldo: ${formatMoney(x.balance)}` }));
  const goalOpts = (goals.data ?? []).filter((g) => g.status === 'active').map((g) => ({ value: g.id, label: g.name, icon: g.icon, description: `Ahorrado: ${formatMoney(g.balance)}` }));
  const debtOpts = (debts.data ?? []).map((d) => ({ value: d.id, label: d.name, icon: 'card', description: `Saldo: ${formatMoney(d.balance)}` }));
  const memberOpts = members.map((m) => ({ value: m.id, label: m.display_name, icon: 'user', color: m.color }));
  const meta = TX_TYPE[f.type];
  const household = f.scope === 'household';
  const selectedDebt = debts.data?.find((d) => d.id === f.debtId);
  const amountNum = parseAmount(f.amount) ?? 0;
  const overpay = f.type === 'debt_payment' && selectedDebt && amountNum > Number(selectedDebt.balance);

  const create = useCreateTransaction({ success: '' });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!amountNum || amountNum <= 0) e.amount = 'Introduce un monto mayor que cero';
    if ((f.type === 'expense' || f.type === 'refund') && !f.categoryId) e.category = 'Elige una categoría';
    if (f.type === 'transfer') {
      if (!f.fundId) e.fund = 'Elige el fondo de origen';
      if (!f.toFundId) e.toFund = 'Elige el fondo de destino';
      if (f.fundId && f.fundId === f.toFundId) e.toFund = 'El destino debe ser distinto del origen';
    }
    if (f.type === 'deposit' && !f.toFundId) e.toFund = 'Elige el fondo';
    if (f.type === 'withdrawal' && !f.fundId) e.fund = 'Elige el fondo';
    if ((f.type === 'savings_deposit' || f.type === 'savings_withdrawal') && !f.goalId) e.goal = 'Elige la meta de ahorro';
    if ((f.type === 'debt_payment' || f.type === 'debt_charge') && !f.debtId) e.debt = 'Elige la deuda';
    if (f.type === 'contribution' && !f.memberId) e.member = 'Indica quién aporta';
    if (overpay && !overpayConfirm) e.amount = `Supera el saldo pendiente (${formatMoney(selectedDebt!.balance)}). Confirma el sobrepago abajo.`;
    const fund = funds.data?.find((x) => x.id === f.fundId);
    if (fund && amountNum > fund.balance && ['expense', 'transfer', 'withdrawal', 'savings_deposit', 'debt_payment'].includes(f.type)) {
      e.fund = `Saldo insuficiente en ${fund.name} (${formatMoney(fund.balance)}).`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    const desc =
      f.description.trim() ||
      (f.type === 'expense' || f.type === 'refund' ? selectedCat?.name : undefined) ||
      (f.type === 'contribution' ? `Aporte de ${members.find((m) => m.id === f.memberId)?.display_name ?? ''}` : meta.label);
    let periodId: string | null = null;
    if (f.type === 'contribution' && f.periodOffset === '1') {
      const next = addMonthsYM(currentYM(), 1);
      const r = await supabase.rpc('ensure_period', { hid, p_year: next.year, p_month: next.month });
      periodId = (r.data as string) ?? null;
    }
    const usesFundOut = ['expense', 'transfer', 'withdrawal', 'savings_deposit', 'debt_payment'].includes(f.type);
    const usesFundIn = ['income', 'refund', 'contribution', 'transfer', 'deposit', 'savings_withdrawal'].includes(f.type);
    create.mutate(
      {
        type: f.type,
        scope: f.scope,
        owner_user_id: household ? null : uid,
        amount: amountNum,
        occurred_on: f.date,
        description: desc!.slice(0, 120),
        notes: f.notes.trim() || null,
        category_id: ['expense', 'refund', 'income'].includes(f.type) ? f.categoryId : null,
        member_id: household ? f.memberId : null,
        fund_id: usesFundOut ? f.fundId : null,
        to_fund_id: usesFundIn ? (f.type === 'transfer' || f.type === 'deposit' ? f.toFundId : f.toFundId) : null,
        savings_goal_id: f.type === 'savings_deposit' || f.type === 'savings_withdrawal' ? f.goalId : null,
        debt_id: f.type === 'debt_payment' || f.type === 'debt_charge' ? f.debtId : null,
        debt_charge_kind: f.type === 'debt_charge' ? f.chargeKind : null,
        bill_cycle_id: f.type === 'expense' && params.billCycleId ? params.billCycleId : null,
        payment_method_id: f.paymentMethodId,
        is_extraordinary: f.type === 'expense' ? f.extraordinary : false,
        allow_overpayment: !!overpay && overpayConfirm,
        period_id: periodId,
      },
      {
        onSuccess: async (r) => {
          clearDraft(DRAFT_KEY);
          if (r.id && files.length) {
            setUploading(true);
            let ok = 0;
            for (const file of files) {
              try {
                await uploadAttachment({ householdId: hid, transactionId: r.id, file });
                ok++;
              } catch (err) {
                toast.error('Un comprobante no se pudo subir', errorMessage(err));
              }
            }
            setUploading(false);
            if (ok) toast.success(`${ok} comprobante(s) adjuntado(s)`);
          }
          setDone({ amount: amountNum, queued: r.queued });
        },
      },
    );
  };

  if (done) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[4], marginTop: space[16] }}>
          <Animated.View entering={ZoomIn.springify().damping(12)} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.positiveSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={done.queued ? 'cloud-off' : 'check'} size={44} color={colors.positive} strokeWidth={2.6} />
          </Animated.View>
          <Animated.View entering={FadeIn.delay(150)} style={{ alignItems: 'center', gap: space[2] }}>
            <Text variant="h1" align="center">{done.queued ? 'Guardado sin conexión' : `${meta.label} registrado`}</Text>
            <Text variant="amountL" color="text">{formatMoney(done.amount)}</Text>
            <Text variant="body" color="textSecondary" align="center">
              {done.queued ? 'Se sincronizará automáticamente al recuperar la conexión, sin duplicarse.' : f.type === 'contribution' || f.type === 'transfer' || f.type.startsWith('savings') ? 'No cuenta como gasto: solo mueve dinero entre bolsillos.' : 'Saldos y presupuesto actualizados.'}
            </Text>
          </Animated.View>
          <View style={{ width: '100%', gap: space[2], marginTop: space[6] }}>
            <Button testID="btn-done" title="Listo" onPress={() => router.back()} />
            <Button title="Registrar otro" variant="secondary" onPress={() => { setDone(null); setFiles([]); setF((p) => ({ ...p, amount: '', description: '', notes: '' })); }} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID="screen-new-tx"
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[2], minHeight: 56 }}>
          <IconButton icon="x" label="Cerrar" onPress={() => router.back()} />
          <Text variant="h3" style={{ flex: 1, textAlign: 'center' }}>{billCycle ? `Pagar ${billCycle.bill_name}` : 'Nuevo movimiento'}</Text>
          <View style={{ width: 44 }} />
        </View>
      }
      footer={<Button testID="btn-save-tx" title={`Guardar ${meta.label.toLowerCase()}`} icon="check" onPress={submit} loading={create.isPending || uploading} />}
    >
      {restored && <Banner tone="info" title="Recuperamos tu borrador" message="Continúa donde lo dejaste." action="Descartar" onPress={() => { clearDraft(DRAFT_KEY); router.replace('/transaction/new'); }} />}
      {!billCycle && (
        <>
          <Segmented testID="seg-scope" options={[{ value: 'household', label: 'Del hogar' }, { value: 'personal', label: 'Personal (privado)' }]} value={f.scope}
            onChange={(v) => setF((p) => ({ ...p, scope: v, fundId: null, toFundId: null, goalId: null, debtId: null, type: v === 'personal' && p.type === 'contribution' ? 'expense' : p.type }))} />
          <ChipRow>
            {PRIMARY.filter((t) => household || t.value !== 'contribution').map((t) => (
              <Chip key={t.value} testID={`type-${t.value}`} label={t.label} icon={TX_TYPE[t.value].icon} selected={f.type === t.value} onPress={() => set('type', t.value)} />
            ))}
            {MORE.map((t) => (
              <Chip key={t} testID={`type-${t}`} label={TX_TYPE[t].label} icon={TX_TYPE[t].icon} selected={f.type === t} onPress={() => set('type', t)} />
            ))}
          </ChipRow>
        </>
      )}

      <View style={{ paddingVertical: space[3] }}>
        <AmountInput testID="input-amount" value={f.amount} onChange={(v) => set('amount', v)} error={errors.amount} autoFocus={!fromParams} tone={meta.sign > 0 ? 'income' : 'default'} />
      </View>

      {!household && <Banner tone="info" icon="lock" title="Privado" message="Solo tú podrás ver este movimiento. No aparece en reportes, notificaciones ni búsquedas del hogar." />}
      {(f.type === 'contribution' || f.type === 'transfer' || f.type.startsWith('savings')) && (
        <Text variant="caption" color="textSecondary" align="center">
          {f.type === 'contribution' ? 'Una aportación es dinero entregado al hogar; no es un gasto.' : f.type === 'transfer' ? 'Una transferencia mueve dinero entre fondos; no es un gasto.' : 'El ahorro no es gasto.'}
        </Text>
      )}

      {(f.type === 'expense' || f.type === 'refund') && !billCycle && (
        <View style={{ gap: space[2] }}>
          <Text variant="label" color="textSecondary">Categoría</Text>
          <CategoryGrid categories={expenseCats.filter((c) => !c.parent_id)} value={f.categoryId} onChange={(id) => set('categoryId', id)} />
          {errors.category && <Text variant="caption" color="negative">{errors.category}</Text>}
          {expenseCats.some((c) => c.parent_id && c.parent_id === (selectedCat?.parent_id ?? selectedCat?.id)) && (
            <ChipRow>
              {expenseCats.filter((c) => c.parent_id === (selectedCat?.parent_id ?? selectedCat?.id)).map((c) => (
                <Chip key={c.id} label={c.name} icon={c.icon} selected={f.categoryId === c.id} onPress={() => set('categoryId', c.id)} />
              ))}
            </ChipRow>
          )}
        </View>
      )}
      {f.type === 'income' && incomeCats.length > 0 && (
        <Select label="Categoría (opcional)" value={f.categoryId} allowClear options={incomeCats.map((c) => ({ value: c.id, label: c.name, icon: c.icon }))} onChange={(v) => set('categoryId', v)} />
      )}

      <Input testID="input-description" label="Descripción" value={f.description} onChangeText={(t) => set('description', t)} maxLength={120}
        placeholder={(f.type === 'expense' ? selectedCat?.name : meta.label) ?? 'Ej.: Compra semanal'} />

      {household && ['expense', 'contribution', 'income', 'deposit', 'savings_deposit', 'debt_payment', 'refund'].includes(f.type) && (
        <View style={{ gap: space[2] }}>
          <Text variant="label" color="textSecondary">{f.type === 'contribution' ? '¿Quién aporta?' : f.type === 'income' ? '¿De quién es el ingreso?' : '¿Quién pagó?'}</Text>
          <ChipRow>
            {memberOpts.map((m) => <Chip key={m.value} label={m.label} icon="user" selected={f.memberId === m.value} onPress={() => set('memberId', m.value)} />)}
          </ChipRow>
          {errors.member && <Text variant="caption" color="negative">{errors.member}</Text>}
        </View>
      )}

      {(f.type === 'savings_deposit' || f.type === 'savings_withdrawal') && (
        <Select testID="sel-goal" label="Meta de ahorro" value={f.goalId} options={goalOpts} onChange={(v) => set('goalId', v)} error={errors.goal} placeholder="Elegir meta" />
      )}
      {(f.type === 'debt_payment' || f.type === 'debt_charge') && (
        <Select testID="sel-debt" label="Deuda" value={f.debtId} options={debtOpts} onChange={(v) => set('debtId', v)} error={errors.debt} placeholder="Elegir deuda" />
      )}
      {f.type === 'debt_charge' && (
        <Segmented options={[{ value: 'interest', label: 'Interés' }, { value: 'fee', label: 'Recargo' }, { value: 'other', label: 'Otro' }]} value={f.chargeKind} onChange={(v) => set('chargeKind', v)} />
      )}
      {overpay && (
        <Switch label="Confirmo el sobrepago" description={`El abono deja la deuda en ${formatMoney(Number(selectedDebt!.balance) - amountNum)} (saldo a favor).`} value={overpayConfirm} onChange={setOverpayConfirm} />
      )}

      {['expense', 'transfer', 'withdrawal', 'savings_deposit', 'debt_payment'].includes(f.type) && (
        <Select testID="sel-fund" label={f.type === 'transfer' ? 'Desde el fondo' : '¿Sale de un fondo? (opcional)'} value={f.fundId} allowClear={f.type !== 'transfer' && f.type !== 'withdrawal'}
          options={fundOpts} onChange={(v) => set('fundId', v)} error={errors.fund} placeholder={f.type === 'transfer' || f.type === 'withdrawal' ? 'Elegir fondo' : 'No, pago directo'} />
      )}
      {['transfer', 'deposit', 'income', 'contribution', 'refund', 'savings_withdrawal'].includes(f.type) && (
        <Select testID="sel-to-fund" label={f.type === 'transfer' ? 'Hacia el fondo' : f.type === 'deposit' ? 'Fondo que recibe' : '¿Entra a un fondo? (opcional)'} value={f.toFundId}
          allowClear={!(f.type === 'transfer' || f.type === 'deposit')} options={fundOpts.filter((o) => o.value !== f.fundId)} onChange={(v) => set('toFundId', v)} error={errors.toFund} placeholder={f.type === 'transfer' || f.type === 'deposit' ? 'Elegir fondo' : 'No'} />
      )}

      {f.type === 'contribution' && (
        <View style={{ gap: space[2] }}>
          <Text variant="label" color="textSecondary">Corresponde a</Text>
          <Segmented options={[{ value: '0', label: capitalize(ymLabel(currentYM())) }, { value: '1', label: `Adelanto ${ymLabel(addMonthsYM(currentYM(), 1), true)}` }]} value={f.periodOffset} onChange={(v) => set('periodOffset', v)} />
        </View>
      )}

      <DateField label="Fecha" value={f.date} onChange={(d) => set('date', d)} />

      {(methods.data?.length ?? 0) > 0 && ['expense', 'debt_payment', 'income', 'contribution', 'savings_deposit'].includes(f.type) && (
        <View style={{ gap: space[2] }}>
          <Text variant="label" color="textSecondary">Método de pago</Text>
          <ChipRow>
            {methods.data!.map((m) => (
              <Chip key={m.id} label={m.name} icon={m.kind === 'cash' ? 'cash' : m.kind === 'transfer' ? 'transfer' : 'card'} selected={f.paymentMethodId === m.id} onPress={() => set('paymentMethodId', f.paymentMethodId === m.id ? null : m.id)} />
            ))}
          </ChipRow>
        </View>
      )}

      <Button title={showMore ? 'Menos detalles' : 'Más detalles: notas y comprobantes'} variant="ghost" icon={showMore ? 'chevron-down' : 'paperclip'} onPress={() => setShowMore(!showMore)} />
      {showMore && (
        <Animated.View entering={FadeIn} style={{ gap: space[4] }}>
          <Input label="Observaciones" value={f.notes} onChangeText={(t) => set('notes', t)} multiline maxLength={1000} placeholder="Detalles adicionales" />
          {f.type === 'expense' && household && (
            <Switch label="Gasto extraordinario" description="Se registra y reporta aparte; no consume el presupuesto ordinario de la categoría." value={f.extraordinary} onChange={(v) => set('extraordinary', v)} />
          )}
          <View style={{ gap: space[2] }}>
            <Text variant="label" color="textSecondary">Comprobantes</Text>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <Button title="Cámara" icon="camera" variant="secondary" size="md" full={false} style={{ flex: 1 }} onPress={async () => { try { const x = await pickFromCamera(); if (x) setFiles((p) => [...p, x]); } catch (e) { toast.error('Cámara', errorMessage(e)); } }} />
              <Button title="Galería" icon="image" variant="secondary" size="md" full={false} style={{ flex: 1 }} onPress={async () => { const x = await pickFromLibrary(); if (x) setFiles((p) => [...p, x]); }} />
              <Button title="PDF" icon="file" variant="secondary" size="md" full={false} style={{ flex: 1 }} onPress={async () => { const x = await pickDocument(); if (x) setFiles((p) => [...p, x]); }} />
            </View>
            {files.map((x, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[3], borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}>
                <Icon name={x.mimeType === 'application/pdf' ? 'file' : 'image'} size={18} color={colors.brand} />
                <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>{x.name}</Text>
                <IconButton icon="x" label={`Quitar ${x.name}`} size={32} onPress={() => setFiles((p) => p.filter((_, j) => j !== i))} />
              </View>
            ))}
          </View>
        </Animated.View>
      )}
    </Screen>
  );
}
