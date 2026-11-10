-- =====================================================================
-- OpTogether · Lógica, integridad contable, vistas derivadas y RLS
-- =====================================================================

alter table public.categories
  add column linked_fund_id uuid references public.funds (id) on delete set null;

-- ---------------------------------------------------------------------
-- Helpers de seguridad (SECURITY DEFINER para evitar recursión de RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_member(hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members m where m.household_id = hid and m.user_id = auth.uid());
$$;

create or replace function public.is_admin(hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members m
                 where m.household_id = hid and m.user_id = auth.uid() and m.role = 'admin');
$$;

create or replace function public.my_household_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.household_id from public.household_members m where m.user_id = auth.uid() limit 1;
$$;

create or replace function public.my_member_id(hid uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.id from public.household_members m where m.household_id = hid and m.user_id = auth.uid();
$$;

-- Lectura: lo compartido lo ven los miembros; lo personal SOLO su dueño.
create or replace function public.can_see(hid uuid, s public.data_scope, owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when s = 'personal' then owner is not null and owner = auth.uid() and public.is_member(hid)
              else public.is_member(hid) end;
$$;

-- Escritura: igual que lectura + coherencia scope/owner.
create or replace function public.can_write(hid uuid, s public.data_scope, owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_member(hid)
     and ((s = 'household' and owner is null) or (s = 'personal' and owner = auth.uid()));
$$;

create or replace function public.today_local()
returns date language sql stable as $$
  select (now() at time zone 'America/Santo_Domingo')::date;
$$;

-- shares: claves = miembros del hogar, valores >= 0, suma 100 (o vacío = partes iguales)
create or replace function public.valid_shares(hid uuid, shares jsonb)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_ok boolean; v_sum numeric;
begin
  if shares is null or shares = '{}'::jsonb then return true; end if;
  select bool_and(m.id is not null and (e.value)::numeric >= 0), sum((e.value)::numeric)
    into v_ok, v_sum
    from jsonb_each_text(shares) e
    left join public.household_members m on m.id::text = e.key and m.household_id = hid;
  return coalesce(v_ok, false) and abs(v_sum - 100) < 0.01;
exception when others then
  return false;
end $$;

create or replace function public.valid_commitments(hid uuid, c jsonb)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_ok boolean;
begin
  if c is null or c = '{}'::jsonb then return true; end if;
  select bool_and(m.id is not null and (e.value)::numeric >= 0) into v_ok
    from jsonb_each_text(c) e
    left join public.household_members m on m.id::text = e.key and m.household_id = hid;
  return coalesce(v_ok, false);
exception when others then
  return false;
end $$;

create or replace function public.assert_member_of(p_member uuid, hid uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_member is not null and not exists (
    select 1 from public.household_members m where m.id = p_member and m.household_id = hid) then
    raise exception 'MIEMBRO_INVALIDO' using hint = 'El miembro no pertenece a este hogar.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Auditoría genérica
-- ---------------------------------------------------------------------
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_action text := lower(tg_op);
  v_hid uuid;
  v_scope public.data_scope;
begin
  if tg_op = 'UPDATE' and v_new = v_old then return new; end if;
  if tg_op = 'UPDATE' and v_new ->> 'status' = 'voided' and v_old ->> 'status' <> 'voided' then
    v_action := 'void';
  end if;
  v_hid := case when tg_table_name = 'households' then (v_row ->> 'id')::uuid else (v_row ->> 'household_id')::uuid end;
  v_scope := coalesce((v_row ->> 'scope')::public.data_scope, 'household');
  insert into public.audit_logs (household_id, scope, owner_user_id, table_name, record_id, action, actor, reason, old_data, new_data)
  values (v_hid, v_scope, (v_row ->> 'owner_user_id')::uuid, tg_table_name, (v_row ->> 'id')::uuid, v_action,
          auth.uid(), nullif(current_setting('app.audit_reason', true), ''), v_old, v_new);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['households', 'household_members', 'income_records', 'categories', 'payment_methods',
                           'budget_allocations', 'budget_moves', 'funds', 'savings_goals', 'debts', 'bills',
                           'bill_cycles', 'transactions', 'transaction_attachments', 'reminders']
  loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I
                    for each row execute function public.audit_row()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Inmutabilidad de scope/propietario + propietario por defecto
-- ---------------------------------------------------------------------
create or replace function public.guard_scoped_row()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.scope = 'personal' and new.owner_user_id is null then
      new.owner_user_id := auth.uid();
    end if;
  else
    if new.household_id <> old.household_id or new.scope <> old.scope
       or new.owner_user_id is distinct from old.owner_user_id then
      raise exception 'CAMPO_INMUTABLE' using hint = 'No se puede cambiar el hogar, el ámbito ni el dueño de un registro.';
    end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['categories', 'funds', 'savings_goals', 'debts', 'bills', 'reminders']
  loop
    execute format('create trigger %I_guard before insert or update on public.%I
                    for each row execute function public.guard_scoped_row()', t, t);
  end loop;
end $$;

-- Validaciones de referencias en catálogos
create or replace function public.validate_catalog_refs()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name in ('funds', 'debts', 'bills') then
    perform public.assert_member_of(new.responsible_member_id, new.household_id);
  end if;
  if tg_table_name = 'bills' then
    if not exists (select 1 from public.categories c where c.id = new.category_id and c.household_id = new.household_id
                   and (c.scope = 'household' or c.owner_user_id = new.owner_user_id)) then
      raise exception 'CATEGORIA_INVALIDA';
    end if;
    if not public.valid_shares(new.household_id, new.shares) then
      raise exception 'DISTRIBUCION_INVALIDA' using hint = 'Los porcentajes deben sumar 100%.';
    end if;
  end if;
  if tg_table_name = 'savings_goals' then
    if not public.valid_commitments(new.household_id, new.commitments) then
      raise exception 'COMPROMISO_INVALIDO';
    end if;
  end if;
  if tg_table_name = 'categories' then
    if new.parent_id is not null and not exists (
       select 1 from public.categories p where p.id = new.parent_id and p.household_id = new.household_id
          and p.parent_id is null and (p.scope = 'household' or p.owner_user_id = new.owner_user_id)) then
      raise exception 'CATEGORIA_PADRE_INVALIDA' using hint = 'Solo se permite un nivel de subcategorías.';
    end if;
    if new.linked_fund_id is not null and not exists (
       select 1 from public.funds f where f.id = new.linked_fund_id and f.household_id = new.household_id
          and f.scope = new.scope and f.owner_user_id is not distinct from new.owner_user_id) then
      raise exception 'FONDO_INVALIDO';
    end if;
  end if;
  return new;
end $$;

create trigger funds_refs before insert or update on public.funds for each row execute function public.validate_catalog_refs();
create trigger debts_refs before insert or update on public.debts for each row execute function public.validate_catalog_refs();
create trigger bills_refs before insert or update on public.bills for each row execute function public.validate_catalog_refs();
create trigger savings_goals_refs before insert or update on public.savings_goals for each row execute function public.validate_catalog_refs();
create trigger categories_refs before insert or update on public.categories for each row execute function public.validate_catalog_refs();

create or replace function public.validate_allocation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.budget_periods p where p.id = new.period_id and p.household_id = new.household_id) then
    raise exception 'PERIODO_INVALIDO';
  end if;
  if not exists (select 1 from public.categories c where c.id = new.category_id and c.household_id = new.household_id
                 and c.scope = 'household' and c.parent_id is null) then
    raise exception 'CATEGORIA_INVALIDA' using hint = 'Los presupuestos se asignan a categorías principales del hogar.';
  end if;
  if not public.valid_shares(new.household_id, new.shares) then
    raise exception 'DISTRIBUCION_INVALIDA' using hint = 'Los porcentajes deben sumar 100%.';
  end if;
  if tg_op = 'UPDATE' and (new.period_id <> old.period_id or new.category_id <> old.category_id or new.household_id <> old.household_id) then
    raise exception 'CAMPO_INMUTABLE';
  end if;
  return new;
end $$;
create trigger budget_allocations_validate before insert or update on public.budget_allocations
  for each row execute function public.validate_allocation();

-- ---------------------------------------------------------------------
-- Saldos derivados (fuente única: transactions)
-- VOLATILE a propósito: dentro de triggers deben ver el snapshot más reciente.
-- ---------------------------------------------------------------------
create or replace function public.fund_balance(fid uuid)
returns numeric language sql volatile security definer set search_path = '' as $$
  select f.initial_balance
       + coalesce((select sum(case when t.to_fund_id = fid then t.amount else 0 end)
                        - sum(case when t.fund_id = fid then t.amount else 0 end)
                   from public.transactions t
                   where t.status = 'posted' and (t.fund_id = fid or t.to_fund_id = fid)), 0)
  from public.funds f where f.id = fid;
$$;

create or replace function public.goal_balance(gid uuid)
returns numeric language sql volatile security definer set search_path = '' as $$
  select coalesce(sum(case when t.type = 'savings_deposit' then t.amount else -t.amount end), 0)
  from public.transactions t
  where t.status = 'posted' and t.savings_goal_id = gid;
$$;

create or replace function public.debt_balance(did uuid)
returns numeric language sql volatile security definer set search_path = '' as $$
  select d.original_amount
       + coalesce((select sum(case when t.type = 'debt_charge' then t.amount else -t.amount end)
                   from public.transactions t where t.status = 'posted' and t.debt_id = did), 0)
  from public.debts d where d.id = did;
$$;

-- ---------------------------------------------------------------------
-- Periodos de presupuesto
-- ---------------------------------------------------------------------
create or replace function public._ensure_period(hid uuid, p_year int, p_month int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_prev uuid;
begin
  select id into v_id from public.budget_periods where household_id = hid and year = p_year and month = p_month;
  if v_id is not null then return v_id; end if;

  insert into public.budget_periods (household_id, year, month)
  values (hid, p_year, p_month)
  on conflict (household_id, year, month) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.budget_periods where household_id = hid and year = p_year and month = p_month;
    return v_id;
  end if;

  -- Presupuestos recurrentes: se copian del periodo anterior más reciente.
  select id into v_prev from public.budget_periods
   where household_id = hid and (year * 12 + month) < (p_year * 12 + p_month)
   order by year desc, month desc limit 1;
  if v_prev is not null then
    insert into public.budget_allocations (household_id, period_id, category_id, amount, shares, is_recurring, created_by)
    select a.household_id, v_id, a.category_id, a.amount, a.shares, true, a.created_by
      from public.budget_allocations a
      join public.categories c on c.id = a.category_id and c.archived_at is null
     where a.period_id = v_prev and a.is_recurring;
  end if;
  return v_id;
end $$;

create or replace function public.ensure_period(hid uuid, p_year int, p_month int)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member(hid) then raise exception 'SIN_ACCESO'; end if;
  return public._ensure_period(hid, p_year, p_month);
end $$;

-- Copia (fusiona) el presupuesto del mes anterior: agrega categorías faltantes, no sobrescribe.
create or replace function public.copy_previous_budget(p_period uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare v_p record; v_prev uuid; v_n int;
begin
  select * into v_p from public.budget_periods where id = p_period;
  if v_p is null or not public.is_member(v_p.household_id) then raise exception 'SIN_ACCESO'; end if;
  select id into v_prev from public.budget_periods
   where household_id = v_p.household_id and (year * 12 + month) < (v_p.year * 12 + v_p.month)
   order by year desc, month desc limit 1;
  if v_prev is null then raise exception 'SIN_PERIODO_ANTERIOR' using hint = 'No hay un mes anterior para copiar.'; end if;
  perform set_config('app.audit_reason', 'Copia del presupuesto anterior', true);
  insert into public.budget_allocations (household_id, period_id, category_id, amount, shares, is_recurring)
  select a.household_id, p_period, a.category_id, a.amount, a.shares, a.is_recurring
    from public.budget_allocations a
    join public.categories c on c.id = a.category_id and c.archived_at is null
   where a.period_id = v_prev
  on conflict (period_id, category_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- Libro mayor: validación antes de escribir
-- ---------------------------------------------------------------------
create or replace function public.assert_ref(p_kind text, p_id uuid, p_hid uuid, p_scope public.data_scope, p_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_hid uuid; v_scope public.data_scope; v_owner uuid; v_inactive boolean;
begin
  if p_id is null then return; end if;
  if p_kind = 'fund' then
    select household_id, scope, owner_user_id, archived_at is not null into v_hid, v_scope, v_owner, v_inactive
      from public.funds where id = p_id;
  elsif p_kind = 'goal' then
    select household_id, scope, owner_user_id, status = 'archived' into v_hid, v_scope, v_owner, v_inactive
      from public.savings_goals where id = p_id;
  elsif p_kind = 'debt' then
    select household_id, scope, owner_user_id, false into v_hid, v_scope, v_owner, v_inactive
      from public.debts where id = p_id;
  elsif p_kind = 'bill_cycle' then
    select b.household_id, b.scope, b.owner_user_id, c.cancelled_at is not null into v_hid, v_scope, v_owner, v_inactive
      from public.bill_cycles c join public.bills b on b.id = c.bill_id where c.id = p_id;
  elsif p_kind = 'category' then
    select household_id, scope, owner_user_id, false into v_hid, v_scope, v_owner, v_inactive
      from public.categories where id = p_id;
    -- Un movimiento personal puede usar categorías compartidas (solo taxonomía, no datos).
    if v_hid = p_hid and v_scope = 'household' and p_scope = 'personal' then return; end if;
  end if;
  if v_hid is null then raise exception 'REFERENCIA_INEXISTENTE' using hint = p_kind; end if;
  if v_hid <> p_hid or v_scope <> p_scope or v_owner is distinct from p_owner then
    raise exception 'AMBITO_INCOMPATIBLE' using hint = 'No se pueden mezclar finanzas personales y del hogar (' || p_kind || ').';
  end if;
  if v_inactive then raise exception 'REFERENCIA_INACTIVA' using hint = p_kind; end if;
end $$;

create or replace function public.transactions_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'voided' then
      raise exception 'MOVIMIENTO_ANULADO' using hint = 'Un movimiento anulado no puede modificarse.';
    end if;
    if new.household_id <> old.household_id or new.scope <> old.scope
       or new.owner_user_id is distinct from old.owner_user_id or new.type <> old.type
       or new.created_by is distinct from old.created_by or new.created_at <> old.created_at
       or new.client_request_id is distinct from old.client_request_id
       or new.budget_move_id is distinct from old.budget_move_id then
      raise exception 'CAMPO_INMUTABLE' using hint = 'Para cambiar el tipo o el ámbito, anula y registra de nuevo.';
    end if;
    if new.status <> old.status then
      if coalesce(current_setting('app.voiding', true), '') <> 'on' then
        raise exception 'USA_ANULACION' using hint = 'Usa la operación de anulación.';
      end if;
      new.updated_by := auth.uid();
      return new;
    end if;
    if old.budget_move_id is not null and (new.amount <> old.amount or new.fund_id is distinct from old.fund_id
       or new.to_fund_id is distinct from old.to_fund_id or new.savings_goal_id is distinct from old.savings_goal_id) then
      raise exception 'CAMPO_INMUTABLE' using hint = 'Este movimiento proviene de un ajuste de presupuesto.';
    end if;
    new.updated_by := auth.uid();
  else
    if new.status <> 'posted' then raise exception 'ESTADO_INVALIDO'; end if;
    if new.scope = 'personal' and new.owner_user_id is null then new.owner_user_id := auth.uid(); end if;
    if auth.uid() is not null then new.created_by := auth.uid(); end if;
  end if;

  -- Referencias coherentes (mismo hogar, mismo ámbito, mismo dueño)
  perform public.assert_ref('fund', new.fund_id, new.household_id, new.scope, new.owner_user_id);
  perform public.assert_ref('fund', new.to_fund_id, new.household_id, new.scope, new.owner_user_id);
  perform public.assert_ref('goal', new.savings_goal_id, new.household_id, new.scope, new.owner_user_id);
  perform public.assert_ref('debt', new.debt_id, new.household_id, new.scope, new.owner_user_id);
  perform public.assert_ref('bill_cycle', new.bill_cycle_id, new.household_id, new.scope, new.owner_user_id);
  perform public.assert_ref('category', new.category_id, new.household_id, new.scope, new.owner_user_id);
  perform public.assert_member_of(new.member_id, new.household_id);
  if new.payment_method_id is not null and not exists (
     select 1 from public.payment_methods pm where pm.id = new.payment_method_id and pm.household_id = new.household_id) then
    raise exception 'METODO_PAGO_INVALIDO';
  end if;

  -- Periodo presupuestario (solo hogar). Las aportaciones pueden imputarse a otro mes (adelantos).
  if new.scope = 'household' then
    if new.type = 'contribution' and new.period_id is not null then
      if not exists (select 1 from public.budget_periods p where p.id = new.period_id and p.household_id = new.household_id) then
        raise exception 'PERIODO_INVALIDO';
      end if;
    else
      new.period_id := public._ensure_period(new.household_id,
                         extract(year from new.occurred_on)::int, extract(month from new.occurred_on)::int);
    end if;
  else
    new.period_id := null;
  end if;

  -- Bloqueo de filas afectadas para serializar operaciones concurrentes sobre el mismo saldo
  perform 1 from public.funds where id in (new.fund_id, new.to_fund_id) for update;
  perform 1 from public.savings_goals where id = new.savings_goal_id for update;
  perform 1 from public.debts where id = new.debt_id for update;
  if tg_op = 'UPDATE' then
    perform 1 from public.funds where id in (old.fund_id, old.to_fund_id) for update;
    perform 1 from public.savings_goals where id = old.savings_goal_id for update;
    perform 1 from public.debts where id = old.debt_id for update;
  end if;
  return new;
end $$;

create trigger transactions_before before insert or update on public.transactions
  for each row execute function public.transactions_before_write();

-- Verificación posterior: ningún saldo derivado puede quedar en estado imposible.
create or replace function public.transactions_check_balances()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_bal numeric; v_allow boolean := coalesce(new.allow_overpayment, false);
begin
  for v_id in
    select distinct x from unnest(array[new.fund_id, new.to_fund_id,
      case when tg_op = 'UPDATE' then old.fund_id end, case when tg_op = 'UPDATE' then old.to_fund_id end]) x
    where x is not null
  loop
    v_bal := public.fund_balance(v_id);
    if v_bal < 0 then
      raise exception 'FONDO_INSUFICIENTE' using hint = 'El fondo no tiene saldo suficiente para esta operación.';
    end if;
  end loop;

  for v_id in
    select distinct x from unnest(array[new.savings_goal_id, case when tg_op = 'UPDATE' then old.savings_goal_id end]) x
    where x is not null
  loop
    if public.goal_balance(v_id) < 0 then
      raise exception 'AHORRO_INSUFICIENTE' using hint = 'La meta no tiene saldo suficiente.';
    end if;
  end loop;

  for v_id in
    select distinct x from unnest(array[new.debt_id, case when tg_op = 'UPDATE' then old.debt_id end]) x
    where x is not null
  loop
    if public.debt_balance(v_id) < 0 and not v_allow then
      raise exception 'SOBREPAGO_DEUDA' using hint = 'El abono supera el saldo pendiente. Confirma explícitamente el sobrepago.';
    end if;
  end loop;
  return null;
end $$;

create trigger transactions_after_check after insert or update on public.transactions
  for each row execute function public.transactions_check_balances();

-- Anulación (nunca se borra un registro financiero)
create or replace function public.void_transaction(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_t public.transactions;
begin
  select * into v_t from public.transactions where id = p_id;
  if v_t.id is null or not public.can_see(v_t.household_id, v_t.scope, v_t.owner_user_id) then
    raise exception 'SIN_ACCESO';
  end if;
  if v_t.status = 'voided' then raise exception 'MOVIMIENTO_ANULADO'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'MOTIVO_REQUERIDO' using hint = 'Indica el motivo de la anulación.';
  end if;
  if v_t.budget_move_id is not null then
    raise exception 'USA_ANULACION_AJUSTE' using hint = 'Este movimiento se anula desde el ajuste de presupuesto.';
  end if;
  perform set_config('app.voiding', 'on', true);
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.transactions
     set status = 'voided', void_reason = trim(p_reason), voided_by = auth.uid(), voided_at = now()
   where id = p_id;
  perform set_config('app.voiding', '', true);
end $$;

-- ---------------------------------------------------------------------
-- Vistas derivadas (security_invoker => respetan RLS del usuario)
-- ---------------------------------------------------------------------
create view public.v_fund_balances with (security_invoker = true) as
select f.id as fund_id, f.household_id, f.scope, f.owner_user_id, f.initial_balance,
       coalesce(sum(t.amount) filter (where t.to_fund_id = f.id), 0) as inflow,
       coalesce(sum(t.amount) filter (where t.fund_id = f.id), 0) as outflow,
       f.initial_balance + coalesce(sum(t.amount) filter (where t.to_fund_id = f.id), 0)
                         - coalesce(sum(t.amount) filter (where t.fund_id = f.id), 0) as balance
from public.funds f
left join public.transactions t on t.status = 'posted' and (t.fund_id = f.id or t.to_fund_id = f.id)
group by f.id;

create view public.v_goal_balances with (security_invoker = true) as
select g.id as goal_id, g.household_id, g.scope, g.owner_user_id,
       coalesce(sum(t.amount) filter (where t.type = 'savings_deposit'), 0) as deposits,
       coalesce(sum(t.amount) filter (where t.type = 'savings_withdrawal'), 0) as withdrawals,
       coalesce(sum(t.amount) filter (where t.type = 'savings_deposit'), 0)
         - coalesce(sum(t.amount) filter (where t.type = 'savings_withdrawal'), 0) as balance,
       max(t.occurred_on) filter (where t.type = 'savings_deposit') as last_deposit_on
from public.savings_goals g
left join public.transactions t on t.status = 'posted' and t.savings_goal_id = g.id
group by g.id;

create view public.v_debt_balances with (security_invoker = true) as
select d.id as debt_id, d.household_id, d.scope, d.owner_user_id,
       coalesce(sum(t.amount) filter (where t.type = 'debt_payment'), 0) as paid,
       coalesce(sum(t.amount) filter (where t.type = 'debt_charge' and t.debt_charge_kind = 'interest'), 0) as interest_charged,
       coalesce(sum(t.amount) filter (where t.type = 'debt_charge' and t.debt_charge_kind <> 'interest'), 0) as fees_charged,
       d.original_amount
         + coalesce(sum(t.amount) filter (where t.type = 'debt_charge'), 0)
         - coalesce(sum(t.amount) filter (where t.type = 'debt_payment'), 0) as balance,
       max(t.occurred_on) filter (where t.type = 'debt_payment') as last_payment_on
from public.debts d
left join public.transactions t on t.status = 'posted' and t.debt_id = d.id
group by d.id;

create view public.v_bill_cycles with (security_invoker = true) as
select c.id, c.household_id, c.bill_id, c.original_due_date, c.due_date, c.expected_amount, c.cancelled_at, c.note,
       b.name as bill_name, b.kind as bill_kind, b.provider, b.category_id, b.scope, b.owner_user_id,
       b.responsible_member_id, b.amount_type, b.shares,
       coalesce(p.paid, 0) as paid_amount, p.last_paid_on,
       case
         when c.cancelled_at is not null then 'cancelled'
         when coalesce(p.paid, 0) > 0 and coalesce(p.paid, 0) >= c.expected_amount then 'paid'
         when c.due_date < public.today_local() then 'overdue'
         when coalesce(p.paid, 0) > 0 then 'partial'
         when c.due_date <= public.today_local() + 5 then 'due_soon'
         else 'pending'
       end as status
from public.bill_cycles c
join public.bills b on b.id = c.bill_id
left join lateral (
  select sum(t.amount) as paid, max(t.occurred_on) as last_paid_on
  from public.transactions t where t.bill_cycle_id = c.id and t.status = 'posted'
) p on true;

create view public.v_allocations with (security_invoker = true) as
select a.id, a.household_id, a.period_id, p.year, p.month, a.category_id, a.amount, a.shares, a.is_recurring, a.note,
       c.name as category_name, c.icon as category_icon, c.color as category_color, c.kind as category_kind,
       c.is_variable, c.linked_fund_id,
       coalesce(mi.total, 0) as moved_in,
       coalesce(mo.total, 0) as moved_out,
       a.amount + coalesce(mi.total, 0) - coalesce(mo.total, 0) as effective_amount,
       coalesce(sp.spent, 0) as spent,
       coalesce(sp.extraordinary, 0) as extraordinary_spent,
       coalesce(sp.tx_count, 0) as tx_count
from public.budget_allocations a
join public.budget_periods p on p.id = a.period_id
join public.categories c on c.id = a.category_id
left join lateral (select sum(m.amount) total from public.budget_moves m
                   where m.to_allocation_id = a.id and m.voided_at is null) mi on true
left join lateral (select sum(m.amount) total from public.budget_moves m
                   where m.from_allocation_id = a.id and m.voided_at is null) mo on true
left join lateral (
  select coalesce(sum(case when t.type = 'expense' and not t.is_extraordinary then t.amount
                           when t.type = 'refund' then -t.amount else 0 end), 0) as spent,
         coalesce(sum(case when t.type = 'expense' and t.is_extraordinary then t.amount else 0 end), 0) as extraordinary,
         count(*) filter (where t.type = 'expense') as tx_count
  from public.transactions t
  join public.categories tc on tc.id = t.category_id
  where t.period_id = a.period_id and t.status = 'posted' and t.scope = 'household'
    and coalesce(tc.parent_id, tc.id) = a.category_id
) sp on true;

-- Estado de cuotas de deudas (cálculo de próxima cuota)
create or replace function public.freq_interval(f text)
returns interval language sql immutable as $$
  select case f when 'weekly' then interval '7 days' when 'biweekly' then interval '14 days'
                when 'monthly' then interval '1 month' when 'bimonthly' then interval '2 months'
                when 'quarterly' then interval '3 months' when 'yearly' then interval '1 year'
                else null end;
$$;

create view public.v_debts with (security_invoker = true) as
select d.*, b.paid, b.interest_charged, b.fees_charged, b.balance, b.last_payment_on,
       case when d.installment_amount is not null then floor(b.paid / d.installment_amount)::int else null end as paid_installments,
       case
         when b.balance <= 0 then null
         when d.installment_amount is not null and d.frequency <> 'one_time'
           then (d.start_date + public.freq_interval(d.frequency) * (floor(b.paid / d.installment_amount) + 1))::date
         else d.due_date
       end as next_due_date
from public.debts d join public.v_debt_balances b on b.debt_id = d.id;

-- ---------------------------------------------------------------------
-- Ciclos de servicios
-- ---------------------------------------------------------------------
create or replace function public.bill_due_on(p_year int, p_month int, p_day int)
returns date language sql immutable as $$
  select make_date(p_year, p_month, least(p_day,
         extract(day from (make_date(p_year, p_month, 1) + interval '1 month - 1 day'))::int));
$$;

create or replace function public._next_cycle_date(p_bill public.bills, p_last date)
returns date language plpgsql immutable as $$
declare v date;
begin
  if p_last is null then
    return null;
  end if;
  if p_bill.frequency = 'weekly' then return p_last + 7; end if;
  v := (p_last + public.freq_interval(p_bill.frequency))::date;
  return public.bill_due_on(extract(year from v)::int, extract(month from v)::int, p_bill.due_day);
end $$;

-- Crea los ciclos faltantes hasta `horizon` días hacia adelante. Idempotente.
create or replace function public._ensure_bill_cycles(p_bill uuid, horizon int default 40)
returns int language plpgsql security definer set search_path = '' as $$
declare b public.bills; v_last date; v_next date; v_n int := 0; v_today date := public.today_local();
begin
  select * into b from public.bills where id = p_bill;
  if b.id is null or not b.active then return 0; end if;
  select max(original_due_date) into v_last from public.bill_cycles where bill_id = p_bill;
  if v_last is null then
    v_next := public.bill_due_on(extract(year from v_today)::int, extract(month from v_today)::int, b.due_day);
    if b.frequency = 'weekly' then v_next := v_today + ((7 + b.due_day % 7 - extract(dow from v_today)::int) % 7); end if;
  else
    v_next := public._next_cycle_date(b, v_last);
  end if;
  while v_next <= v_today + horizon and v_n < 60 loop
    insert into public.bill_cycles (household_id, bill_id, original_due_date, due_date, expected_amount)
    values (b.household_id, b.id, v_next, v_next, b.estimated_amount)
    on conflict (bill_id, original_due_date) do nothing;
    v_n := v_n + 1;
    v_next := public._next_cycle_date(b, v_next);
  end loop;
  return v_n;
end $$;

create or replace function public.ensure_bill_cycles(hid uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0;
begin
  if auth.uid() is not null and not public.is_member(hid) then raise exception 'SIN_ACCESO'; end if;
  for r in select id from public.bills where household_id = hid and active
           and (scope = 'household' or owner_user_id = auth.uid() or auth.uid() is null)
  loop
    v_n := v_n + public._ensure_bill_cycles(r.id);
  end loop;
  return v_n;
end $$;

-- Genera manualmente el siguiente ciclo aunque esté fuera del horizonte.
create or replace function public.create_next_bill_cycle(p_bill uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare b public.bills; v_last date; v_next date; v_id uuid;
begin
  select * into b from public.bills where id = p_bill;
  if b.id is null or not public.can_see(b.household_id, b.scope, b.owner_user_id) then raise exception 'SIN_ACCESO'; end if;
  select max(original_due_date) into v_last from public.bill_cycles where bill_id = p_bill;
  if v_last is null then
    perform public._ensure_bill_cycles(p_bill, 0);
    select max(original_due_date) into v_last from public.bill_cycles where bill_id = p_bill;
    if v_last is not null then
      select id into v_id from public.bill_cycles where bill_id = p_bill and original_due_date = v_last;
      return v_id;
    end if;
    v_next := public.bill_due_on(extract(year from public.today_local())::int, extract(month from public.today_local())::int, b.due_day);
  else
    v_next := public._next_cycle_date(b, v_last);
  end if;
  insert into public.bill_cycles (household_id, bill_id, original_due_date, due_date, expected_amount)
  values (b.household_id, b.id, v_next, v_next, b.estimated_amount)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.bills_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public._ensure_bill_cycles(new.id);
  return null;
end $$;
create trigger bills_cycles after insert on public.bills for each row execute function public.bills_after_insert();

create or replace function public.bill_cycles_guard()
returns trigger language plpgsql as $$
begin
  if new.bill_id <> old.bill_id or new.household_id <> old.household_id or new.original_due_date <> old.original_due_date then
    raise exception 'CAMPO_INMUTABLE';
  end if;
  return new;
end $$;
create trigger bill_cycles_guard before update on public.bill_cycles for each row execute function public.bill_cycles_guard();

-- ---------------------------------------------------------------------
-- Presupuesto: ajustes explícitos y movimientos de sobrante/exceso
-- ---------------------------------------------------------------------
create or replace function public.adjust_allocation(p_allocation uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.budget_allocations;
begin
  select * into a from public.budget_allocations where id = p_allocation for update;
  if a.id is null or not public.is_member(a.household_id) then raise exception 'SIN_ACCESO'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'MONTO_INVALIDO'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then raise exception 'MOTIVO_REQUERIDO'; end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.budget_allocations set amount = p_amount where id = p_allocation;
end $$;

create or replace function public.allocation_available(p_allocation uuid)
returns numeric language sql volatile security definer set search_path = '' as $$
  select effective_amount - spent from public.v_allocations where id = p_allocation;
$$;

-- kind: reassign | rollover | to_fund | to_savings | from_fund
create or replace function public.move_budget(
  p_kind text, p_amount numeric, p_reason text,
  p_from_allocation uuid default null, p_to_allocation uuid default null,
  p_fund uuid default null, p_goal uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_hid uuid; a_from public.budget_allocations; a_to public.budget_allocations; v_period public.budget_periods;
  v_next_period uuid; v_move uuid; v_tx uuid; v_today date := public.today_local();
begin
  if p_amount is null or p_amount <= 0 then raise exception 'MONTO_INVALIDO'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then raise exception 'MOTIVO_REQUERIDO'; end if;

  if p_from_allocation is not null then
    select * into a_from from public.budget_allocations where id = p_from_allocation for update;
    if a_from.id is null then raise exception 'REFERENCIA_INEXISTENTE'; end if;
    v_hid := a_from.household_id;
  end if;
  if p_to_allocation is not null then
    select * into a_to from public.budget_allocations where id = p_to_allocation for update;
    if a_to.id is null then raise exception 'REFERENCIA_INEXISTENTE'; end if;
    if v_hid is not null and a_to.household_id <> v_hid then raise exception 'AMBITO_INCOMPATIBLE'; end if;
    v_hid := coalesce(v_hid, a_to.household_id);
  end if;
  if v_hid is null or not public.is_member(v_hid) then raise exception 'SIN_ACCESO'; end if;

  -- Solo se puede mover dinero disponible (sobrante real).
  if p_kind in ('reassign', 'rollover', 'to_fund', 'to_savings') then
    if p_from_allocation is null then raise exception 'ORIGEN_REQUERIDO'; end if;
    if public.allocation_available(p_from_allocation) < p_amount then
      raise exception 'SOBRANTE_INSUFICIENTE' using hint = 'Solo puedes mover el dinero disponible de la categoría.';
    end if;
  end if;

  if p_kind = 'reassign' then
    if a_to.id is null or a_to.period_id <> a_from.period_id then raise exception 'DESTINO_INVALIDO'; end if;
  elsif p_kind = 'rollover' then
    select * into v_period from public.budget_periods where id = a_from.period_id;
    v_next_period := public._ensure_period(v_hid,
       extract(year from make_date(v_period.year, v_period.month, 1) + interval '1 month')::int,
       extract(month from make_date(v_period.year, v_period.month, 1) + interval '1 month')::int);
    select * into a_to from public.budget_allocations where period_id = v_next_period and category_id = a_from.category_id;
    if a_to.id is null then
      insert into public.budget_allocations (household_id, period_id, category_id, amount, shares, is_recurring)
      values (v_hid, v_next_period, a_from.category_id, 0, a_from.shares, false)
      returning * into a_to;
    end if;
  elsif p_kind = 'to_fund' then
    if p_fund is null then raise exception 'DESTINO_INVALIDO'; end if;
    perform public.assert_ref('fund', p_fund, v_hid, 'household', null);
  elsif p_kind = 'to_savings' then
    if p_goal is null then raise exception 'DESTINO_INVALIDO'; end if;
    perform public.assert_ref('goal', p_goal, v_hid, 'household', null);
  elsif p_kind = 'from_fund' then
    if a_to.id is null or p_fund is null then raise exception 'DESTINO_INVALIDO'; end if;
    perform public.assert_ref('fund', p_fund, v_hid, 'household', null);
  else
    raise exception 'TIPO_INVALIDO';
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);
  insert into public.budget_moves (household_id, kind, amount, from_allocation_id, to_allocation_id, fund_id, savings_goal_id, reason)
  values (v_hid, p_kind, p_amount, p_from_allocation, a_to.id, p_fund, p_goal, trim(p_reason))
  returning id into v_move;

  -- Reflejo en el libro mayor cuando hay dinero entrando/saliendo de fondos o ahorros (no son gastos).
  if p_kind = 'to_fund' then
    insert into public.transactions (household_id, scope, type, amount, occurred_on, description, to_fund_id, budget_move_id)
    values (v_hid, 'household', 'deposit', p_amount, v_today, 'Sobrante de presupuesto', p_fund, v_move)
    returning id into v_tx;
  elsif p_kind = 'to_savings' then
    insert into public.transactions (household_id, scope, type, amount, occurred_on, description, savings_goal_id, budget_move_id)
    values (v_hid, 'household', 'savings_deposit', p_amount, v_today, 'Sobrante de presupuesto a ahorro', p_goal, v_move)
    returning id into v_tx;
  elsif p_kind = 'from_fund' then
    insert into public.transactions (household_id, scope, type, amount, occurred_on, description, fund_id, budget_move_id)
    values (v_hid, 'household', 'withdrawal', p_amount, v_today, 'Cobertura de exceso de presupuesto', p_fund, v_move)
    returning id into v_tx;
  end if;
  if v_tx is not null then
    update public.budget_moves set transaction_id = v_tx where id = v_move;
  end if;
  return v_move;
end $$;

create or replace function public.void_budget_move(p_move uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.budget_moves;
begin
  select * into m from public.budget_moves where id = p_move for update;
  if m.id is null or not public.is_member(m.household_id) then raise exception 'SIN_ACCESO'; end if;
  if m.voided_at is not null then raise exception 'MOVIMIENTO_ANULADO'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then raise exception 'MOTIVO_REQUERIDO'; end if;
  -- Revertir un movimiento entrante no puede dejar la categoría destino con disponible negativo por debajo de lo gastado
  -- (se permite: el exceso se mostrará). Revertir un traslado a fondo exige saldo en el fondo (lo valida el libro mayor).
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.budget_moves set voided_at = now(), voided_by = auth.uid() where id = p_move;
  if m.transaction_id is not null then
    perform set_config('app.voiding', 'on', true);
    update public.transactions set status = 'voided', void_reason = trim(p_reason), voided_by = auth.uid(), voided_at = now()
     where id = m.transaction_id;
    perform set_config('app.voiding', '', true);
  end if;
end $$;

create or replace function public.budget_moves_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (new.amount <> old.amount or new.kind <> old.kind
     or new.from_allocation_id is distinct from old.from_allocation_id
     or new.to_allocation_id is distinct from old.to_allocation_id) then
    raise exception 'CAMPO_INMUTABLE';
  end if;
  return new;
end $$;
create trigger budget_moves_guard before update on public.budget_moves for each row execute function public.budget_moves_guard();

-- ---------------------------------------------------------------------
-- Hogar: creación con configuración inicial, invitaciones
-- ---------------------------------------------------------------------
create or replace function public.gen_invite_code()
returns text language plpgsql volatile as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v text := ''; i int; b bytea := extensions.gen_random_bytes(8);
begin
  for i in 0..7 loop
    v := v || substr(chars, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return v;
end $$;

-- p_setup (todo editable por el usuario en el asistente; nada fijo en código):
-- { "household_name": text,
--   "members": [{"key":"me"|"partner","name":text,"income":num,"color":"#RRGGBB"}],
--   "funds": [{"key":text,"name":text,"kind":text,"icon":text,"color":text}],
--   "categories": [{"name","icon","color","amount","shares":{"me":n,"partner":n},"is_variable","kind","fund_key",
--                   "bill": {"name","kind","due_day","amount_type","provider"} | null}],
--   "savings": [{"name","kind","icon","target_amount","commitments":{"me":n,"partner":n}}],
--   "payment_methods": [{"name","kind"}] }
create or replace function public.create_household(p_setup jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_hid uuid; v_period uuid; v_today date := public.today_local();
  m jsonb; f jsonb; c jsonb; s jsonb; pm jsonb;
  v_member_ids jsonb := '{}'::jsonb; v_fund_ids jsonb := '{}'::jsonb;
  v_mid uuid; v_fid uuid; v_cid uuid; v_shares jsonb; v_commit jsonb; k text; v_has_me boolean := false; i int := 0;
begin
  if v_uid is null then raise exception 'SIN_SESION'; end if;
  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'YA_TIENES_HOGAR' using hint = 'Tu usuario ya pertenece a un hogar.';
  end if;

  insert into public.households (name, created_by)
  values (coalesce(nullif(trim(p_setup ->> 'household_name'), ''), 'Nuestro hogar'), v_uid)
  returning id into v_hid;

  for m in select * from jsonb_array_elements(coalesce(p_setup -> 'members', '[]'::jsonb)) loop
    insert into public.household_members (household_id, user_id, display_name, role, color, joined_at)
    values (v_hid,
            case when m ->> 'key' = 'me' then v_uid end,
            trim(m ->> 'name'),
            case when m ->> 'key' = 'me' then 'admin'::public.member_role else 'member'::public.member_role end,
            coalesce(m ->> 'color', '#1F2C66'),
            case when m ->> 'key' = 'me' then now() end)
    returning id into v_mid;
    if m ->> 'key' = 'me' then v_has_me := true; end if;
    v_member_ids := v_member_ids || jsonb_build_object(m ->> 'key', v_mid);
    if coalesce((m ->> 'income')::numeric, 0) > 0 then
      insert into public.income_records (household_id, member_id, amount, effective_from, note)
      values (v_hid, v_mid, (m ->> 'income')::numeric, date_trunc('month', v_today)::date, 'Configuración inicial');
    end if;
  end loop;
  if not v_has_me then raise exception 'CONFIGURACION_INVALIDA' using hint = 'Falta el miembro actual.'; end if;

  for f in select * from jsonb_array_elements(coalesce(p_setup -> 'funds', '[]'::jsonb)) loop
    insert into public.funds (household_id, scope, name, kind, icon, color)
    values (v_hid, 'household', trim(f ->> 'name'), coalesce(f ->> 'kind', 'custom'),
            coalesce(f ->> 'icon', 'wallet'), coalesce(f ->> 'color', '#1F2C66'))
    returning id into v_fid;
    v_fund_ids := v_fund_ids || jsonb_build_object(coalesce(f ->> 'key', f ->> 'name'), v_fid);
  end loop;

  for pm in select * from jsonb_array_elements(coalesce(p_setup -> 'payment_methods', '[]'::jsonb)) loop
    insert into public.payment_methods (household_id, name, kind) values (v_hid, trim(pm ->> 'name'), coalesce(pm ->> 'kind', 'other'));
  end loop;

  v_period := public._ensure_period(v_hid, extract(year from v_today)::int, extract(month from v_today)::int);

  for c in select * from jsonb_array_elements(coalesce(p_setup -> 'categories', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.categories (household_id, scope, name, icon, color, kind, is_variable, sort_order, linked_fund_id)
    values (v_hid, 'household', trim(c ->> 'name'), coalesce(c ->> 'icon', 'tag'), coalesce(c ->> 'color', '#1F2C66'),
            coalesce(c ->> 'kind', 'expense'), coalesce((c ->> 'is_variable')::boolean, true), i,
            (v_fund_ids ->> (c ->> 'fund_key'))::uuid)
    returning id into v_cid;

    v_shares := '{}'::jsonb;
    for k in select jsonb_object_keys(coalesce(c -> 'shares', '{}'::jsonb)) loop
      if v_member_ids ? k then
        v_shares := v_shares || jsonb_build_object(v_member_ids ->> k, (c -> 'shares' ->> k)::numeric);
      end if;
    end loop;

    if coalesce((c ->> 'amount')::numeric, 0) >= 0 and c ? 'amount' then
      insert into public.budget_allocations (household_id, period_id, category_id, amount, shares)
      values (v_hid, v_period, v_cid, (c ->> 'amount')::numeric, v_shares);
    end if;

    if c -> 'bill' is not null and jsonb_typeof(c -> 'bill') = 'object' then
      insert into public.bills (household_id, scope, name, provider, kind, category_id, estimated_amount, amount_type,
                                due_day, frequency, shares)
      values (v_hid, 'household', coalesce(c -> 'bill' ->> 'name', trim(c ->> 'name')), c -> 'bill' ->> 'provider',
              coalesce(c -> 'bill' ->> 'kind', 'other'), v_cid, coalesce((c ->> 'amount')::numeric, 0),
              coalesce(c -> 'bill' ->> 'amount_type', 'fixed'), coalesce((c -> 'bill' ->> 'due_day')::int, 1),
              'monthly', v_shares);
    end if;
  end loop;

  for s in select * from jsonb_array_elements(coalesce(p_setup -> 'savings', '[]'::jsonb)) loop
    v_commit := '{}'::jsonb;
    for k in select jsonb_object_keys(coalesce(s -> 'commitments', '{}'::jsonb)) loop
      if v_member_ids ? k then
        v_commit := v_commit || jsonb_build_object(v_member_ids ->> k, (s -> 'commitments' ->> k)::numeric);
      end if;
    end loop;
    insert into public.savings_goals (household_id, scope, name, kind, icon, target_amount, commitments)
    values (v_hid, 'household', trim(s ->> 'name'), coalesce(s ->> 'kind', 'general'), coalesce(s ->> 'icon', 'piggy-bank'),
            nullif((s ->> 'target_amount')::numeric, 0), v_commit);
  end loop;

  return v_hid;
end $$;

create or replace function public.create_invite(p_member uuid default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_hid uuid := public.my_household_id(); v_code text; v_try int := 0;
begin
  if v_hid is null or not public.is_admin(v_hid) then
    raise exception 'SOLO_ADMIN' using hint = 'Solo el administrador del hogar puede invitar.';
  end if;
  if p_member is not null and not exists (select 1 from public.household_members
                                          where id = p_member and household_id = v_hid and user_id is null) then
    raise exception 'MIEMBRO_INVALIDO' using hint = 'Ese miembro ya está vinculado o no existe.';
  end if;
  update public.household_invites set revoked_at = now()
   where household_id = v_hid and accepted_at is null and revoked_at is null
     and member_id is not distinct from p_member;
  loop
    v_code := public.gen_invite_code();
    begin
      insert into public.household_invites (household_id, member_id, code, created_by)
      values (v_hid, p_member, v_code, auth.uid());
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then raise; end if;
    end;
  end loop;
  return v_code;
end $$;

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
  update public.household_invites set accepted_by = v_uid, accepted_at = now() where id = inv.id;
  return inv.household_id;
end $$;

-- ---------------------------------------------------------------------
-- Notificaciones
-- ---------------------------------------------------------------------
create or replace function public.notify_users(hid uuid, s public.data_scope, owner uuid, p_kind text,
                                               p_title text, p_body text, p_data jsonb, p_dedupe text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Privacidad: lo personal solo se notifica al dueño.
  insert into public.notifications (user_id, household_id, kind, title, body, data, dedupe_key)
  select m.user_id, hid, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb), p_dedupe
    from public.household_members m
   where m.household_id = hid and m.user_id is not null
     and (s = 'household' or m.user_id = owner)
  on conflict (user_id, dedupe_key) do nothing;
end $$;

create or replace function public.fmt_money(v numeric)
returns text language sql immutable as $$
  select 'RD$' || to_char(v, 'FM999G999G999G990D00');
$$;

-- Alertas de presupuesto al registrar gastos del hogar
create or replace function public.transactions_budget_alerts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_alloc record; v_top uuid; v_before numeric; v_after numeric;
begin
  if new.scope <> 'household' or new.type <> 'expense' or new.status <> 'posted' or new.is_extraordinary then return null; end if;
  select coalesce(c.parent_id, c.id) into v_top from public.categories c where c.id = new.category_id;
  select * into v_alloc from public.v_allocations where period_id = new.period_id and category_id = v_top;
  if v_alloc.id is null then return null; end if;
  v_after := v_alloc.spent;
  v_before := v_after - new.amount;
  if v_alloc.effective_amount > 0 then
    if v_after > v_alloc.effective_amount and v_before <= v_alloc.effective_amount then
      perform public.notify_users(new.household_id, 'household', null, 'budget_exceeded',
        v_alloc.category_name || ' excedido',
        'Gastado ' || public.fmt_money(v_after) || ' de ' || public.fmt_money(v_alloc.effective_amount) ||
        '. Exceso: ' || public.fmt_money(v_after - v_alloc.effective_amount) || '.',
        jsonb_build_object('allocation_id', v_alloc.id, 'route', '/budget/' || v_alloc.id),
        'budget_exceeded:' || v_alloc.id);
    elsif v_after >= v_alloc.effective_amount * 0.85 and v_before < v_alloc.effective_amount * 0.85 then
      perform public.notify_users(new.household_id, 'household', null, 'budget_near_limit',
        v_alloc.category_name || ' cerca del límite',
        'Quedan ' || public.fmt_money(v_alloc.effective_amount - v_after) || ' disponibles este mes.',
        jsonb_build_object('allocation_id', v_alloc.id, 'route', '/budget/' || v_alloc.id),
        'budget_near:' || v_alloc.id);
    end if;
  end if;
  return null;
end $$;
create trigger transactions_budget_alerts after insert on public.transactions
  for each row execute function public.transactions_budget_alerts();

-- Recordatorios programados (lo ejecuta pg_cron a diario). Idempotente por dedupe_key.
-- Un ciclo pagado o cancelado deja de generar recordatorios automáticamente.
create or replace function public.generate_notifications(p_today date default null)
returns int language plpgsql security definer set search_path = '' as $$
declare r record; o int; v_today date := coalesce(p_today, public.today_local()); v_n int := 0; v_when text;
begin
  -- Garantiza ciclos futuros de todos los servicios activos
  perform public._ensure_bill_cycles(b.id) from public.bills b where b.active;

  for r in
    select c.*, b.reminder_offsets, b.name as bname
      from public.v_bill_cycles c join public.bills b on b.id = c.bill_id
     where c.status in ('pending', 'due_soon', 'partial', 'overdue') and b.active
  loop
    foreach o in array r.reminder_offsets loop
      if r.due_date - o = v_today then
        v_when := case when o > 1 then 'vence en ' || o || ' días'
                       when o = 1 then 'vence mañana'
                       when o = 0 then 'vence hoy'
                       else 'venció hace ' || abs(o) || case when abs(o) = 1 then ' día' else ' días' end end;
        perform public.notify_users(r.household_id, r.scope, r.owner_user_id,
          case when o < 0 then 'bill_overdue' else 'bill_due' end,
          r.bname || ' ' || v_when,
          'Pendiente: ' || public.fmt_money(greatest(r.expected_amount - r.paid_amount, 0)) ||
          ' · Fecha: ' || to_char(r.due_date, 'DD/MM/YYYY'),
          jsonb_build_object('bill_cycle_id', r.id, 'route', '/payments/' || r.bill_id),
          'bill:' || r.id || ':' || o || ':' || r.due_date);
        v_n := v_n + 1;
      end if;
    end loop;
  end loop;

  for r in select * from public.v_debts d
            where d.status = 'active' and d.balance > 0 and d.next_due_date is not null
              and d.next_due_date - v_today in (5, 1, 0, -1)
  loop
    perform public.notify_users(r.household_id, r.scope, r.owner_user_id, 'debt_due',
      'Cuota de ' || r.name || case when r.next_due_date - v_today > 0 then ' en ' || (r.next_due_date - v_today) || ' día(s)'
                                     when r.next_due_date = v_today then ' vence hoy' else ' vencida' end,
      'Saldo pendiente: ' || public.fmt_money(r.balance) ||
      coalesce(' · Cuota: ' || public.fmt_money(r.installment_amount), ''),
      jsonb_build_object('debt_id', r.id, 'route', '/debts/' || r.id),
      'debt:' || r.id || ':' || r.next_due_date || ':' || (r.next_due_date - v_today));
    v_n := v_n + 1;
  end loop;

  for r in select * from public.reminders where remind_on = v_today and done_at is null loop
    perform public.notify_users(r.household_id, r.scope, r.owner_user_id, 'reminder', r.title,
      coalesce(r.note, 'Recordatorio programado para hoy.'), jsonb_build_object('reminder_id', r.id, 'route', '/calendar'),
      'reminder:' || r.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'SIN_SESION'; end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

create or replace function public.unregister_push_token(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

-- Eliminación (lógica) de comprobantes: el que lo subió o un administrador.
create or replace function public.delete_attachment(p_id uuid, p_reason text)
returns text language plpgsql security definer set search_path = '' as $$
declare a public.transaction_attachments; t public.transactions;
begin
  select * into a from public.transaction_attachments where id = p_id for update;
  if a.id is null then raise exception 'SIN_ACCESO'; end if;
  select * into t from public.transactions where id = a.transaction_id;
  if not public.can_see(t.household_id, t.scope, t.owner_user_id) then raise exception 'SIN_ACCESO'; end if;
  if a.uploaded_by <> auth.uid() and not public.is_admin(a.household_id) then
    raise exception 'SIN_AUTORIZACION' using hint = 'Solo quien subió el comprobante o un administrador puede eliminarlo.';
  end if;
  if a.deleted_at is not null then return a.storage_path; end if;
  perform set_config('app.audit_reason', coalesce(nullif(trim(p_reason), ''), 'Eliminación de comprobante'), true);
  update public.transaction_attachments set deleted_at = now(), deleted_by = auth.uid() where id = p_id;
  return a.storage_path;
end $$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.households              enable row level security;
alter table public.household_members       enable row level security;
alter table public.household_invites       enable row level security;
alter table public.income_records          enable row level security;
alter table public.categories              enable row level security;
alter table public.payment_methods         enable row level security;
alter table public.budget_periods          enable row level security;
alter table public.budget_allocations      enable row level security;
alter table public.budget_moves            enable row level security;
alter table public.funds                   enable row level security;
alter table public.savings_goals           enable row level security;
alter table public.debts                   enable row level security;
alter table public.bills                   enable row level security;
alter table public.bill_cycles             enable row level security;
alter table public.transactions            enable row level security;
alter table public.transaction_attachments enable row level security;
alter table public.reminders               enable row level security;
alter table public.notifications           enable row level security;
alter table public.push_tokens             enable row level security;
alter table public.audit_logs              enable row level security;

-- Hogar
create policy households_select on public.households for select to authenticated using (public.is_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

create policy members_select on public.household_members for select to authenticated using (public.is_member(household_id));
create policy members_insert on public.household_members for insert to authenticated
  with check (public.is_admin(household_id) and user_id is null);
create policy members_update on public.household_members for update to authenticated
  using (public.is_admin(household_id) or user_id = auth.uid())
  with check (public.is_admin(household_id) or user_id = auth.uid());

create policy invites_select on public.household_invites for select to authenticated using (public.is_admin(household_id));
create policy invites_update on public.household_invites for update to authenticated
  using (public.is_admin(household_id)) with check (public.is_admin(household_id));

-- Configuración compartida
create policy income_select on public.income_records for select to authenticated using (public.is_member(household_id));
create policy income_insert on public.income_records for insert to authenticated with check (public.is_member(household_id));

create policy pm_select on public.payment_methods for select to authenticated using (public.is_member(household_id));
create policy pm_insert on public.payment_methods for insert to authenticated with check (public.is_member(household_id));
create policy pm_update on public.payment_methods for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy periods_select on public.budget_periods for select to authenticated using (public.is_member(household_id));
create policy periods_update on public.budget_periods for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy alloc_select on public.budget_allocations for select to authenticated using (public.is_member(household_id));
create policy alloc_insert on public.budget_allocations for insert to authenticated with check (public.is_member(household_id));
-- El monto solo cambia vía adjust_allocation (con motivo). Aquí: distribución, nota, recurrencia.
create policy alloc_update on public.budget_allocations for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy moves_select on public.budget_moves for select to authenticated using (public.is_member(household_id));

-- Tablas con ámbito personal/hogar
do $$
declare t text;
begin
  foreach t in array array['categories', 'funds', 'savings_goals', 'debts', 'bills', 'reminders']
  loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated
                      using (public.can_see(household_id, scope, owner_user_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated
                      with check (public.can_write(household_id, scope, owner_user_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated
                      using (public.can_see(household_id, scope, owner_user_id))
                      with check (public.can_write(household_id, scope, owner_user_id))', t);
  end loop;
end $$;
create policy reminders_delete on public.reminders for delete to authenticated
  using (public.can_see(household_id, scope, owner_user_id));

create policy cycles_select on public.bill_cycles for select to authenticated
  using (exists (select 1 from public.bills b where b.id = bill_id));
create policy cycles_update on public.bill_cycles for update to authenticated
  using (exists (select 1 from public.bills b where b.id = bill_id))
  with check (exists (select 1 from public.bills b where b.id = bill_id));

-- Libro mayor: sin DELETE (anulación + auditoría).
create policy tx_select on public.transactions for select to authenticated
  using (public.can_see(household_id, scope, owner_user_id));
create policy tx_insert on public.transactions for insert to authenticated
  with check (public.can_write(household_id, scope, owner_user_id) and budget_move_id is null);
create policy tx_update on public.transactions for update to authenticated
  using (public.can_see(household_id, scope, owner_user_id))
  with check (public.can_write(household_id, scope, owner_user_id));

create policy att_select on public.transaction_attachments for select to authenticated
  using (deleted_at is null and exists (select 1 from public.transactions t where t.id = transaction_id));
create policy att_insert on public.transaction_attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and exists (
    select 1 from public.transactions t where t.id = transaction_id and t.household_id = household_id and t.status = 'posted'));
create policy att_update on public.transaction_attachments for update to authenticated
  using (uploaded_by = auth.uid() and deleted_at is null)
  with check (uploaded_by = auth.uid() and deleted_at is null);

create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_select on public.push_tokens for select to authenticated using (user_id = auth.uid());

create policy audit_select on public.audit_logs for select to authenticated
  using (public.can_see(household_id, scope, owner_user_id));

-- Permisos: revocar lo que no corresponde a clientes
revoke all on all tables in schema public from anon;
revoke delete on all tables in schema public from authenticated;
grant delete on public.reminders to authenticated;
revoke execute on all functions in schema public from anon, public;
grant execute on function
  public.is_member(uuid), public.is_admin(uuid), public.my_household_id(), public.my_member_id(uuid),
  public.can_see(uuid, public.data_scope, uuid), public.can_write(uuid, public.data_scope, uuid),
  public.today_local(), public.ensure_period(uuid, int, int), public.copy_previous_budget(uuid),
  public.void_transaction(uuid, text), public.ensure_bill_cycles(uuid), public.create_next_bill_cycle(uuid),
  public.adjust_allocation(uuid, numeric, text),
  public.move_budget(text, numeric, text, uuid, uuid, uuid, uuid), public.void_budget_move(uuid, text),
  public.create_household(jsonb), public.create_invite(uuid), public.accept_invite(text, text),
  public.register_push_token(text, text), public.unregister_push_token(text), public.delete_attachment(uuid, text),
  public.freq_interval(text), public.fmt_money(numeric), public.bill_due_on(int, int, int)
  to authenticated;
-- Las funciones internas usadas por triggers/vistas se ejecutan con el rol del dueño (security definer)
-- pero deben poder invocarse durante las operaciones del usuario:
grant execute on function
  public.touch_updated_at(), public.audit_row(), public.guard_scoped_row(), public.validate_catalog_refs(),
  public.validate_allocation(), public.transactions_before_write(), public.transactions_check_balances(),
  public.transactions_budget_alerts(), public.bills_after_insert(), public.bill_cycles_guard(), public.budget_moves_guard(),
  public.valid_shares(uuid, jsonb), public.valid_commitments(uuid, jsonb), public.assert_member_of(uuid, uuid),
  public.assert_ref(text, uuid, uuid, public.data_scope, uuid), public.fund_balance(uuid), public.goal_balance(uuid),
  public.debt_balance(uuid), public._ensure_period(uuid, int, int), public._ensure_bill_cycles(uuid, int),
  public._next_cycle_date(public.bills, date), public.notify_users(uuid, public.data_scope, uuid, text, text, text, jsonb, text),
  public.allocation_available(uuid), public.gen_invite_code()
  to authenticated;
revoke execute on function public.generate_notifications(date) from authenticated;
