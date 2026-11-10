import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { toCSV } from '../domain/reports';
import { formatMoney } from './money';

export type Sheet = { name: string; headers: string[]; rows: (string | number | null)[][] };

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

async function share(file: File, mimeType: string, title: string) {
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: title, UTI: undefined });
  return file.uri;
}

export async function exportCSV(base: string, sheet: Sheet) {
  const file = new File(Paths.cache, `${base}-${stamp()}.csv`);
  if (file.exists) file.delete();
  file.create();
  await file.write(toCSV(sheet.headers, sheet.rows));
  return share(file, 'text/csv', 'Exportar CSV');
}

export async function exportExcel(base: string, sheets: Sheet[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.headers, ...s.rows]);
    ws['!cols'] = s.headers.map((h, i) => ({ wch: Math.max(h.length, ...s.rows.slice(0, 200).map((r) => String(r[i] ?? '').length)) + 2 }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const file = new File(Paths.cache, `${base}-${stamp()}.xlsx`);
  if (file.exists) file.delete();
  file.create();
  await file.write(new Uint8Array(bytes));
  return share(file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Exportar Excel');
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** PDF con identidad visual de OpTogether. */
export async function exportPDF(opts: { title: string; subtitle: string; kpis: { label: string; value: number }[]; sheets: Sheet[] }) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    *{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#0E1538}
    body{padding:28px}
    .brand{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #FBBF24;padding-bottom:12px;margin-bottom:18px}
    .logo{font-size:22px;font-weight:800;color:#1F2C66}.logo .to{color:#2563EB}.logo .g{color:#8B5CF6}
    h1{font-size:20px;margin:0}.sub{color:#5A6175;font-size:12px}
    .kpis{display:flex;gap:10px;margin:16px 0}.kpi{flex:1;background:#F3F5FB;border-radius:10px;padding:10px}
    .kpi b{display:block;font-size:16px;color:#1F2C66}.kpi small{color:#5A6175;font-size:11px}
    h2{font-size:14px;margin:22px 0 8px;color:#1F2C66}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th{background:#1F2C66;color:#fff;text-align:left;padding:6px}
    td{padding:5px 6px;border-bottom:1px solid #E3E6EC}
    tr:nth-child(even) td{background:#F8F9FB}
    .num{text-align:right;font-variant-numeric:tabular-nums}
    footer{margin-top:24px;color:#7A8194;font-size:10px}
  </style></head><body>
  <div class="brand"><div class="logo">Op<span class="to">To</span><span class="g">gether</span></div><div class="sub">Generado ${esc(new Date().toLocaleString('es-DO'))}</div></div>
  <h1>${esc(opts.title)}</h1><div class="sub">${esc(opts.subtitle)}</div>
  <div class="kpis">${opts.kpis.map((k) => `<div class="kpi"><small>${esc(k.label)}</small><b>${esc(formatMoney(k.value))}</b></div>`).join('')}</div>
  ${opts.sheets.map((s) => `<h2>${esc(s.name)}</h2><table><thead><tr>${s.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${s.rows.map((r) => `<tr>${r.map((c) => `<td class="${typeof c === 'number' ? 'num' : ''}">${esc(typeof c === 'number' ? formatMoney(c) : c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}
  <footer>OpTogether · Construyendo nuestro futuro, juntos</footer></body></html>`;
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const file = new File(uri);
  return share(file, 'application/pdf', 'Exportar PDF');
}
