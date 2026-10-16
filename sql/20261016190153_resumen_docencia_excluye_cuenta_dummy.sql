-- Archivo documental correspondiente a migración ya aplicada por Supabase.
-- 20261016190153 resumen_docencia_excluye_cuenta_dummy_20261016
-- No ejecutar nuevamente sin revisar el estado actual.
CREATE OR REPLACE FUNCTION public.maestro_admin_resumen_docencia()
 RETURNS TABLE(usuario_id uuid, nombre text, email text, trabajos_disponibles integer, trabajos_leidos integer, trabajos_completados integer, ultima_conclusion timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT
   u.id,
   u.nombre::text,
   u.email::text,
   (SELECT count(*)::integer FROM public.modulos activos WHERE activos.activo IS TRUE),
   count(DISTINCT m.id) FILTER(WHERE p.leido IS TRUE)::integer,
   count(DISTINCT m.id) FILTER(WHERE p.completado IS TRUE)::integer,
   max(p.completado_en) FILTER(WHERE m.id IS NOT NULL)
 FROM public.usuarios u
 LEFT JOIN public.progreso_maestro p ON p.usuario_id=u.id
 LEFT JOIN public.modulos m ON m.id=p.modulo_id AND m.activo IS TRUE
 WHERE u.es_admin IS NOT TRUE
  AND lower(btrim(u.email)) <> 'dummy@ofl.cl'
  AND EXISTS(
   SELECT 1 FROM public.maestro_identidad_actual() actor
   WHERE actor.auth_user_id=(SELECT auth.uid()) AND actor.rol='SUPERADMIN'
  )
 GROUP BY u.id,u.nombre,u.email
 ORDER BY u.nombre,u.id
 LIMIT 200;
$function$
;
