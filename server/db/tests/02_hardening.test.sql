-- Pruebas del endurecimiento de seguridad.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant usage on schema extensions to authenticated;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
 ('aaaaaaaa-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '', now(), now(), now(), '{}', '{}'),
 ('bbbbbbbb-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '', now(), now(), now(), '{}', '{}');

create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
$$;
grant execute on function pg_temp.as_user(text) to authenticated;

select pg_temp.as_user('aaaaaaaa-1111-1111-1111-111111111111');
set role authenticated;
select set_config('t.hid', public.create_household('{"members":[{"key":"me","name":"A"},{"key":"partner","name":"B"}],
  "funds":[{"key":"c","name":"Común","kind":"common"}],
  "categories":[{"name":"Súper","amount":1000,"shares":{"me":50,"partner":50}}]}'::jsonb)::text, false);
select set_config('t.code', public.create_invite((select id from public.household_members where display_name = 'B')), false);

select pg_temp.as_user('bbbbbbbb-2222-2222-2222-222222222222');
select lives_ok($$ select public.accept_invite(current_setting('t.code')) $$, 'La invitación sigue funcionando con la guarda de miembros');
select throws_like($$ update public.household_members set role = 'admin' where user_id = auth.uid() $$, '%SOLO_ADMIN%', 'Un miembro no puede auto-promoverse a administrador');
update public.household_members set user_id = auth.uid() where display_name = 'A';
select is((select user_id::text from public.household_members where display_name = 'A'), 'aaaaaaaa-1111-1111-1111-111111111111', 'No se puede secuestrar la cuenta de otro miembro');
select lives_ok($$ update public.household_members set display_name = 'Bea' where user_id = auth.uid() $$, 'Cada uno puede cambiar su nombre');

select throws_like($$ select public.fund_balance((select id from public.funds limit 1)) $$, '%permission denied%', 'Funciones internas no expuestas: fund_balance');
select throws_like($$ select public.notify_users(current_setting('t.hid')::uuid, 'household', null, 'x', 'spam', 'spam', '{}', 'k') $$, '%permission denied%', 'Funciones internas no expuestas: notify_users');
select throws_like($$ select public._ensure_period(gen_random_uuid(), 2030, 1) $$, '%permission denied%', 'Funciones internas no expuestas: _ensure_period');

select throws_like($$ update public.budget_allocations set amount = 5 $$, '%MOTIVO_REQUERIDO%', 'El presupuesto no cambia en silencio');
select lives_ok($$ select public.adjust_allocation((select id from public.budget_allocations limit 1), 1200, 'Subió el súper') $$, 'Ajuste con motivo permitido');

insert into public.transactions (household_id, type, amount, description, category_id)
values (current_setting('t.hid')::uuid, 'expense', 10, 'x', (select id from public.categories limit 1));
select throws_like($$ insert into public.transaction_attachments (household_id, transaction_id, storage_path, file_name, mime_type, size_bytes)
  select household_id, id, 'otro-hogar/otra/ruta.png', 'a.png', 'image/png', 10 from public.transactions limit 1 $$,
  '%row-level security%', 'El comprobante debe estar en la ruta de su movimiento');
select lives_ok($$ insert into public.transactions (household_id, type, amount, description, category_id)
  values (current_setting('t.hid')::uuid, 'expense', 20, 'Trigger tras revocar EXECUTE', (select id from public.categories limit 1)) $$,
  'Los triggers siguen funcionando tras revocar EXECUTE');

select * from finish();
rollback;
