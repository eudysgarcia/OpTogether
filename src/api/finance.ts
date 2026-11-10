import { onlineManager, useMutation, useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { supabase, unwrap } from '../lib/supabase';
import { invalidateFinance } from '../lib/queryClient';
import { errorMessage } from '../lib/errors';
import { toast } from '../store/toast';
import { canQueueOffline, useOutbox } from '../store/outbox';
import { monthRange, type YearMonth } from '../lib/dates';
import { useHH } from './household';
import type {
  AllocationRow, AppNotification, Attachment, AuditLog, Bill, BillCycleRow, BudgetMove, Category, DebtRow, Fund,
  Inserts, PaymentMethod, Reminder, SavingsGoal, Scope, Transaction, Updates,
} from '../types/models';

// ------------------------------------------------------------------ helpers
/** Mutación financiera estándar: feedback háptico, toast, refresco de saldos derivados. */
export function useFinanceMutation<V, R>(
  fn: (v: V) => Promise<R>,
  opts: { success?: string | ((r: R, v: V) => string); onSuccess?: (r: R, v: V) => void; silentError?: boolean; networkMode?: 'online' | 'always' } = {},
) {
  return useMutation({
    mutationFn: fn,
    networkMode: opts.networkMode ?? 'online',
    onSuccess: (r, v) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const msg = typeof opts.success === 'function' ? opts.success(r, v) : opts.success;
      if (msg) toast.success(msg);
      invalidateFinance();
      opts.onSuccess?.(r, v);
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (!opts.silentError) toast.error('No se pudo completar', errorMessage(e));
    },
  });
}

// ------------------------------------------------------------------ catálogos
export function useCategories(includeArchived = false) {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['categories', hid, includeArchived],
    enabled: !!hid,
    queryFn: async () => {
      let q = supabase.from('categories').select('*').eq('household_id', hid).order('sort_order').order('name');
      if (!includeArchived) q = q.is('archived_at', null);
      return unwrap(await q) as Category[];
    },
  });
}

export function usePaymentMethods() {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['payment_methods', hid],
    enabled: !!hid,
    queryFn: async () =>
      unwrap(await supabase.from('payment_methods').select('*').eq('household_id', hid).is('archived_at', null).order('name')) as PaymentMethod[],
  });
}

// ------------------------------------------------------------------ presupuesto
export function usePeriod(ym: YearMonth) {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['period', hid, ym.year, ym.month],
    enabled: !!hid,
    queryFn: async () => unwrap(await supabase.rpc('ensure_period', { hid, p_year: ym.year, p_month: ym.month })) as string,
  });
}

export function useAllocations(ym: YearMonth) {
  const { hid } = useHH();
  const period = usePeriod(ym);
  return useQuery({
    queryKey: ['allocations', hid, ym.year, ym.month, period.data],
    enabled: !!hid && !!period.data,
    queryFn: async () =>
      unwrap(
        await supabase.from('v_allocations').select('*').eq('period_id', period.data!).order('category_name'),
      ) as AllocationRow[],
  });
}

export function useAllocation(id: string | undefined) {
  return useQuery({
    queryKey: ['allocation', id],
    enabled: !!id,
    queryFn: async () => unwrap(await supabase.from('v_allocations').select('*').eq('id', id!).single()) as AllocationRow,
  });
}

export function useBudgetMoves(allocationId: string | undefined) {
  return useQuery({
    queryKey: ['budget_moves', allocationId],
    enabled: !!allocationId,
    queryFn: async () =>
      unwrap(
        await supabase.from('budget_moves').select('*')
          .or(`from_allocation_id.eq.${allocationId},to_allocation_id.eq.${allocationId}`)
          .order('created_at', { ascending: false }),
      ) as BudgetMove[],
  });
}

export function useAllocationsHistory(categoryId: string | undefined, months = 6) {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['allocation_history', hid, categoryId, months],
    enabled: !!hid && !!categoryId,
    queryFn: async () =>
      unwrap(
        await supabase.from('v_allocations').select('*').eq('household_id', hid).eq('category_id', categoryId!)
          .order('year', { ascending: false }).order('month', { ascending: false }).limit(months),
      ) as AllocationRow[],
  });
}

/** Presupuestos de un rango de meses (comparaciones / evolución). */
export function useAllocationsRange(from: YearMonth, to: YearMonth) {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['allocations_range', hid, from, to],
    enabled: !!hid,
    queryFn: async () => {
      const rows = unwrap(await supabase.from('v_allocations').select('*').eq('household_id', hid)) as AllocationRow[];
      const a = from.year * 12 + from.month;
      const b = to.year * 12 + to.month;
      return rows.filter((r) => r.year * 12 + r.month >= a && r.year * 12 + r.month <= b);
    },
  });
}

// ------------------------------------------------------------------ movimientos
export type TxFilters = {
  scope?: Scope;
  from?: string;
  to?: string;
  types?: string[];
  categoryId?: string;
  memberId?: string;
  fundId?: string;
  goalId?: string;
  debtId?: string;
  billCycleId?: string;
  periodId?: string;
  search?: string;
  includeVoided?: boolean;
  limit?: number;
};

export function useTransactions(f: TxFilters, enabled = true) {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['transactions', hid, f],
    enabled: !!hid && enabled,
    queryFn: async () => {
      let q = supabase.from('transactions').select('*').eq('household_id', hid);
      q = q.eq('scope', f.scope ?? 'household');
      if (f.from) q = q.gte('occurred_on', f.from);
      if (f.to) q = q.lte('occurred_on', f.to);
      if (f.types?.length) q = q.in('type', f.types);
      if (f.categoryId) q = q.eq('category_id', f.categoryId);
      if (f.memberId) q = q.eq('member_id', f.memberId);
      if (f.fundId) q = q.or(`fund_id.eq.${f.fundId},to_fund_id.eq.${f.fundId}`);
      if (f.goalId) q = q.eq('savings_goal_id', f.goalId);
      if (f.debtId) q = q.eq('debt_id', f.debtId);
      if (f.billCycleId) q = q.eq('bill_cycle_id', f.billCycleId);
      if (f.periodId) q = q.eq('period_id', f.periodId);
      if (!f.includeVoided) q = q.eq('status', 'posted');
      if (f.search?.trim()) {
        const s = f.search.trim().replace(/[%,()]/g, ' ');
        q = q.or(`description.ilike.%${s}%,notes.ilike.%${s}%`);
      }
      q = q.order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).limit(f.limit ?? 300);
      return unwrap(await q) as Transaction[];
    },
  });
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ['transaction', id],
    enabled: !!id,
    queryFn: async () => unwrap(await supabase.from('transactions').select('*').eq('id', id!).single()) as Transaction,
  });
}

export type NewTx = Omit<Inserts<'transactions'>, 'household_id' | 'client_request_id'>;

export function useCreateTransaction(opts: { success?: string; onSuccess?: (id: string | null) => void } = {}) {
  const { hid } = useHH();
  const enqueue = useOutbox((s) => s.enqueue);
  return useFinanceMutation(
    async (v: NewTx): Promise<{ id: string | null; queued: boolean }> => {
      const payload = { ...v, household_id: hid, client_request_id: Crypto.randomUUID() };
      if (!onlineManager.isOnline()) {
        if (canQueueOffline(payload)) {
          enqueue(payload);
          return { id: null, queued: true };
        }
        throw new Error('Network request failed');
      }
      const row = unwrap(await supabase.from('transactions').insert(payload).select('id').single());
      return { id: row!.id, queued: false };
    },
    {
      success: (r) => (r.queued ? 'Guardado sin conexión: se sincronizará automáticamente' : opts.success ?? 'Movimiento registrado'),
      onSuccess: (r) => opts.onSuccess?.(r.id),
      // La función decide: sin conexión encola (si es seguro) o informa el error; nunca queda en pausa.
      networkMode: 'always',
    },
  );
}

export function useUpdateTransaction() {
  return useFinanceMutation(
    async (v: { id: string; patch: Updates<'transactions'> }) =>
      unwrap(await supabase.from('transactions').update(v.patch).eq('id', v.id).select('id').single()),
    { success: 'Cambios guardados' },
  );
}

export function useVoidTransaction() {
  return useFinanceMutation(
    async (v: { id: string; reason: string }) => unwrap(await supabase.rpc('void_transaction', { p_id: v.id, p_reason: v.reason })),
    { success: 'Movimiento anulado' },
  );
}

/** Sincroniza los movimientos guardados sin conexión. Idempotente por client_request_id. */
export async function flushOutbox() {
  const { items, remove, markFailed } = useOutbox.getState();
  let synced = 0;
  for (const it of items) {
    const { error } = await supabase.from('transactions').insert(it.payload);
    if (!error || String(error.message).includes('duplicate key')) {
      remove(it.id);
      synced++;
    } else if (/Network|fetch/i.test(error.message)) {
      break;
    } else {
      markFailed(it.id, errorMessage(error));
    }
  }
  if (synced) {
    toast.success(`${synced} movimiento(s) sincronizado(s)`);
    invalidateFinance();
  }
}

// ------------------------------------------------------------------ comprobantes y auditoría
export function useAttachments(txId: string | undefined) {
  return useQuery({
    queryKey: ['attachments', txId],
    enabled: !!txId,
    queryFn: async () =>
      unwrap(await supabase.from('transaction_attachments').select('*').eq('transaction_id', txId!).order('created_at')) as Attachment[],
  });
}

export function useAudit(table: string, recordId: string | undefined) {
  return useQuery({
    queryKey: ['audit', table, recordId],
    enabled: !!recordId,
    queryFn: async () =>
      unwrap(
        await supabase.from('audit_logs').select('*').eq('table_name', table).eq('record_id', recordId!).order('created_at', { ascending: false }),
      ) as AuditLog[],
  });
}

export function useAuditFeed(limit = 100) {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['audit_feed', hid, limit],
    enabled: !!hid,
    queryFn: async () =>
      unwrap(await supabase.from('audit_logs').select('*').eq('household_id', hid).order('created_at', { ascending: false }).limit(limit)) as AuditLog[],
  });
}

// ------------------------------------------------------------------ fondos
export type FundWithBalance = Fund & { balance: number; inflow: number; outflow: number };

export function useFunds(scope: Scope = 'household', includeArchived = false) {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['funds', hid, scope, includeArchived],
    enabled: !!hid,
    queryFn: async () => {
      let q = supabase.from('funds').select('*').eq('household_id', hid).eq('scope', scope).order('created_at');
      if (!includeArchived) q = q.is('archived_at', null);
      const funds = unwrap(await q) as Fund[];
      const bal = unwrap(await supabase.from('v_fund_balances').select('*').eq('household_id', hid).eq('scope', scope));
      const map = new Map((bal ?? []).map((b) => [b.fund_id, b]));
      return funds.map((f) => ({
        ...f,
        balance: Number(map.get(f.id)?.balance ?? f.initial_balance),
        inflow: Number(map.get(f.id)?.inflow ?? 0),
        outflow: Number(map.get(f.id)?.outflow ?? 0),
      })) as FundWithBalance[];
    },
  });
}

// ------------------------------------------------------------------ ahorros
export type GoalWithBalance = SavingsGoal & { balance: number; deposits: number; withdrawals: number; last_deposit_on: string | null };

export function useGoals(scope: Scope = 'household', includeArchived = false) {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['goals', hid, scope, includeArchived],
    enabled: !!hid,
    queryFn: async () => {
      let q = supabase.from('savings_goals').select('*').eq('household_id', hid).eq('scope', scope).order('created_at');
      if (!includeArchived) q = q.neq('status', 'archived');
      const goals = unwrap(await q) as SavingsGoal[];
      const bal = unwrap(await supabase.from('v_goal_balances').select('*').eq('household_id', hid).eq('scope', scope));
      const map = new Map((bal ?? []).map((b) => [b.goal_id, b]));
      return goals.map((g) => ({
        ...g,
        balance: Number(map.get(g.id)?.balance ?? 0),
        deposits: Number(map.get(g.id)?.deposits ?? 0),
        withdrawals: Number(map.get(g.id)?.withdrawals ?? 0),
        last_deposit_on: map.get(g.id)?.last_deposit_on ?? null,
      })) as GoalWithBalance[];
    },
  });
}

// ------------------------------------------------------------------ deudas
export function useDebts(scope: Scope = 'household', includeArchived = false) {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['debts', hid, scope, includeArchived],
    enabled: !!hid,
    queryFn: async () => {
      let q = supabase.from('v_debts').select('*').eq('household_id', hid).eq('scope', scope).order('created_at');
      if (!includeArchived) q = q.eq('status', 'active');
      return unwrap(await q) as DebtRow[];
    },
  });
}

export function useDebt(id: string | undefined) {
  return useQuery({
    queryKey: ['debt', id],
    enabled: !!id,
    queryFn: async () => unwrap(await supabase.from('v_debts').select('*').eq('id', id!).single()) as DebtRow,
  });
}

// ------------------------------------------------------------------ servicios
export function useBills(scope: Scope = 'household') {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['bills', hid, scope],
    enabled: !!hid,
    queryFn: async () =>
      unwrap(await supabase.from('bills').select('*').eq('household_id', hid).eq('scope', scope).order('due_day')) as Bill[],
  });
}

export function useBill(id: string | undefined) {
  return useQuery({
    queryKey: ['bill', id],
    enabled: !!id,
    queryFn: async () => unwrap(await supabase.from('bills').select('*').eq('id', id!).single()) as Bill,
  });
}

export function useBillCycles(opts: { from?: string; to?: string; billId?: string; scope?: Scope } = {}) {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['bill_cycles', hid, opts],
    enabled: !!hid,
    queryFn: async () => {
      await supabase.rpc('ensure_bill_cycles', { hid });
      let q = supabase.from('v_bill_cycles').select('*').eq('household_id', hid);
      if (opts.scope) q = q.eq('scope', opts.scope);
      if (opts.billId) q = q.eq('bill_id', opts.billId);
      if (opts.from) q = q.gte('due_date', opts.from);
      if (opts.to) q = q.lte('due_date', opts.to);
      return unwrap(await q.order('due_date')) as BillCycleRow[];
    },
  });
}

export function useBillCyclesMonth(ym: YearMonth) {
  const r = monthRange(ym);
  return useBillCycles({ from: r.from, to: r.to });
}

// ------------------------------------------------------------------ recordatorios y notificaciones
export function useReminders(from?: string, to?: string) {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['reminders', hid, from, to],
    enabled: !!hid,
    queryFn: async () => {
      let q = supabase.from('reminders').select('*').eq('household_id', hid);
      if (from) q = q.gte('remind_on', from);
      if (to) q = q.lte('remind_on', to);
      return unwrap(await q.order('remind_on')) as Reminder[];
    },
  });
}

export function useNotifications() {
  const { uid } = useHH();
  return useQuery({
    queryKey: ['notifications', uid],
    enabled: !!uid,
    refetchInterval: 60_000,
    queryFn: async () =>
      unwrap(await supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(100)) as AppNotification[],
  });
}

export function useMarkNotificationsRead() {
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids));
    },
    onSuccess: () => invalidateFinance(),
  });
}
