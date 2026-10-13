-- R8 | Doctrina–Docencia | Función aplicada en Supabase 2026-10-12.
-- Solo consulta agregada de migración Auth para SUPERADMIN.
-- Verificar estado antes de cualquier reinstalación; no reejecutar a ciegas.
CREATE OR REPLACE FUNCTION public.maestro_admin_estado_migracion()
 RETURNS TABLE(usuarios_padron bigint, identidades_auth bigint, padron_vinculado_confirmado bigint, usuarios_pendientes bigint, superadmins_confirmados bigint, correos_duplicados bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH totales AS (
 SELECT
  (SELECT count(*) FROM public.usuarios)::bigint AS legacy_n,
  (SELECT count(*) FROM auth.users)::bigint AS auth_n,
  (SELECT count(*) FROM public.usuarios p WHERE EXISTS(
    SELECT 1 FROM auth.users a
    WHERE lower(btrim(a.email))=lower(btrim(p.email))
     AND a.email_confirmed_at IS NOT NULL
     AND a.deleted_at IS NULL
   ))::bigint AS linked_n,
  (SELECT count(*) FROM doctrina.superadmins s JOIN auth.users a
    ON a.id=s.auth_user_id
   WHERE s.activo IS TRUE AND a.email_confirmed_at IS NOT NULL AND a.deleted_at IS NULL)::bigint AS admins_n,
  (SELECT count(*) FROM (
    SELECT lower(btrim(email)) correo
    FROM public.usuarios
    GROUP BY lower(btrim(email)) HAVING count(*)>1
   ) d)::bigint AS duplicate_n
)
SELECT t.legacy_n,t.auth_n,t.linked_n,(t.legacy_n-t.linked_n)::bigint,t.admins_n,t.duplicate_n
FROM totales t
WHERE EXISTS(
 SELECT 1 FROM public.maestro_identidad_actual() i
 WHERE i.auth_user_id=(SELECT auth.uid()) AND i.rol='SUPERADMIN'
)
$function$
;
REVOKE ALL ON FUNCTION public.maestro_admin_estado_migracion() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_admin_estado_migracion() TO authenticated;
-- Verificación de permisos sin cambios de datos:
SELECT has_function_privilege('anon','public.maestro_admin_estado_migracion()'::regprocedure,'EXECUTE') AS anon,
has_function_privilege('authenticated','public.maestro_admin_estado_migracion()'::regprocedure,'EXECUTE') AS authenticated;
