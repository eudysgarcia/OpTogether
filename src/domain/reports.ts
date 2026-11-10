import { fromCents, toCents } from '../lib/money';

export type ReportTx = {
  id: string;
  type: string;
  amount: number;
  occurred_on: string;
  category_id: string | null;
  member_id: string | null;
  status: string;
  scope: string;
  is_extraordinary: boolean;
  description: string;
};

/** Gasto real neto (gastos - reembolsos). Excluye anulados, transferencias, aportes, ahorro y abonos. */
export function netSpending(txs: ReportTx[]): number {
  let c = 0;
  for (const t of txs) {
    if (t.status !== 'posted') continue;
    if (t.type === 'expense') c += toCents(t.amount);
    else if (t.type === 'refund') c -= toCents(t.amount);
  }
  return fromCents(c);
}

export function groupSpending(txs: ReportTx[], key: 'category_id' | 'member_id' | 'month') {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.status !== 'posted' || (t.type !== 'expense' && t.type !== 'refund')) continue;
    const k = key === 'month' ? t.occurred_on.slice(0, 7) : (t[key] ?? 'none');
    const v = (map.get(k) ?? 0) + (t.type === 'expense' ? toCents(t.amount) : -toCents(t.amount));
    map.set(k, v);
  }
  return [...map.entries()].map(([k, v]) => ({ key: k, amount: fromCents(v) })).sort((a, b) => b.amount - a.amount);
}

export function totalsByType(txs: ReportTx[]) {
  const out: Record<string, number> = {};
  for (const t of txs) {
    if (t.status !== 'posted') continue;
    out[t.type] = fromCents(toCents(out[t.type] ?? 0) + toCents(t.amount));
  }
  return out;
}

/** CSV con separador coma, comillas escapadas y BOM para Excel. */
export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Evita inyección de fórmulas en hojas de cálculo
    const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}
