-- =====================================================================
-- OpTogether · Endurecimiento de seguridad (auditoría interna)
-- =====================================================================

-- 1) Funciones internas: Supabase concede EXECUTE a anon/authenticated por defecto.
--    Las funciones SECURITY DEFINER internas no deben poder invocarse desde la API
--    (p. ej. fund_balance(id) leería saldos ajenos sin RLS; notify_users enviaría avisos).
do $$
declare f text;
begin
  foreach f in array array[
    'public.notify_users(uuid, public.data_scope, uuid, text, text, text, jsonb, text)',
    'public._ensure_period(uuid, int, int)',
    'public._ensure_bill_cycles(uuid, int)',
    'public._next_cycle_date(public.bills, date)',
    'public.assert_ref(text, uuid, uuid, public.data_scope, uuid)',
    'public.assert_member_of(uuid, uuid)',
    'public.fund_balance(uuid)',
    'public.goal_balance(uuid)',
    'public.debt_balance(uuid)',
    'public.allocation_available(uuid)',
    'public.valid_shares(uuid, jsonb)',
    'public.valid_commitments(uuid, jsonb)',
    'public.gen_invite_code()',
    'public.generate_notifications(date)',
    'public.audit_row()',
    'public.transactions_before_write()',
    'public.transactions_check_balances()',
    'public.transactions_budget_alerts()',
    'public.validate_catalog_refs()',
    'public.validate_allocation()',
    'public.bills_after_insert()',
    'public.push_on_notification()',
    'public.touch_updated_at()',
    'public.guard_scoped_row()',
    'public.bill_cycles_guard()',
    'public.budget_moves_guard()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- Nada ejecutable para anónimos en el esquema público.
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- 2) Miembros: nadie puede auto-promoverse a administrador ni reasignar cuentas.
create or replace function public.household_members_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.household_id <> old.household_id then
    raise exception 'CAMPO_INMUTABLE';
  end if;
  if new.user_id is distinct from old.user_id and coalesce(current_setting('app.accepting_invite', true), '') <> 'on' then
    raise exception 'CAMPO_INMUTABLE' using hint = 'La cuenta vinculada solo cambia al aceptar una invitación.';
  end if;
  if new.role <> old.role then
    if not public.is_admin(old.household_id) then
      raise exception 'SOLO_ADMIN' using hint = 'Solo el administrador puede cambiar roles.';
    end if;
    if old.role = 'admin' and not exists (
      select 1 from public.household_members m
      where m.household_id = old.household_id and m.role = 'admin' and m.id <> old.id and m.user_id is not null) then
      raise exception 'ULTIMO_ADMIN' using hint = 'El hogar necesita al menos un administrador.';
    end if;
  end if;
  return new;
end $$;
create trigger household_members_guard before update on public.household_members
  for each row execute function public.household_members_guard();
revoke execute on function public.household_members_guard() from public, anon, authenticated;

-- accept_invite marca la operación para poder vincular la cuenta.
create or replace function public.accept_invite(p_code text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); inv public.household_invites; v_mid uuid;
begin
  if v_uid is null then raise exception 'SIN_SESION'; end if;
  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'YA_TIENES_HOGAR' using hint = 'Tu usuario ya pertenece a un hogar.';
  end if;
  select * into inv from public.household_invites where code = upper(trim(p_code)) for update;
  if inv.id is null or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at < now() then
    raise exception 'INVITACION_INVALIDA' using hint = 'El código no existe, expiró o ya fue usado.';
  end if;
  perform set_config('app.accepting_invite', 'on', true);
  if inv.member_id is not null then
    update public.household_members
       set user_id = v_uid, joined_at = now(),
           display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
     where id = inv.member_id and user_id is null
    returning id into v_mid;
    if v_mid is null then raise exception 'INVITACION_INVALIDA'; end if;
  else
    insert into public.household_members (household_id, user_id, display_name, role, joined_at)
    values (inv.household_id, v_uid, coalesce(nullif(trim(p_display_name), ''), 'Miembro'), 'member', now())
    returning id into v_mid;
  end if;
  perform set_config('app.accepting_invite', '', true);
  update public.household_invites set accepted_by = v_uid, accepted_at = now() where id = inv.id;
  return inv.household_id;
end $$;

-- 3) Presupuesto: el monto solo cambia con motivo (adjust_allocation). Nunca en silencio.
create or replace function public.budget_allocations_amount_guard()
returns trigger language plpgsql as $$
begin
  if new.amount <> old.amount and coalesce(current_setting('app.audit_reason', true), '') = '' then
    raise exception 'MOTIVO_REQUERIDO' using hint = 'Usa "Ajustar presupuesto" e indica el motivo.';
  end if;
  return new;
end $$;
create trigger budget_allocations_amount_guard before update on public.budget_allocations
  for each row execute function public.budget_allocations_amount_guard();
revoke execute on function public.budget_allocations_amount_guard() from public, anon, authenticated;

-- 4) Comprobantes: la ruta del archivo debe pertenecer al mismo hogar y movimiento.
drop policy att_insert on public.transaction_attachments;
create policy att_insert on public.transaction_attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and storage_path like household_id::text || '/' || transaction_id::text || '/%'
    and exists (select 1 from public.transactions t
                where t.id = transaction_id and t.household_id = household_id and t.status = 'posted'));
