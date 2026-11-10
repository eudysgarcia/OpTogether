/** Utilidades monetarias. Se trabaja en centavos para evitar errores de coma flotante. */

export const toCents = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

export const fromCents = (c: number): number => Math.round(c) / 100;

/** Suma exacta de montos decimales. */
export const sum = (values: (number | string | null | undefined)[]): number =>
  fromCents(values.reduce<number>((acc, v) => acc + toCents(v), 0));

export const round2 = (n: number): number => fromCents(toCents(n));

const group = (intPart: string) => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Formato dominicano: RD$12,345.67
 * @param compact  sin decimales cuando el monto es entero (para cifras grandes en tarjetas)
 */
export function formatMoney(
  value: number | string | null | undefined,
  opts: { compact?: boolean; sign?: boolean; currency?: string; hidden?: boolean } = {},
): string {
  const { compact = false, sign = false, currency = 'RD$', hidden = false } = opts;
  if (hidden) return `${currency}•••••`;
  const cents = toCents(value);
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const int = Math.floor(abs / 100).toString();
  const dec = (abs % 100).toString().padStart(2, '0');
  const body = compact && dec === '00' ? group(int) : `${group(int)}.${dec}`;
  const prefix = negative ? '-' : sign && cents > 0 ? '+' : '';
  return `${prefix}${currency}${body}`;
}

/** Interpreta lo que escribe el usuario ("12,500.5", "12500,50") a número. */
export function parseAmount(input: string): number | null {
  if (!input) return null;
  let s = input.replace(/[^\d.,]/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot && s.length - lastComma <= 3) {
    // coma decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : null;
}

export const pct = (part: number, total: number): number => (total > 0 ? part / total : part > 0 ? Infinity : 0);

export const formatPct = (ratio: number, digits = 0): string =>
  Number.isFinite(ratio) ? `${(ratio * 100).toFixed(digits)}%` : '—';
