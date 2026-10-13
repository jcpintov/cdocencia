-- R9 DEFINICIONES YA APLICADAS EN SUPABASE / SOLO BACKUP.
-- No reejecutar sin comparar versión, UID/roles, funciones y grants.

CREATE OR REPLACE FUNCTION public.maestro_admin_trabajos_editor()
 RETURNS TABLE(id uuid, numero_orden integer, titulo text, autor text, contenido_trazado text, preguntas_json jsonb, activo boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
SELECT m.id,m.numero_orden,m.titulo::text,coalesce(m.autor,'')::text,
       m.contenido_trazado,m.preguntas_json,m.activo
FROM public.modulos m
WHERE m.activo IS TRUE
 AND EXISTS (
  SELECT 1 FROM public.maestro_identidad_actual() a
  WHERE a.auth_user_id=(SELECT auth.uid()) AND a.rol='SUPERADMIN'
 )
ORDER BY m.numero_orden,m.id
LIMIT 200
$function$
;
REVOKE ALL ON FUNCTION public.maestro_admin_trabajos_editor() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_admin_trabajos_editor() TO authenticated;

CREATE OR REPLACE FUNCTION public.maestro_registrar_ingreso_auth()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_legacy_id uuid;
 v_nombre text;
 v_email text;
BEGIN
 SELECT identidad.legacy_user_id,identidad.nombre,p.email
 INTO v_legacy_id,v_nombre,v_email
 FROM public.maestro_identidad_actual() identidad
 JOIN public.usuarios p ON p.id=identidad.legacy_user_id
 WHERE identidad.auth_user_id=(SELECT auth.uid())
  AND identidad.rol IN ('USER','SUPERADMIN')
 LIMIT 1;
 IF v_legacy_id IS NULL THEN RETURN FALSE; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('maestro_ingreso_auth'),hashtext(v_legacy_id::text));
 IF EXISTS(
   SELECT 1 FROM public.registro_accesos log
   WHERE log.usuario_id=v_legacy_id
   AND log.fecha_acceso>now()-interval '60 seconds'
 ) THEN RETURN TRUE; END IF;
 INSERT INTO public.registro_accesos(usuario_id,nombre,email,ip_origen,fecha_acceso)
 VALUES(v_legacy_id,v_nombre,v_email,NULL,now());
 RETURN TRUE;
END
$function$
;
REVOKE ALL ON FUNCTION public.maestro_registrar_ingreso_auth() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_registrar_ingreso_auth() TO authenticated;

