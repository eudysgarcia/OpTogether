-- =====================================================================
-- OpTogether · Esquema base
-- Principio contable: la tabla `transactions` es el LIBRO MAYOR único.
-- Saldos de fondos, ahorros, deudas, pagos de servicios y gasto real por
-- categoría se DERIVAN de ella mediante vistas. No existen saldos
-- almacenados que puedan contradecirse.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.member_role as enum ('admin', 'member');
create type public.data_scope as enum ('household', 'personal');

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Hogar y miembros
-- ---------------------------------------------------------------------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 80),
  currency    text not null default 'DOP' check (currency ~ '^[A-Z]{3}$'),
  timezone    text not null default 'America/Santo_Domingo',
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Un miembro puede existir antes de tener usuario (pendiente de invitación).
create table public.household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid references auth.users (id) on delete set null,
  display_name  text not null check (char_length(trim(display_name)) between 1 and 40),
  role          public.member_role not null default 'member',
  color         text not null default '#1F2C66' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  joined_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index household_members_user_uniq on public.household_members (user_id) where user_id is not null;
create index household_members_household_idx on public.household_members (household_id);

create table public.household_invites (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  member_id     uuid references public.household_members (id) on delete cascade,
  code          text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  created_by    uuid not null references auth.users (id),
  expires_at    timestamptz not null default now() + interval '7 days',
  accepted_by   uuid references auth.users (id),
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index household_invites_household_idx on public.household_invites (household_id);

-- Historial de ingresos mensuales esperados por miembro (configuración compartida).
create table public.income_records (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  member_id       uuid not null references public.household_members (id) on delete cascade,
  amount          numeric(14,2) not null check (amount >= 0),
  effective_from  date not null,
  note            text,
  created_by      uuid default auth.uid() references auth.users (id),
  created_at      timestamptz not null default now(),
  unique (member_id, effective_from)
);

-- ---------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------
create table public.categories (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  scope             public.data_scope not null default 'household',
  owner_user_id     uuid references auth.users (id) on delete cascade,
  parent_id         uuid references public.categories (id) on delete restrict,
  name              text not null check (char_length(trim(name)) between 1 and 50),
  icon              text not null default 'tag',
  color             text not null default '#1F2C66' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  kind              text not null default 'expense' check (kind in ('expense', 'income', 'fund')),
  is_variable       boolean not null default true,
  is_extraordinary  boolean not null default false,
  sort_order        int not null default 0,
  archived_at       timestamptz,
  created_by        uuid default auth.uid() references auth.users (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((scope = 'personal') = (owner_user_id is not null)),
  check (parent_id is null or parent_id <> id)
);
create unique index categories_name_uniq on public.categories
  (household_id, scope, coalesce(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where archived_at is null;

create table public.payment_methods (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 1 and 40),
  kind          text not null default 'other' check (kind in ('cash', 'debit', 'credit', 'transfer', 'other')),
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (household_id, name)
);

-- ---------------------------------------------------------------------
-- Presupuesto
-- ---------------------------------------------------------------------
create table public.budget_periods (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  year          int not null check (year between 2000 and 2200),
  month         int not null check (month between 1 and 12),
  status        text not null default 'open' check (status in ('open', 'closed')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, year, month)
);

-- shares: { "<member_id>": porcentaje } — suma 100, o {} = partes iguales.
create table public.budget_allocations (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  period_id     uuid not null references public.budget_periods (id) on delete cascade,
  category_id   uuid not null references public.categories (id) on delete restrict,
  amount        numeric(14,2) not null check (amount >= 0),
  shares        jsonb not null default '{}'::jsonb check (jsonb_typeof(shares) = 'object'),
  is_recurring  boolean not null default true,
  note          text,
  created_by    uuid default auth.uid() references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (period_id, category_id)
);
create index budget_allocations_period_idx on public.budget_allocations (period_id);

-- ---------------------------------------------------------------------
-- Fondos (dinero virtual registrado) y metas de ahorro
-- ---------------------------------------------------------------------
create table public.funds (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references public.households (id) on delete cascade,
  scope                  public.data_scope not null default 'household',
  owner_user_id          uuid references auth.users (id) on delete cascade,
  name                   text not null check (char_length(trim(name)) between 1 and 50),
  kind                   text not null default 'custom'
                           check (kind in ('petty_cash', 'outings', 'common', 'emergency', 'custom', 'wallet')),
  icon                   text not null default 'wallet',
  color                  text not null default '#1F2C66' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  initial_balance        numeric(14,2) not null default 0 check (initial_balance >= 0),
  responsible_member_id  uuid references public.household_members (id) on delete set null,
  archived_at            timestamptz,
  created_by             uuid default auth.uid() references auth.users (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check ((scope = 'personal') = (owner_user_id is not null))
);
create index funds_household_idx on public.funds (household_id);

-- commitments: { "<member_id>": monto mensual comprometido }
create table public.savings_goals (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households (id) on delete cascade,
  scope               public.data_scope not null default 'household',
  owner_user_id       uuid references auth.users (id) on delete cascade,
  name                text not null check (char_length(trim(name)) between 1 and 50),
  kind                text not null default 'other'
                        check (kind in ('house', 'vehicle', 'emergency', 'travel', 'appliances', 'general', 'other')),
  icon                text not null default 'piggy-bank',
  color               text not null default '#1F2C66' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  target_amount       numeric(14,2) check (target_amount is null or target_amount > 0),
  target_date         date,
  commitments         jsonb not null default '{}'::jsonb check (jsonb_typeof(commitments) = 'object'),
  status              text not null default 'active' check (status in ('active', 'completed', 'archived')),
  completed_at        timestamptz,
  created_by          uuid default auth.uid() references auth.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check ((scope = 'personal') = (owner_user_id is not null))
);
create index savings_goals_household_idx on public.savings_goals (household_id);

-- ---------------------------------------------------------------------
-- Deudas
-- ---------------------------------------------------------------------
create table public.debts (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references public.households (id) on delete cascade,
  scope                  public.data_scope not null default 'household',
  owner_user_id          uuid references auth.users (id) on delete cascade,
  name                   text not null check (char_length(trim(name)) between 1 and 60),
  creditor               text,
  kind                   text not null default 'other'
                           check (kind in ('loan', 'card', 'financing', 'credit_purchase', 'borrowed', 'family', 'other')),
  original_amount        numeric(14,2) not null check (original_amount > 0),
  interest_rate          numeric(7,4) check (interest_rate is null or interest_rate between 0 and 1000), -- % anual, opcional
  start_date             date not null,
  due_date               date,
  installment_amount     numeric(14,2) check (installment_amount is null or installment_amount > 0),
  frequency              text not null default 'monthly'
                           check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'one_time')),
  installments_count     int check (installments_count is null or installments_count > 0),
  responsible_member_id  uuid references public.household_members (id) on delete set null,
  notes                  text,
  status                 text not null default 'active' check (status in ('active', 'archived')),
  created_by             uuid default auth.uid() references auth.users (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check ((scope = 'personal') = (owner_user_id is not null)),
  check (due_date is null or due_date >= start_date)
);
create index debts_household_idx on public.debts (household_id);

-- ---------------------------------------------------------------------
-- Servicios y ciclos de pago
-- ---------------------------------------------------------------------
create table public.bills (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references public.households (id) on delete cascade,
  scope                  public.data_scope not null default 'household',
  owner_user_id          uuid references auth.users (id) on delete cascade,
  name                   text not null check (char_length(trim(name)) between 1 and 50),
  provider               text,
  kind                   text not null default 'other'
                           check (kind in ('rent', 'internet', 'electricity', 'gas', 'water', 'phone', 'subscription', 'other')),
  category_id            uuid not null references public.categories (id) on delete restrict,
  estimated_amount       numeric(14,2) not null check (estimated_amount >= 0),
  amount_type            text not null default 'fixed' check (amount_type in ('fixed', 'variable')),
  due_day                int not null check (due_day between 1 and 31),
  frequency              text not null default 'monthly'
                           check (frequency in ('weekly', 'monthly', 'bimonthly', 'quarterly', 'yearly')),
  responsible_member_id  uuid references public.household_members (id) on delete set null,
  shares                 jsonb not null default '{}'::jsonb check (jsonb_typeof(shares) = 'object'),
  reminder_offsets       int[] not null default '{10,5,1,0,-1}',
  active                 boolean not null default true,
  created_by             uuid default auth.uid() references auth.users (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check ((scope = 'personal') = (owner_user_id is not null))
);
create index bills_household_idx on public.bills (household_id);

create table public.bill_cycles (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households (id) on delete cascade,
  bill_id            uuid not null references public.bills (id) on delete cascade,
  original_due_date  date not null,
  due_date           date not null,
  expected_amount    numeric(14,2) not null check (expected_amount >= 0),
  cancelled_at       timestamptz,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (bill_id, original_due_date)
);
create index bill_cycles_due_idx on public.bill_cycles (household_id, due_date);

-- ---------------------------------------------------------------------
-- LIBRO MAYOR
-- ---------------------------------------------------------------------
-- Semántica de tipos (amount siempre positivo):
--  expense            gasto real. Consume presupuesto. Sale de fund_id si se indica.
--  refund             reembolso de un gasto. Resta al gasto real. Entra a to_fund_id si se indica.
--  income             ingreso. Entra a to_fund_id si se indica.
--  contribution       aportación de un miembro al hogar (NO es gasto). Entra a to_fund_id si se indica.
--  transfer           fondo -> fondo (NO es gasto).
--  deposit            entrada externa a un fondo (reposición).
--  withdrawal         salida de un fondo que no es gasto (devolución, ajuste).
--  savings_deposit    aporte a meta de ahorro (NO es gasto). Sale de fund_id si se indica.
--  savings_withdrawal retiro de meta de ahorro. Entra a to_fund_id si se indica.
--  debt_payment       abono a deuda: reduce saldo. Sale de fund_id si se indica.
--  debt_charge        interés/recargo: aumenta saldo de deuda. No mueve dinero.
create table public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households (id) on delete cascade,
  scope              public.data_scope not null default 'household',
  owner_user_id      uuid references auth.users (id) on delete cascade,
  type               text not null check (type in (
                        'expense', 'refund', 'income', 'contribution', 'transfer', 'deposit', 'withdrawal',
                        'savings_deposit', 'savings_withdrawal', 'debt_payment', 'debt_charge')),
  amount             numeric(14,2) not null check (amount > 0 and amount < 1000000000),
  occurred_on        date not null default current_date,
  period_id          uuid references public.budget_periods (id) on delete restrict,
  category_id        uuid references public.categories (id) on delete restrict,
  description        text not null check (char_length(trim(description)) between 1 and 120),
  notes              text check (notes is null or char_length(notes) <= 1000),
  member_id          uuid references public.household_members (id) on delete set null,
  fund_id            uuid references public.funds (id) on delete restrict,
  to_fund_id         uuid references public.funds (id) on delete restrict,
  savings_goal_id    uuid references public.savings_goals (id) on delete restrict,
  debt_id            uuid references public.debts (id) on delete restrict,
  bill_cycle_id      uuid references public.bill_cycles (id) on delete restrict,
  payment_method_id  uuid references public.payment_methods (id) on delete set null,
  debt_charge_kind   text check (debt_charge_kind in ('interest', 'fee', 'other')),
  is_extraordinary   boolean not null default false,
  allow_overpayment  boolean not null default false,
  budget_move_id     uuid,
  status             text not null default 'posted' check (status in ('posted', 'voided')),
  void_reason        text,
  voided_by          uuid references auth.users (id),
  voided_at          timestamptz,
  client_request_id  uuid unique,
  created_by         uuid default auth.uid() references auth.users (id),
  created_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id),
  updated_at         timestamptz not null default now(),

  check ((scope = 'personal') = (owner_user_id is not null)),
  check (fund_id is null or to_fund_id is null or fund_id <> to_fund_id),
  check (status <> 'voided' or (void_reason is not null and voided_at is not null)),
  -- Reglas por tipo
  check (type <> 'expense'            or (category_id is not null and to_fund_id is null and savings_goal_id is null and debt_id is null)),
  check (type <> 'refund'             or (category_id is not null and fund_id is null and bill_cycle_id is null)),
  check (type <> 'income'             or (fund_id is null and savings_goal_id is null and debt_id is null and bill_cycle_id is null)),
  check (type <> 'contribution'       or (scope = 'household' and member_id is not null and fund_id is null and debt_id is null and bill_cycle_id is null)),
  check (type <> 'transfer'           or (fund_id is not null and to_fund_id is not null)),
  check (type <> 'deposit'            or (to_fund_id is not null and fund_id is null)),
  check (type <> 'withdrawal'         or (fund_id is not null and to_fund_id is null)),
  check (type <> 'savings_deposit'    or (savings_goal_id is not null and to_fund_id is null)),
  check (type <> 'savings_withdrawal' or (savings_goal_id is not null and fund_id is null)),
  check (type <> 'debt_payment'       or (debt_id is not null and to_fund_id is null)),
  check (type <> 'debt_charge'        or (debt_id is not null and fund_id is null and to_fund_id is null and debt_charge_kind is not null)),
  check (bill_cycle_id is null or type = 'expense'),
  check (category_id is null or type in ('expense', 'refund', 'income'))
);
create index transactions_household_date_idx on public.transactions (household_id, occurred_on desc);
create index transactions_period_idx on public.transactions (period_id) where status = 'posted';
create index transactions_category_idx on public.transactions (category_id) where status = 'posted';
create index transactions_fund_idx on public.transactions (fund_id) where fund_id is not null;
create index transactions_to_fund_idx on public.transactions (to_fund_id) where to_fund_id is not null;
create index transactions_goal_idx on public.transactions (savings_goal_id) where savings_goal_id is not null;
create index transactions_debt_idx on public.transactions (debt_id) where debt_id is not null;
create index transactions_bill_cycle_idx on public.transactions (bill_cycle_id) where bill_cycle_id is not null;
create index transactions_owner_idx on public.transactions (owner_user_id) where owner_user_id is not null;
create index transactions_search_idx on public.transactions using gin (to_tsvector('spanish', description || ' ' || coalesce(notes, '')));

-- Movimientos de presupuesto: reasignaciones, sobrantes y coberturas de excesos.
create table public.budget_moves (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households (id) on delete cascade,
  kind                text not null check (kind in ('reassign', 'rollover', 'to_fund', 'to_savings', 'from_fund')),
  amount              numeric(14,2) not null check (amount > 0),
  from_allocation_id  uuid references public.budget_allocations (id) on delete restrict,
  to_allocation_id    uuid references public.budget_allocations (id) on delete restrict,
  fund_id             uuid references public.funds (id) on delete restrict,
  savings_goal_id     uuid references public.savings_goals (id) on delete restrict,
  transaction_id      uuid references public.transactions (id) on delete restrict,
  reason              text not null check (char_length(trim(reason)) between 1 and 300),
  voided_at           timestamptz,
  voided_by           uuid references auth.users (id),
  created_by          uuid default auth.uid() references auth.users (id),
  created_at          timestamptz not null default now(),
  check (kind <> 'reassign'   or (from_allocation_id is not null and to_allocation_id is not null and from_allocation_id <> to_allocation_id)),
  check (kind <> 'rollover'   or (from_allocation_id is not null and to_allocation_id is not null)),
  check (kind <> 'to_fund'    or (from_allocation_id is not null and fund_id is not null)),
  check (kind <> 'to_savings' or (from_allocation_id is not null and savings_goal_id is not null)),
  check (kind <> 'from_fund'  or (to_allocation_id is not null and fund_id is not null))
);
create index budget_moves_from_idx on public.budget_moves (from_allocation_id);
create index budget_moves_to_idx on public.budget_moves (to_allocation_id);
alter table public.transactions
  add constraint transactions_budget_move_fk foreign key (budget_move_id) references public.budget_moves (id) on delete restrict;

-- ---------------------------------------------------------------------
-- Comprobantes
-- ---------------------------------------------------------------------
create table public.transaction_attachments (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  transaction_id  uuid not null references public.transactions (id) on delete restrict,
  storage_path    text not null unique,
  file_name       text not null check (char_length(file_name) between 1 and 200),
  mime_type       text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf')),
  size_bytes      bigint not null check (size_bytes > 0 and size_bytes <= 15 * 1024 * 1024),
  description     text check (description is null or char_length(description) <= 200),
  uploaded_by     uuid not null default auth.uid() references auth.users (id),
  deleted_at      timestamptz,
  deleted_by      uuid references auth.users (id),
  created_at      timestamptz not null default now()
);
create index transaction_attachments_tx_idx on public.transaction_attachments (transaction_id);

-- ---------------------------------------------------------------------
-- Recordatorios, notificaciones, tokens push
-- ---------------------------------------------------------------------
create table public.reminders (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  scope          public.data_scope not null default 'household',
  owner_user_id  uuid references auth.users (id) on delete cascade,
  title          text not null check (char_length(trim(title)) between 1 and 80),
  note           text,
  remind_on      date not null,
  done_at        timestamptz,
  created_by     uuid default auth.uid() references auth.users (id),
  created_at     timestamptz not null default now(),
  check ((scope = 'personal') = (owner_user_id is not null))
);
create index reminders_date_idx on public.reminders (household_id, remind_on);

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  household_id  uuid references public.households (id) on delete cascade,
  kind          text not null,
  title         text not null,
  body          text not null,
  data          jsonb not null default '{}'::jsonb,
  dedupe_key    text,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_tokens (
  token       text primary key check (char_length(token) between 10 and 300),
  user_id     uuid not null references auth.users (id) on delete cascade,
  platform    text not null check (platform in ('android', 'ios', 'web')),
  updated_at  timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------
-- Auditoría
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id             bigserial primary key,
  household_id   uuid references public.households (id) on delete cascade,
  scope          public.data_scope not null default 'household',
  owner_user_id  uuid,
  table_name     text not null,
  record_id      uuid,
  action         text not null check (action in ('insert', 'update', 'void', 'delete')),
  actor          uuid,
  reason         text,
  old_data       jsonb,
  new_data       jsonb,
  created_at     timestamptz not null default now()
);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_household_idx on public.audit_logs (household_id, created_at desc);

-- updated_at
do $$
declare t text;
begin
  foreach t in array array['households', 'household_members', 'categories', 'budget_periods', 'budget_allocations',
                           'funds', 'savings_goals', 'debts', 'bills', 'bill_cycles', 'transactions']
  loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;
