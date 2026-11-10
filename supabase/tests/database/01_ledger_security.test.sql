-- Pruebas de reglas contables, privacidad y permisos.
-- Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(77);

-- ---------------------------------------------------------------- usuarios
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
 ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eudys@test.local', '', now(), now(), now(), '{}', '{}'),
 ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mei@test.local', '', now(), now(), now(), '{}', '{}'),
 ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'intruso@test.local', '', now(), now(), now(), '{}', '{}');

create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
$$;
create or replace function pg_temp.v(k text) returns uuid language sql as $$ select current_setting('t.' || k)::uuid $$;
create or replace function pg_temp.put(k text, val uuid) returns void language sql as $$ select set_config('t.' || k, val::text, false) $$;
grant execute on function pg_temp.v(text), pg_temp.put(text, uuid), pg_temp.as_user(text) to authenticated;

-- ---------------------------------------------------------------- hogar (Eudys)
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set role authenticated;

select pg_temp.put('hid', public.create_household('{
  "household_name": "Hogar de prueba",
  "members": [{"key":"me","name":"Eudys","income":42550,"color":"#1F2C66"},
              {"key":"partner","name":"Mei","income":16180,"color":"#FFCB2F"}],
  "funds": [{"key":"petty","name":"Caja chica","kind":"petty_cash"},
            {"key":"common","name":"Fondo común","kind":"common"}],
  "payment_methods": [{"name":"Efectivo","kind":"cash"}],
  "categories": [
    {"name":"Supermercado","icon":"cart","amount":12000,"shares":{"me":75,"partner":25}},
    {"name":"Internet","icon":"wifi","amount":1500,"shares":{"me":75,"partner":25},"is_variable":false,
     "bill":{"kind":"internet","due_day":28}},
    {"name":"Caja chica","icon":"wallet","amount":4000,"shares":{"me":50,"partner":50},"kind":"fund","fund_key":"petty"}
  ],
  "savings": [{"name":"Ahorro conjunto","kind":"general","commitments":{"me":1000,"partner":1000}}]
}'::jsonb));

select is((select count(*) from public.household_members where household_id = pg_temp.v('hid')), 2::bigint, 'Se crean 2 miembros');
select is((select role::text from public.household_members where user_id = auth.uid()), 'admin', 'El creador es administrador');
select is((select sum(amount) from public.budget_allocations where household_id = pg_temp.v('hid')), 17500.00, 'Presupuesto inicial cargado desde la configuración');
select is((select count(*) from public.income_records where household_id = pg_temp.v('hid')), 2::bigint, 'Ingresos iniciales registrados');
select ok((select count(*) from public.bill_cycles) >= 1, 'Se generan ciclos del servicio');
select throws_like($$ select public.create_household('{"members":[{"key":"me","name":"X"}]}'::jsonb) $$, '%YA_TIENES_HOGAR%', 'Un usuario no puede crear dos hogares');

select pg_temp.put('mei_member', (select id from public.household_members where display_name = 'Mei'));
select pg_temp.put('eudys_member', (select id from public.household_members where display_name = 'Eudys'));
select pg_temp.put('cat_super', (select id from public.categories where name = 'Supermercado'));
select pg_temp.put('cat_petty', (select id from public.categories where name = 'Caja chica'));
select pg_temp.put('fund_petty', (select id from public.funds where kind = 'petty_cash'));
select pg_temp.put('fund_common', (select id from public.funds where kind = 'common'));
select pg_temp.put('goal', (select id from public.savings_goals limit 1));
select pg_temp.put('alloc_super', (select id from public.budget_allocations where category_id = pg_temp.v('cat_super')));

-- distribución inválida
select throws_like($$ update public.budget_allocations set shares = jsonb_build_object(pg_temp.v('mei_member')::text, 60)
                      where id = pg_temp.v('alloc_super') $$, '%DISTRIBUCION_INVALIDA%', 'La distribución debe sumar 100%');

-- invitación
select set_config('t.code', public.create_invite(pg_temp.v('mei_member')), false);
select ok(current_setting('t.code') ~ '^[A-Z2-9]{8}$', 'Código de invitación seguro de 8 caracteres');

-- ---------------------------------------------------------------- Mei se une
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(public.accept_invite(current_setting('t.code'), 'Mei'), pg_temp.v('hid'), 'Mei acepta la invitación');
select throws_like($$ select public.accept_invite(current_setting('t.code')) $$, '%YA_TIENES_HOGAR%', 'No puede reutilizar la invitación');
select is((select role::text from public.household_members where user_id = auth.uid()), 'member', 'Mei es miembro');
select throws_like($$ select public.create_invite() $$, '%SOLO_ADMIN%', 'Solo el admin invita');

-- ---------------------------------------------------------------- A. Presupuesto no es gasto
select is((select spent from public.v_allocations where id = pg_temp.v('alloc_super')), 0.00, 'Sin gastos, el gasto real es 0 aunque haya presupuesto');

insert into public.transactions (household_id, type, amount, description, category_id, member_id, occurred_on)
values (pg_temp.v('hid'), 'expense', 3200, 'Compra semanal', pg_temp.v('cat_super'), pg_temp.v('mei_member'), public.today_local());
insert into public.transactions (household_id, type, amount, description, category_id, member_id, occurred_on)
values (pg_temp.v('hid'), 'expense', 1800, 'Frutas y verduras', pg_temp.v('cat_super'), pg_temp.v('mei_member'), public.today_local());
select is((select spent from public.v_allocations where id = pg_temp.v('alloc_super')), 5000.00, 'Varios gastos en la misma categoría se acumulan');
select is((select amount from public.budget_allocations where id = pg_temp.v('alloc_super')), 12000.00, 'El gasto no modifica el presupuesto');

-- ---------------------------------------------------------------- B. Aportación no es gasto
insert into public.transactions (household_id, type, amount, description, member_id, to_fund_id)
values (pg_temp.v('hid'), 'contribution', 6000, 'Aporte quincena', pg_temp.v('mei_member'), pg_temp.v('fund_common'));
select is((select balance from public.v_fund_balances where fund_id = pg_temp.v('fund_common')), 6000.00, 'La aportación entra al fondo común');
select is((select sum(spent) from public.v_allocations where household_id = pg_temp.v('hid')), 5000.00, 'La aportación no cuenta como gasto');

-- ---------------------------------------------------------------- C. Transferencia no es gasto
insert into public.transactions (household_id, type, amount, description, fund_id, to_fund_id)
values (pg_temp.v('hid'), 'transfer', 1000, 'Reponer caja chica', pg_temp.v('fund_common'), pg_temp.v('fund_petty'));
select is((select balance from public.v_fund_balances where fund_id = pg_temp.v('fund_common')), 5000.00, 'Transferencia descuenta del origen');
select is((select balance from public.v_fund_balances where fund_id = pg_temp.v('fund_petty')), 1000.00, 'Transferencia suma al destino');
select is((select sum(spent) from public.v_allocations where household_id = pg_temp.v('hid')), 5000.00, 'La transferencia no genera gasto');

-- ---------------------------------------------------------------- G. Fondos consistentes
select throws_like($$ insert into public.transactions (household_id, type, amount, description, category_id, fund_id)
                      values (pg_temp.v('hid'), 'expense', 1500, 'Gasto mayor al saldo', pg_temp.v('cat_petty'), pg_temp.v('fund_petty')) $$,
                   '%FONDO_INSUFICIENTE%', 'No se inventa saldo: el fondo no puede quedar negativo');
insert into public.transactions (household_id, type, amount, description, category_id, fund_id)
values (pg_temp.v('hid'), 'expense', 350, 'Pasaje', pg_temp.v('cat_petty'), pg_temp.v('fund_petty'));
insert into public.transactions (household_id, type, amount, description, category_id, fund_id)
values (pg_temp.v('hid'), 'expense', 150, 'Pan', pg_temp.v('cat_petty'), pg_temp.v('fund_petty'));
select is((select balance from public.v_fund_balances where fund_id = pg_temp.v('fund_petty')), 500.00, 'Múltiples gastos pequeños desde caja chica');
select is((select balance from public.v_fund_balances where fund_id = pg_temp.v('fund_petty')), 500.00, 'Vista de saldos coincide');
select throws_like($$ insert into public.transactions (household_id, type, amount, description, fund_id, to_fund_id)
                      values (pg_temp.v('hid'), 'transfer', 10, 'x', pg_temp.v('fund_petty'), pg_temp.v('fund_petty')) $$,
                   '%check%', 'No se transfiere a sí mismo');

-- ---------------------------------------------------------------- Ahorros
insert into public.transactions (household_id, type, amount, description, savings_goal_id, fund_id, member_id)
values (pg_temp.v('hid'), 'savings_deposit', 2000, 'Ahorro del mes', pg_temp.v('goal'), pg_temp.v('fund_common'), pg_temp.v('mei_member'));
select is((select balance from public.v_goal_balances where goal_id = pg_temp.v('goal')), 2000.00, 'Aporte a ahorro');
select is((select balance from public.v_fund_balances where fund_id = pg_temp.v('fund_common')), 3000.00, 'Aporte a ahorro desde fondo descuenta del fondo');
select is((select sum(spent) from public.v_allocations where household_id = pg_temp.v('hid')), 5500.00, 'El ahorro no es gasto (solo cuentan los gastos reales: 5000 + 500)');
select throws_like($$ insert into public.transactions (household_id, type, amount, description, savings_goal_id)
                      values (pg_temp.v('hid'), 'savings_withdrawal', 2500, 'Retiro', pg_temp.v('goal')) $$,
                   '%AHORRO_INSUFICIENTE%', 'No se retira más de lo ahorrado');

-- ---------------------------------------------------------------- D. Deudas y abonos
insert into public.debts (household_id, name, creditor, kind, original_amount, start_date, installment_amount, frequency, installments_count)
values (pg_temp.v('hid'), 'Préstamo nevera', 'Tienda', 'financing', 10000, public.today_local() - 40, 2500, 'monthly', 4);
select pg_temp.put('debt', (select id from public.debts limit 1));
insert into public.transactions (household_id, type, amount, description, debt_id)
values (pg_temp.v('hid'), 'debt_payment', 2000, 'Abono', pg_temp.v('debt'));
select is((select balance from public.v_debt_balances where debt_id = pg_temp.v('debt')), 8000.00, 'Un abono de 2,000 reduce el saldo en 2,000');
insert into public.transactions (household_id, type, amount, description, debt_id, debt_charge_kind)
values (pg_temp.v('hid'), 'debt_charge', 150, 'Recargo por mora', pg_temp.v('debt'), 'fee');
select is((select balance from public.v_debt_balances where debt_id = pg_temp.v('debt')), 8150.00, 'Los recargos aumentan el saldo');
select throws_like($$ insert into public.transactions (household_id, type, amount, description, debt_id)
                      values (pg_temp.v('hid'), 'debt_payment', 9000, 'Abono grande', pg_temp.v('debt')) $$,
                   '%SOBREPAGO_DEUDA%', 'Un abono no lleva el saldo bajo cero sin confirmación');
insert into public.transactions (household_id, type, amount, description, debt_id, allow_overpayment)
values (pg_temp.v('hid'), 'debt_payment', 8150, 'Liquidación', pg_temp.v('debt'), false);
select is((select balance from public.v_debt_balances where debt_id = pg_temp.v('debt')), 0.00, 'Pago completo liquida la deuda');
select is((select next_due_date from public.v_debts where id = pg_temp.v('debt')), null::date, 'Deuda saldada no tiene próximo vencimiento');
select is((select sum(spent) from public.v_allocations where household_id = pg_temp.v('hid')), 5500.00, 'Los abonos no se duplican como gasto de categoría');

-- ---------------------------------------------------------------- F. Sin duplicidad (idempotencia)
insert into public.transactions (household_id, type, amount, description, category_id, client_request_id)
values (pg_temp.v('hid'), 'expense', 100, 'Idempotente', pg_temp.v('cat_super'), 'aaaaaaaa-0000-0000-0000-000000000001');
select throws_like($$ insert into public.transactions (household_id, type, amount, description, category_id, client_request_id)
                      values (pg_temp.v('hid'), 'expense', 100, 'Idempotente', pg_temp.v('cat_super'), 'aaaaaaaa-0000-0000-0000-000000000001') $$,
                   '%duplicate key%', 'Un mismo envío no se registra dos veces');

-- ---------------------------------------------------------------- Anulación y auditoría
select pg_temp.put('tx_void', (select id from public.transactions where description = 'Idempotente'));
select throws_like($$ update public.transactions set status = 'voided', void_reason = 'x', voided_at = now() where id = pg_temp.v('tx_void') $$,
                   '%USA_ANULACION%', 'No se puede anular sin la operación de anulación');
select throws_like($$ select public.void_transaction(pg_temp.v('tx_void'), '') $$, '%MOTIVO_REQUERIDO%', 'La anulación exige motivo');
select lives_ok($$ select public.void_transaction(pg_temp.v('tx_void'), 'Registrado por error') $$, 'Anular con motivo');
select is((select spent from public.v_allocations where id = pg_temp.v('alloc_super')), 5000.00, 'El anulado no cuenta en el gasto real');
select throws_like($$ update public.transactions set amount = 1 where id = pg_temp.v('tx_void') $$, '%MOVIMIENTO_ANULADO%', 'Un anulado no se edita');
select throws_like($$ delete from public.transactions where id = pg_temp.v('tx_void') $$, '%permission denied%', 'Borrar movimientos está prohibido');
reset role;
select is((select count(*) from public.transactions where id = pg_temp.v('tx_void')), 1::bigint, 'Los movimientos nunca se eliminan');
select is((select reason from public.audit_logs where record_id = pg_temp.v('tx_void') and action = 'void'), 'Registrado por error', 'La auditoría guarda el motivo');
select ok((select actor from public.audit_logs where record_id = pg_temp.v('tx_void') and action = 'void') = '22222222-2222-2222-2222-222222222222', 'La auditoría registra quién anuló');
set role authenticated;

-- Edición auditada con valores anteriores y nuevos
update public.transactions set amount = 1900 where description = 'Frutas y verduras';
select is((select (old_data ->> 'amount') || '>' || (new_data ->> 'amount') from public.audit_logs
           where table_name = 'transactions' and action = 'update' and new_data ->> 'description' = 'Frutas y verduras'
           order by id desc limit 1), '1800.00>1900.00', 'Auditoría de edición con valores anteriores y nuevos');

-- ---------------------------------------------------------------- Sobrantes y excesos
select throws_like($$ select public.move_budget('to_savings', 999999, 'Mover todo', pg_temp.v('alloc_super'), null, null, pg_temp.v('goal')) $$,
                   '%SOBRANTE_INSUFICIENTE%', 'Solo se mueve el sobrante disponible');
select lives_ok($$ select public.move_budget('to_savings', 1000, 'Sobrante del súper', pg_temp.v('alloc_super'), null, null, pg_temp.v('goal')) $$,
                'Transferir sobrante a ahorro');
select is((select effective_amount from public.v_allocations where id = pg_temp.v('alloc_super')), 11000.00, 'El sobrante movido reduce el disponible de la categoría');
select is((select balance from public.v_goal_balances where goal_id = pg_temp.v('goal')), 3000.00, 'El sobrante llega a la meta de ahorro');
select is((select sum(spent) from public.v_allocations where household_id = pg_temp.v('hid')), 5600.00, 'Mover sobrante no es gasto');
select throws_like($$ select public.adjust_allocation(pg_temp.v('alloc_super'), 13000, '') $$, '%MOTIVO_REQUERIDO%', 'Ajustar presupuesto exige motivo (nunca silencioso)');

-- Exceso: nunca se bloquea el gasto
insert into public.transactions (household_id, type, amount, description, category_id, occurred_on)
values (pg_temp.v('hid'), 'expense', 9000, 'Compra grande', pg_temp.v('cat_super'), public.today_local());
select ok((select spent > effective_amount from public.v_allocations where id = pg_temp.v('alloc_super')), 'El gasto que excede se registra igualmente');
select ok(exists (select 1 from public.notifications where kind = 'budget_exceeded'), 'Exceso genera notificación');

-- ---------------------------------------------------------------- H. Privacidad
insert into public.funds (household_id, scope, name, kind) values (pg_temp.v('hid'), 'personal', 'Mi cartera', 'wallet');
select pg_temp.put('mei_wallet', (select id from public.funds where name = 'Mi cartera'));
insert into public.transactions (household_id, scope, type, amount, description, to_fund_id)
values (pg_temp.v('hid'), 'personal', 'income', 5000, 'Freelance secreto', pg_temp.v('mei_wallet'));
insert into public.transactions (household_id, scope, type, amount, description, category_id, fund_id)
values (pg_temp.v('hid'), 'personal', 'expense', 1200, 'Regalo sorpresa', pg_temp.v('cat_super'), pg_temp.v('mei_wallet'));
select is((select balance from public.v_fund_balances where fund_id = pg_temp.v('mei_wallet')), 3800.00, 'Finanzas personales funcionan');
select is((select spent from public.v_allocations where id = pg_temp.v('alloc_super')), 14100.00, 'Gastos personales no forman parte del presupuesto del hogar');
select throws_like($$ insert into public.transactions (household_id, scope, type, amount, description, category_id, fund_id)
                      values (pg_temp.v('hid'), 'household', 'expense', 10, 'Mezcla', pg_temp.v('cat_super'), pg_temp.v('mei_wallet')) $$,
                   '%AMBITO_INCOMPATIBLE%', 'No se mezclan fondos personales con movimientos del hogar');

select pg_temp.put('mei_tx', (select id from public.transactions where description = 'Regalo sorpresa'));

-- Eudys intenta ver lo de Mei
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is((select count(*) from public.transactions where scope = 'personal'), 0::bigint, 'Eudys no ve movimientos personales de Mei');
select is((select count(*) from public.funds where scope = 'personal'), 0::bigint, 'Eudys no ve fondos personales de Mei');
select is((select count(*) from public.audit_logs where scope = 'personal'), 0::bigint, 'Eudys no ve la auditoría personal de Mei');
select is((select count(*) from public.v_fund_balances where scope = 'personal'), 0::bigint, 'Las vistas también respetan la privacidad');
select ok(not exists (select 1 from public.notifications where body like '%secreto%' or title like '%Regalo%'), 'Ninguna notificación filtra datos personales');
select ok(not public.can_access_receipt_path(pg_temp.v('hid')::text || '/' || pg_temp.v('mei_tx')::text || '/a.jpg'),
          'Eudys no puede abrir comprobantes personales de Mei');
select throws_like($$ insert into public.transactions (household_id, scope, owner_user_id, type, amount, description, category_id)
                      values (pg_temp.v('hid'), 'personal', '22222222-2222-2222-2222-222222222222', 'expense', 10, 'Suplantación', pg_temp.v('cat_super')) $$,
                   '%row-level security%', 'Eudys no puede crear registros personales a nombre de Mei');
select throws_like($$ select public.void_transaction(pg_temp.v('mei_tx'), 'Intento ajeno') $$, '%SIN_ACCESO%', 'Eudys no puede anular movimientos personales de Mei');
update public.transactions set amount = 1 where id = pg_temp.v('mei_tx');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is((select amount from public.transactions where id = pg_temp.v('mei_tx')), 1200.00, 'Eudys no puede editar movimientos personales de Mei');

-- ---------------------------------------------------------------- Usuario externo
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is((select count(*) from public.households), 0::bigint, 'Un externo no ve el hogar');
select is((select count(*) from public.transactions), 0::bigint, 'Un externo no ve movimientos');
select is((select count(*) from public.v_allocations), 0::bigint, 'Un externo no ve presupuestos');
select throws_like($$ insert into public.transactions (household_id, type, amount, description, category_id)
                      values (pg_temp.v('hid'), 'expense', 10, 'Intrusión', pg_temp.v('cat_super')) $$,
                   '%row-level security%', 'Un externo no puede registrar movimientos');
select throws_like($$ select public.accept_invite('ZZZZZZZZ') $$, '%INVITACION_INVALIDA%', 'Códigos inválidos rechazados');
select ok(not public.can_access_receipt_path(pg_temp.v('hid')::text || '/' || pg_temp.v('tx_void')::text || '/a.jpg'),
          'Un externo no puede abrir comprobantes del hogar');

-- ---------------------------------------------------------------- Recordatorios / ciclos
reset role;
select pg_temp.put('cycle', (select id from public.bill_cycles where household_id = pg_temp.v('hid') order by due_date limit 1));
select lives_ok($$ select public.generate_notifications((select due_date - 5 from public.bill_cycles where id = pg_temp.v('cycle'))) $$,
                'Generación de recordatorios');
select ok(exists (select 1 from public.notifications where kind = 'bill_due' and dedupe_key like 'bill:' || pg_temp.v('cycle') || ':5:%'),
          'Recordatorio 5 días antes');
select is((select count(distinct user_id) from public.notifications where dedupe_key like 'bill:' || pg_temp.v('cycle') || ':5:%'), 2::bigint,
          'El recordatorio llega a ambos miembros');
-- pagar el ciclo cancela recordatorios futuros
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set role authenticated;
insert into public.transactions (household_id, type, amount, description, category_id, bill_cycle_id)
select pg_temp.v('hid'), 'expense', 1650, 'Pago internet', b.category_id, c.id
  from public.bill_cycles c join public.bills b on b.id = c.bill_id where c.id = pg_temp.v('cycle');
select is((select status from public.v_bill_cycles where id = pg_temp.v('cycle')), 'paid', 'El monto real puede diferir del estimado y el ciclo queda pagado');
reset role;
select lives_ok($$ select public.generate_notifications((select due_date - 1 from public.bill_cycles where id = pg_temp.v('cycle'))) $$, 'Generación tras el pago');
select is((select count(*) from public.notifications where dedupe_key like 'bill:' || pg_temp.v('cycle') || ':1:%'), 0::bigint,
          'Un ciclo pagado no genera más recordatorios');

select * from finish();
rollback;
