-- =====================================================================
-- OpTogether · Plataforma sobre PostgreSQL puro
-- Roles para PostgREST, esquema de autenticación propio y helpers.
-- La API (server/api) emite JWT firmados con JWT_SECRET; PostgREST los valida
-- y fija request.jwt.claims + el rol `authenticated` en cada petición.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  -- PostgREST se conecta con este rol y cambia a anon/authenticated según el JWT.
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
  -- La API: autenticación, comprobantes y envío de push. Puede actuar como usuario (SET ROLE authenticated).
  if not exists (select 1 from pg_roles where rolname = 'api_service') then
    create role api_service login noinherit bypassrls;
  end if;
end $$;

grant anon, authenticated to authenticator;
grant authenticated to api_service;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

revoke create on schema public from public;
grant usage on schema public to anon, authenticated, api_service;

-- ---------------------------------------------------------------------
-- Autenticación
-- ---------------------------------------------------------------------
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, api_service;

create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  encrypted_password  text not null default '',
  email_confirmed_at  timestamptz,
  last_sign_in_at     timestamptz,
  -- columnas de compatibilidad (pruebas / migraciones)
  instance_id         uuid,
  aud                 text default 'authenticated',
  role                text default 'authenticated',
  raw_app_meta_data   jsonb default '{}'::jsonb,
  raw_user_meta_data  jsonb default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index users_email_uniq on auth.users (lower(email));

create table auth.refresh_tokens (
  id           bigserial primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  replaced_by  bigint references auth.refresh_tokens (id)
);
create index refresh_tokens_user_idx on auth.refresh_tokens (user_id);

create table auth.recovery_codes (
  id          bigserial primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    int not null default 0,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index recovery_codes_user_idx on auth.recovery_codes (user_id, created_at desc);

-- Solo la API toca las tablas de autenticación (las contraseñas nunca salen por PostgREST).
grant select, insert, update, delete on auth.users, auth.refresh_tokens, auth.recovery_codes to api_service;
grant usage, select on all sequences in schema auth to api_service;

create or replace function auth.jwt()
returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create or replace function auth.role()
returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', 'anon');
$$;

grant execute on function auth.jwt(), auth.uid(), auth.role() to anon, authenticated, api_service;
