import type { IconName } from '../components/ui/Icon';
import type { Tone } from '../components/ui/Misc';
import type { TxType } from '../types/models';
import type { BudgetStatus } from '../domain/budget';

export const TX_TYPE: Record<TxType, { label: string; icon: IconName; tone: Tone; sign: -1 | 0 | 1 }> = {
  expense: { label: 'Gasto', icon: 'arrow-out', tone: 'neutral', sign: -1 },
  refund: { label: 'Reembolso', icon: 'undo', tone: 'positive', sign: 1 },
  income: { label: 'Ingreso', icon: 'arrow-in', tone: 'positive', sign: 1 },
  contribution: { label: 'Aportación', icon: 'hand-coins', tone: 'brand', sign: 0 },
  transfer: { label: 'Transferencia', icon: 'transfer', tone: 'brand', sign: 0 },
  deposit: { label: 'Depósito', icon: 'arrow-in', tone: 'fund', sign: 0 },
  withdrawal: { label: 'Retiro', icon: 'arrow-out', tone: 'fund', sign: 0 },
  savings_deposit: { label: 'Aporte a ahorro', icon: 'piggy-bank', tone: 'savings', sign: 0 },
  savings_withdrawal: { label: 'Retiro de ahorro', icon: 'piggy-bank', tone: 'savings', sign: 0 },
  debt_payment: { label: 'Abono a deuda', icon: 'card', tone: 'debt', sign: -1 },
  debt_charge: { label: 'Interés / recargo', icon: 'alert', tone: 'debt', sign: 0 },
};

export const BUDGET_STATUS_UI: Record<BudgetStatus, { label: string; tone: Tone; icon: IconName }> = {
  not_started: { label: 'Sin iniciar', tone: 'neutral', icon: 'clock' },
  in_progress: { label: 'En progreso', tone: 'brand', icon: 'trending-up' },
  near_limit: { label: 'Cerca del límite', tone: 'warning', icon: 'alert' },
  exhausted: { label: 'Agotado', tone: 'warning', icon: 'gauge' },
  exceeded: { label: 'Excedido', tone: 'negative', icon: 'alert-circle' },
};

export const BILL_STATUS_UI: Record<string, { label: string; tone: Tone; icon: IconName }> = {
  pending: { label: 'Pendiente', tone: 'neutral', icon: 'clock' },
  due_soon: { label: 'Próximo a vencer', tone: 'warning', icon: 'bell' },
  paid: { label: 'Pagado', tone: 'positive', icon: 'check-circle' },
  partial: { label: 'Parcialmente pagado', tone: 'brand', icon: 'split' },
  overdue: { label: 'Vencido', tone: 'negative', icon: 'alert-circle' },
  cancelled: { label: 'Cancelado', tone: 'neutral', icon: 'ban' },
};

export const BILL_KIND: Record<string, { label: string; icon: IconName }> = {
  rent: { label: 'Alquiler', icon: 'home' },
  internet: { label: 'Internet', icon: 'wifi' },
  electricity: { label: 'Electricidad', icon: 'zap' },
  gas: { label: 'Gas', icon: 'flame' },
  water: { label: 'Agua', icon: 'droplets' },
  phone: { label: 'Teléfono', icon: 'phone' },
  subscription: { label: 'Suscripción', icon: 'tv' },
  other: { label: 'Otro', icon: 'receipt' },
};

export const DEBT_KIND: Record<string, { label: string; icon: IconName }> = {
  loan: { label: 'Préstamo', icon: 'bank' },
  card: { label: 'Tarjeta de crédito', icon: 'card' },
  financing: { label: 'Financiamiento', icon: 'building' },
  credit_purchase: { label: 'Compra a crédito', icon: 'cart' },
  borrowed: { label: 'Dinero prestado', icon: 'hand-coins' },
  family: { label: 'Deuda familiar', icon: 'users' },
  other: { label: 'Otra', icon: 'receipt' },
};

export const GOAL_KIND: Record<string, { label: string; icon: IconName }> = {
  house: { label: 'Casa', icon: 'home' },
  vehicle: { label: 'Vehículo', icon: 'car' },
  emergency: { label: 'Emergencias', icon: 'shield' },
  travel: { label: 'Viajes', icon: 'plane' },
  appliances: { label: 'Electrodomésticos', icon: 'sofa' },
  general: { label: 'General', icon: 'piggy-bank' },
  other: { label: 'Otro', icon: 'target' },
};

export const FUND_KIND: Record<string, { label: string; icon: IconName }> = {
  petty_cash: { label: 'Caja chica', icon: 'wallet' },
  outings: { label: 'Salidas', icon: 'party' },
  common: { label: 'Fondo común', icon: 'users' },
  emergency: { label: 'Emergencia', icon: 'shield' },
  custom: { label: 'Personalizado', icon: 'coins' },
  wallet: { label: 'Cuenta / cartera', icon: 'wallet' },
};
