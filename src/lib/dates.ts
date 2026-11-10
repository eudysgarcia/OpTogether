/** Fechas en formato ISO local (YYYY-MM-DD), sin depender de zonas horarias del dispositivo. */

export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export type YearMonth = { year: number; month: number }; // month 1..12

const pad = (n: number) => n.toString().padStart(2, '0');

export const toISODate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISODate = (s: string): Date => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayISO = (): string => toISODate(new Date());

export const currentYM = (): YearMonth => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

export const addMonthsYM = ({ year, month }: YearMonth, delta: number): YearMonth => {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
};

export const ymKey = ({ year, month }: YearMonth) => `${year}-${pad(month)}`;
export const ymLabel = ({ year, month }: YearMonth, short = false) =>
  `${(short ? MONTHS_SHORT : MONTHS)[month - 1]} ${year}`;
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const monthRange = ({ year, month }: YearMonth) => {
  const last = new Date(year, month, 0).getDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}`, days: last };
};

export const daysBetween = (fromISO: string, toISO: string): number =>
  Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / 86_400_000);

export const addDaysISO = (iso: string, days: number) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

/** Suma meses respetando fin de mes (31 ene + 1 mes = 28/29 feb). */
export const addMonthsISO = (iso: string, months: number) => {
  const d = parseISODate(iso);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return toISODate(target);
};

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'yearly' | 'one_time';

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  yearly: 'Anual',
  one_time: 'Pago único',
};

/** Periodos por año para cada frecuencia. */
export const PERIODS_PER_YEAR: Record<Frequency, number> = {
  weekly: 52, biweekly: 26, monthly: 12, bimonthly: 6, quarterly: 4, yearly: 1, one_time: 1,
};

export const addFrequency = (iso: string, f: Frequency, n = 1): string => {
  switch (f) {
    case 'weekly': return addDaysISO(iso, 7 * n);
    case 'biweekly': return addDaysISO(iso, 14 * n);
    case 'monthly': return addMonthsISO(iso, n);
    case 'bimonthly': return addMonthsISO(iso, 2 * n);
    case 'quarterly': return addMonthsISO(iso, 3 * n);
    case 'yearly': return addMonthsISO(iso, 12 * n);
    default: return iso;
  }
};

export const formatDate = (iso: string | null | undefined, style: 'short' | 'long' | 'day' = 'short') => {
  if (!iso) return '—';
  const d = parseISODate(iso);
  if (style === 'day') return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  if (style === 'long') {
    const wd = WEEKDAYS[(d.getDay() + 6) % 7];
    return `${capitalize(wd)}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
  }
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** "Hoy", "Mañana", "En 5 días", "Hace 2 días". */
export const relativeDays = (iso: string, today = todayISO()) => {
  const n = daysBetween(today, iso);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  return n > 0 ? `En ${n} días` : `Hace ${-n} días`;
};

/** Matriz de semanas (lunes primero) para un calendario mensual. */
export const monthGrid = ({ year, month }: YearMonth): (string | null)[][] => {
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};

export const weekOf = (iso: string): string[] => {
  const d = parseISODate(iso);
  const monday = addDaysISO(iso, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
};
