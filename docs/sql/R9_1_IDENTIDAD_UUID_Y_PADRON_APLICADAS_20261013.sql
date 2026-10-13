-- R9.1: SQL ACTUAL recopiado de la base de datos 2026-10-13.
-- Mantener solo como respaldo técnico. No reemplazar definiciones en producción
-- sin verificar SHA, migración y controles de roles.
-- Los dos perfiles piloto fueron vinculados mediante su UUID Auth confirmado
-- en migración r9_enlace_auth_uuid_perfiles_confirmados_fail_closed.
-- La cuenta USER restante no debe obtener acceso por simple coincidencia email.

CREATE OR REPLACE FUNCTION public.maestro_admin_estado_migracion()
 RETURNS TABLE(usuarios_padron bigint, identidades_auth bigint, padron_vinculado_confirmado bigint, usuarios_pendientes bigint, superadmins_confirmados bigint, correos_duplicados bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH totals AS (
 SELECT
  (SELECT count(*) FROM public.usuarios)::bigint legacy_n,
  (SELECT count(*) FROM auth.users)::bigint auth_n,
  (SELECT count(*) FROM public.usuarios p JOIN auth.users a ON a.id=p.auth_user_id
    WHERE a.email_confirmed_at IS NOT NULL AND a.deleted_at IS NULL
      AND lower(btrim(p.email))=lower(btrim(a.email)))::bigint linked_n,
  (SELECT count(*) FROM doctrina.superadmins s JOIN auth.users a
    ON a.id=s.auth_user_id
    WHERE s.activo IS TRUE AND a.email_confirmed_at IS NOT NULL
      AND a.deleted_at IS NULL)::bigint admins_n,
  (SELECT count(*) FROM(
    SELECT lower(btrim(email)) FROM public.usuarios
    GROUP BY lower(btrim(email)) HAVING count(*)>1) dup)::bigint duplicate_n
)
SELECT t.legacy_n,t.auth_n,t.linked_n,(t.legacy_n-t.linked_n)::bigint,t.admins_n,t.duplicate_n
FROM totals t
WHERE EXISTS(SELECT 1 FROM public.maestro_identidad_actual() actor
 WHERE actor.auth_user_id=(SELECT auth.uid()) AND actor.rol='SUPERADMIN')
$function$
;
REVOKE ALL ON FUNCTION public.maestro_admin_estado_migracion() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_admin_estado_migracion() TO authenticated;

CREATE OR REPLACE FUNCTION public.maestro_identidad_actual()
 RETURNS TABLE(auth_user_id uuid, legacy_user_id uuid, rol text, nombre text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
SELECT a.id,p.id,
       (CASE WHEN s.auth_user_id IS NOT NULL THEN 'SUPERADMIN' ELSE 'USER' END)::text,
       p.nombre::text
FROM auth.users a
JOIN public.usuarios p ON p.auth_user_id=a.id
LEFT JOIN doctrina.superadmins s ON s.auth_user_id=a.id AND s.activo IS TRUE
WHERE a.id=(SELECT auth.uid())
  AND a.email_confirmed_at IS NOT NULL
  AND a.deleted_at IS NULL
  AND (a.banned_until IS NULL OR a.banned_until<=now())
  AND lower(btrim(a.email))=lower(btrim(p.email))
  AND ((p.es_admin IS TRUE AND s.auth_user_id IS NOT NULL)
      OR (p.es_admin IS FALSE AND s.auth_user_id IS NULL))
  AND (SELECT count(*) FROM public.usuarios p2 WHERE p2.auth_user_id=a.id)=1
LIMIT 1
$function$
;
REVOKE ALL ON FUNCTION public.maestro_identidad_actual() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_identidad_actual() TO authenticated;

CREATE OR REPLACE FUNCTION public.maestro_padron_superadmin()
 RETURNS TABLE(id uuid, nombre text, email text, es_admin boolean, debe_cambiar_clave boolean, auth_vinculada boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
SELECT p.id,p.nombre::text,p.email::text,
       coalesce(p.es_admin,false),coalesce(p.debe_cambiar_clave,false),
       EXISTS(SELECT 1 FROM auth.users a
         WHERE a.id=p.auth_user_id AND a.email_confirmed_at IS NOT NULL
           AND a.deleted_at IS NULL AND lower(btrim(a.email))=lower(btrim(p.email)))
FROM public.usuarios p
WHERE EXISTS(SELECT 1 FROM public.maestro_identidad_actual() actor
  WHERE actor.auth_user_id=(SELECT auth.uid()) AND actor.rol='SUPERADMIN')
ORDER BY p.nombre,p.id LIMIT 100
$function$
;
REVOKE ALL ON FUNCTION public.maestro_padron_superadmin() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_padron_superadmin() TO authenticated;

-- Índice ya aplicado: CREATE UNIQUE INDEX IF NOT EXISTS usuarios_auth_uuid_unico_idx
-- ON public.usuarios(auth_user_id) WHERE auth_user_id IS NOT NULL;
