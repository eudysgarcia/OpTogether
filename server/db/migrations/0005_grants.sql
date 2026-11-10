-- =====================================================================
-- OpTogether · Privilegios explícitos (PostgreSQL puro no concede nada por defecto)
-- Las filas visibles las decide RLS; aquí solo se habilitan las operaciones permitidas.
-- =====================================================================

-- Usuarios autenticados: leer, crear y modificar. Nunca DELETE de datos financieros.
grant select, insert, update on all tables in schema public to authenticated;
revoke insert, update on public.audit_logs from authenticated;          -- solo la escribe el sistema
revoke insert, update on public.budget_moves from authenticated;        -- solo vía move_budget / void_budget_move
revoke insert, update on public.push_tokens from authenticated;         -- solo vía register_push_token
revoke insert on public.notifications from authenticated;               -- solo el sistema notifica
revoke insert on public.households, public.household_invites from authenticated; -- solo vía RPC
grant delete on public.reminders to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Anónimos: nada.
revoke all on all tables in schema public from anon;

-- API: envío de push (lee notificaciones y tokens; limpia tokens inválidos).
grant select on public.notifications, public.push_tokens to api_service;
grant delete on public.push_tokens to api_service;

-- PostgREST recarga el esquema tras cada migración.
notify pgrst, 'reload schema';
