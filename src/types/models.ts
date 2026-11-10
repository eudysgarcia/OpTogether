import type { Database } from './database';

type Pub = Database['public'];
export type Tables<T extends keyof Pub['Tables']> = Pub['Tables'][T]['Row'];
export type Inserts<T extends keyof Pub['Tables']> = Pub['Tables'][T]['Insert'];
export type Updates<T extends keyof Pub['Tables']> = Pub['Tables'][T]['Update'];
export type Views<T extends keyof Pub['Views']> = Pub['Views'][T]['Row'];

export type Household = Tables<'households'>;
export type Member = Tables<'household_members'>;
export type Category = Tables<'categories'>;
export type PaymentMethod = Tables<'payment_methods'>;
export type BudgetPeriod = Tables<'budget_periods'>;
export type Fund = Tables<'funds'>;
export type SavingsGoal = Tables<'savings_goals'>;
export type Debt = Tables<'debts'>;
export type Bill = Tables<'bills'>;
export type Transaction = Tables<'transactions'>;
export type Attachment = Tables<'transaction_attachments'>;
export type Reminder = Tables<'reminders'>;
export type AppNotification = Tables<'notifications'>;
export type AuditLog = Tables<'audit_logs'>;
export type IncomeRecord = Tables<'income_records'>;
export type BudgetMove = Tables<'budget_moves'>;

export type AllocationRow = Views<'v_allocations'>;
export type BillCycleRow = Views<'v_bill_cycles'>;
export type DebtRow = Views<'v_debts'>;
export type FundBalanceRow = Views<'v_fund_balances'>;
export type GoalBalanceRow = Views<'v_goal_balances'>;

export type Scope = 'household' | 'personal';
export type TxType =
  | 'expense' | 'refund' | 'income' | 'contribution' | 'transfer' | 'deposit' | 'withdrawal'
  | 'savings_deposit' | 'savings_withdrawal' | 'debt_payment' | 'debt_charge';

/** Mapa member_id -> porcentaje (0..100). Vacío = partes iguales. */
export type Shares = Record<string, number>;
