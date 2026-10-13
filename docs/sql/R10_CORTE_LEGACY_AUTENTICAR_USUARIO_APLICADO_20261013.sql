-- R10 / 2026-10-13 / PWN... — REGISTRO DEL CORTE YA APLICADO.
-- ADVERTENCIA: el corte ya se efectuó en Supabase y fue verificado.
-- No reejecutar sin confirmar el esquema. Este archivo no concede permisos.
-- Autorización explícita recibida del titular: suspender autenticar_usuario.
--
-- Transacción original ejecutada bajo guardas de integridad:
-- 27 usuarios en padrón, 2 vinculados a Auth confirmados, 1 Superadmin,
-- y existencia de SECURITY DEFINER public.autenticar_usuario(text,text).
--
-- Cambio efectuado:
-- REVOKE EXECUTE ON FUNCTION public.autenticar_usuario(text,text)
--   FROM PUBLIC,anon,authenticated;
--
-- Conservado para recuperación controlada:
-- service_role EXECUTE = true, sin reabrir anon/authenticated.
--
-- Prueba mínima: primero ejecutar SELECT y constatar anon=false, authenticated=false.
SELECT p.oid::regprocedure::text AS firma,
 p.prosecdef AS security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role
FROM pg_proc p
WHERE p.oid='public.autenticar_usuario(text,text)'::regprocedure;

-- Control operacional:
-- El portal legacy que llama sbApp.rpc('autenticar_usuario') queda sin login.
-- No resolver restableciendo GRANT. Migrar frontend a Auth con UUID validado.
