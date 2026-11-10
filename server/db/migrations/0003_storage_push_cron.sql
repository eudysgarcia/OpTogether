-- =====================================================================
-- OpTogether · Comprobantes (Storage privado), push y tareas programadas
-- =====================================================================

-- ---------------------------------------------------------------------
-- Comprobantes: archivos en el disco del servidor, ruta {household_id}/{transaction_id}/{archivo}.
-- La API autoriza cada subida/descarga ejecutando esta función COMO el usuario (RLS incluida)
-- y entrega URLs firmadas de corta duración. Nunca hay acceso público.
-- ---------------------------------------------------------------------
create or replace function public.can_access_receipt_path(p_name text, p_require_posted boolean default false)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_parts text[] := string_to_array(p_name, '/'); v_tx public.transactions;
begin
  if array_length(v_parts, 1) <> 3 then return false; end if;
  select * into v_tx from public.transactions where id = v_parts[2]::uuid;
  if v_tx.id is null or v_tx.household_id::text <> v_parts[1] then return false; end if;
  if p_require_posted and v_tx.status <> 'posted' then return false; end if;
  return public.can_see(v_tx.household_id, v_tx.scope, v_tx.owner_user_id);
exception when others then
  return false;
end $$;
grant execute on function public.can_access_receipt_path(text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Push: cada notificación insertada se publica por NOTIFY; la API la envía a Expo Push.
-- Nunca bloquea la operación financiera.
-- ---------------------------------------------------------------------
create or replace function public.push_on_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- La API escucha este canal (LISTEN) y envía la notificación a Expo Push.
  perform pg_notify('optogether_push', new.id::text);
  return null;
end $$;

create trigger notifications_push after insert on public.notifications
  for each row execute function public.push_on_notification();

-- ---------------------------------------------------------------------
-- Tareas programadas (pg_cron). 12:00 UTC = 8:00 a. m. en República Dominicana.
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('optogether-daily-reminders', 'optogether-evening-reminders');
  perform cron.schedule('optogether-daily-reminders', '0 12 * * *', 'select public.generate_notifications()');
end $$;
