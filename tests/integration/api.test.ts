/**
 * Pruebas de integración contra un Supabase real (local: `npx supabase start`).
 * Ejecutar: npm run test:integration
 * Usa la URL/anon key de .env.local. Crea usuarios de prueba aislados por ejecución.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import type { Database } from '../../src/types/database';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
  }),
);
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
type C = SupabaseClient<Database>;
const run = Date.now();

async function user(name: string): Promise<{ c: C; id: string }> {
  const c = createClient<Database>(URL_, KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signUp({ email: `${name}.${run}@test.local`, password: 'Prueba1234' });
  if (error) throw error;
  return { c, id: data.user!.id };
}
const ok = <T>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data as NonNullable<T>; };

let eudys: { c: C; id: string }, mei: { c: C; id: string }, extra: { c: C; id: string };
let hid: string, meiMember: string, eudysMember: string, catSuper: string, fundCommon: string, fundPetty: string, goal: string, allocSuper: string;

beforeAll(async () => {
  [eudys, mei, extra] = await Promise.all([user('eudys'), user('mei'), user('externo')]);
  hid = ok(await eudys.c.rpc('create_household', { p_setup: {
    household_name: 'Integración',
    members: [{ key: 'me', name: 'Eudys', income: 42550 }, { key: 'partner', name: 'Mei', income: 16180 }],
    funds: [{ key: 'petty', name: 'Caja chica', kind: 'petty_cash' }, { key: 'common', name: 'Fondo común', kind: 'common' }],
    categories: [
      { name: 'Supermercado', amount: 12000, shares: { me: 75, partner: 25 } },
      { name: 'Internet', amount: 1500, shares: { me: 75, partner: 25 }, bill: { kind: 'internet', due_day: 28 } },
    ],
    savings: [{ name: 'Ahorro conjunto', commitments: { me: 1000, partner: 1000 } }],
  } as never })) as string;
  const members = ok(await eudys.c.from('household_members').select('*'));
  meiMember = members.find((m) => m.display_name === 'Mei')!.id;
  eudysMember = members.find((m) => m.display_name === 'Eudys')!.id;
  const code = ok(await eudys.c.rpc('create_invite', { p_member: meiMember })) as string;
  ok(await mei.c.rpc('accept_invite', { p_code: code }));
  catSuper = ok(await eudys.c.from('categories').select('id').eq('name', 'Supermercado').single()).id;
  const funds = ok(await eudys.c.from('funds').select('*'));
  fundCommon = funds.find((f) => f.kind === 'common')!.id;
  fundPetty = funds.find((f) => f.kind === 'petty_cash')!.id;
  goal = ok(await eudys.c.from('savings_goals').select('id').single()).id;
  allocSuper = ok(await eudys.c.from('budget_allocations').select('id').eq('category_id', catSuper).single()).id;
}, 60000);

const spentSuper = async (c: C) => Number(ok(await c.from('v_allocations').select('spent').eq('id', allocSuper).single()).spent);
const fundBal = async (c: C, id: string) => Number(ok(await c.from('v_fund_balances').select('balance').eq('fund_id', id).single()).balance);

test('crear gasto: suma al gasto real, no altera el presupuesto', async () => {
  ok(await mei.c.from('transactions').insert({ household_id: hid, type: 'expense', amount: 2500, description: 'Súper', category_id: catSuper, member_id: meiMember }));
  expect(await spentSuper(eudys.c)).toBe(2500);
  expect(Number(ok(await eudys.c.from('budget_allocations').select('amount').eq('id', allocSuper).single()).amount)).toBe(12000);
});

test('aportación y transferencia entre fondos no son gasto', async () => {
  ok(await eudys.c.from('transactions').insert({ household_id: hid, type: 'contribution', amount: 10000, description: 'Aporte', member_id: eudysMember, to_fund_id: fundCommon }));
  ok(await eudys.c.from('transactions').insert({ household_id: hid, type: 'transfer', amount: 3000, description: 'Reponer', fund_id: fundCommon, to_fund_id: fundPetty }));
  expect(await fundBal(eudys.c, fundCommon)).toBe(7000);
  expect(await fundBal(eudys.c, fundPetty)).toBe(3000);
  expect(await spentSuper(eudys.c)).toBe(2500);
});

test('registrar pago de servicio (monto real distinto) marca el ciclo pagado', async () => {
  const cycle = ok(await eudys.c.from('v_bill_cycles').select('*').order('due_date').limit(1).single());
  ok(await eudys.c.from('transactions').insert({ household_id: hid, type: 'expense', amount: 1650, description: 'Internet', category_id: cycle.category_id!, bill_cycle_id: cycle.id! }));
  const after = ok(await eudys.c.from('v_bill_cycles').select('status, paid_amount').eq('id', cycle.id!).single());
  expect(after.status).toBe('paid');
  expect(Number(after.paid_amount)).toBe(1650);
});

test('crear deuda y registrar abono', async () => {
  const d = ok(await eudys.c.from('debts').insert({ household_id: hid, name: 'Préstamo', original_amount: 20000, start_date: '2026-10-01', installment_amount: 5000, installments_count: 4 }).select('id').single());
  ok(await eudys.c.from('transactions').insert({ household_id: hid, type: 'debt_payment', amount: 5000, description: 'Cuota 1', debt_id: d.id }));
  const row = ok(await eudys.c.from('v_debts').select('balance, paid_installments').eq('id', d.id).single());
  expect(Number(row.balance)).toBe(15000);
  expect(row.paid_installments).toBe(1);
  const over = await eudys.c.from('transactions').insert({ household_id: hid, type: 'debt_payment', amount: 99999, description: 'Exceso', debt_id: d.id });
  expect(over.error?.message).toContain('SOBREPAGO_DEUDA');
});

test('crear ahorro y aportar (no es gasto)', async () => {
  ok(await mei.c.from('transactions').insert({ household_id: hid, type: 'savings_deposit', amount: 1000, description: 'Ahorro', savings_goal_id: goal, member_id: meiMember }));
  expect(Number(ok(await mei.c.from('v_goal_balances').select('balance').eq('goal_id', goal).single()).balance)).toBe(1000);
  expect(await spentSuper(mei.c)).toBe(2500);
});

test('adjuntar comprobante privado y abrirlo con URL firmada', async () => {
  const tx = ok(await eudys.c.from('transactions').insert({ household_id: hid, type: 'expense', amount: 100, description: 'Con recibo', category_id: catSuper }).select('id').single());
  const path = `${hid}/${tx.id}/recibo.png`;
  const png = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6360000002000154A24F5D0000000049454E44AE426082', 'hex');
  ok(await eudys.c.storage.from('receipts').upload(path, png, { contentType: 'image/png' }));
  ok(await eudys.c.from('transaction_attachments').insert({ household_id: hid, transaction_id: tx.id, storage_path: path, file_name: 'recibo.png', mime_type: 'image/png', size_bytes: png.length }));
  // Mei (mismo hogar) puede verlo
  const signed = ok(await mei.c.storage.from('receipts').createSignedUrl(path, 60));
  const res = await fetch(signed.signedUrl);
  expect(res.status).toBe(200);
  // El bucket no es público
  const pub = await fetch(`${URL_}/storage/v1/object/public/receipts/${path}`);
  expect(pub.status).toBeGreaterThanOrEqual(400);
  // Un externo no puede firmar ni descargar
  const ext = await extra.c.storage.from('receipts').createSignedUrl(path, 60);
  expect(ext.error).toBeTruthy();
});

test('consultar reportes: vista de presupuesto con gasto real correcto', async () => {
  const rows = ok(await eudys.c.from('v_allocations').select('category_name, effective_amount, spent').eq('household_id', hid));
  const total = rows.reduce((a, r) => a + Number(r.spent), 0);
  expect(total).toBe(2500 + 1650 + 100);
});

describe('seguridad y privacidad', () => {
  let meiPersonal: string;
  beforeAll(async () => {
    const tx = ok(await mei.c.from('transactions').insert({ household_id: hid, scope: 'personal', type: 'expense', amount: 777, description: 'Secreto de Mei', category_id: catSuper }).select('id').single());
    meiPersonal = tx.id;
    ok(await eudys.c.from('transactions').insert({ household_id: hid, scope: 'personal', type: 'income', amount: 555, description: 'Secreto de Eudys' }));
  });
  test('Eudys no puede acceder a gastos personales de Mei', async () => {
    const r = ok(await eudys.c.from('transactions').select('id').eq('id', meiPersonal));
    expect(r).toHaveLength(0);
    const search = ok(await eudys.c.from('transactions').select('description').ilike('description', '%Secreto%'));
    expect(search.map((x) => x.description)).toEqual(['Secreto de Eudys']);
  });
  test('Mei no puede acceder a gastos personales de Eudys', async () => {
    const r = ok(await mei.c.from('transactions').select('description').eq('scope', 'personal'));
    expect(r.map((x) => x.description)).toEqual(['Secreto de Mei']);
  });
  test('los gastos personales no afectan el presupuesto compartido', async () => {
    expect(await spentSuper(eudys.c)).toBe(2600);
  });
  test('comprobantes personales no se pueden abrir sin autorización', async () => {
    const path = `${hid}/${meiPersonal}/p.png`;
    ok(await mei.c.storage.from('receipts').upload(path, Buffer.from('x'), { contentType: 'image/png' }));
    const r = await eudys.c.storage.from('receipts').createSignedUrl(path, 60);
    expect(r.error).toBeTruthy();
  });
  test('un usuario externo no puede acceder al hogar', async () => {
    expect(ok(await extra.c.from('households').select('*'))).toHaveLength(0);
    expect(ok(await extra.c.from('transactions').select('*'))).toHaveLength(0);
    const ins = await extra.c.from('transactions').insert({ household_id: hid, type: 'expense', amount: 1, description: 'x', category_id: catSuper });
    expect(ins.error).toBeTruthy();
  });
  test('las operaciones respetan permisos: no se borra, solo se anula', async () => {
    const tx = ok(await eudys.c.from('transactions').insert({ household_id: hid, type: 'expense', amount: 10, description: 'A anular', category_id: catSuper }).select('id').single());
    const del = await eudys.c.from('transactions').delete().eq('id', tx.id);
    expect(del.error).toBeTruthy();
    ok(await mei.c.rpc('void_transaction', { p_id: tx.id, p_reason: 'Prueba de anulación' }));
    const log = ok(await eudys.c.from('audit_logs').select('action, reason, actor').eq('record_id', tx.id).eq('action', 'void').single());
    expect(log.reason).toBe('Prueba de anulación');
    expect(log.actor).toBe(mei.id);
    const inv = await mei.c.rpc('create_invite');
    expect(inv.error?.message).toContain('SOLO_ADMIN');
  });
});
