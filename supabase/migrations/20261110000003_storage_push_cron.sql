-- =====================================================================
-- OpTogether · Comprobantes (Storage privado), push y tareas programadas
-- =====================================================================

-- ---------------------------------------------------------------------
-- Storage: bucket PRIVADO. Ruta: {household_id}/{transaction_id}/{archivo}
-- Acceso solo mediante URLs firmadas de corta duración.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.can_access_receipt_path(name));
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.can_access_receipt_path(name, true));
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.can_access_receipt_path(name)
         and (owner_id = auth.uid()::text
              or public.is_admin(nullif(split_part(name, '/', 1), '')::uuid)));

-- ---------------------------------------------------------------------
-- Push: cada notificación insertada se envía a los dispositivos del usuario
-- vía Expo Push API (pg_net, asíncrono). Nunca bloquea la operación.
-- ---------------------------------------------------------------------
create extension if not exists pg_net;

create or replace function public.push_on_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_msgs jsonb;
begin
  select jsonb_agg(jsonb_build_object(
           'to', p.token, 'title', new.title, 'body', new.body, 'sound', 'default',
           'channelId', 'reminders', 'priority', 'high',
           'data', new.data || jsonb_build_object('notification_id', new.id)))
    into v_msgs
    from public.push_tokens p where p.user_id = new.user_id;
  if v_msgs is null then return null; end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_msgs,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb);
  return null;
exception when others then
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
