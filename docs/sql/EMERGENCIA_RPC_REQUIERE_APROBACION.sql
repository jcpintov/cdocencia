-- MITIGACIÓN DE EMERGENCIA · REQUIERE APROBACIÓN DEL TITULAR
-- NO EJECUTAR AUTOMÁTICAMENTE NI INCLUIR EN SUPABASE/MIGRATIONS.
--
-- Consecuencias conocidas: se deshabilitan las cuatro operaciones admin del
-- navegador, cambio de clave heredado y recuperación por enlace. El inicio
-- de sesión con contraseña existente sigue utilizando autenticar_usuario.
-- PLAN DE RECUPERACIÓN: sustituir por Supabase Auth / API validada en servidor.
--
-- Antes de ejecutar:
-- 1. Confirmar autorización expresa del titular y hora de corte.
-- 2. Verificar acceso Supabase Dashboard con cuenta privilegiada.
-- 3. Comunicar ventana de mantenimiento para cambios de clave/altas de usuarios.
-- 4. Conservar respaldo SQL / datos; no borrar usuarios ni hashes.
-- 5. Ejecutar en una sola transacción desde un contexto privilegiado:
--    SET LOCAL app.autorizacion_bloqueo_rpc = 'APROBADO_POR_TITULAR';
--    (el resto de las sentencias hasta COMMIT).
--
BEGIN;
DO $do$
BEGIN
 IF current_setting('app.autorizacion_bloqueo_rpc',true)
   IS DISTINCT FROM 'APROBADO_POR_TITULAR' THEN
  RAISE EXCEPTION 'NO AUTORIZADO: SQL de emergencia no ejecutado';
 END IF;
END $do$;

REVOKE ALL ON FUNCTION public.admin_crear_usuario(uuid,text,text,text,boolean)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_editar_usuario(uuid,uuid,text,text,boolean)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_eliminar_usuario(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_cambiar_clave(uuid,uuid,text,boolean)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cambiar_clave_usuario(uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.solicitar_recuperacion_clave(text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.resetear_clave_con_token(text,text)
 FROM PUBLIC,anon,authenticated;

COMMIT;

-- Comprobación posterior: ambas columnas deben ser false para las siete funciones.
SELECT p.oid::regprocedure::text firma,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_ejecuta,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS user_ejecuta
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
 'admin_crear_usuario','admin_editar_usuario','admin_eliminar_usuario',
 'admin_cambiar_clave','cambiar_clave_usuario',
 'solicitar_recuperacion_clave','resetear_clave_con_token')
ORDER BY p.proname;

-- NO rehabilitar RPC antiguas para salir de emergencia.
-- Hacer migración a Supabase Auth y ejecutar suite de permisos/funciones.
