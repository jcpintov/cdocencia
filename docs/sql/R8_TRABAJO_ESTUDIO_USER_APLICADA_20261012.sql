-- R8 Doctrina–Docencia: copia del estado ACTUAL aplicado en Supabase.
-- Fecha: 2026-10-12 · Proyecto: pwnnpjygnviyzyyvfxnq
-- No volver a aplicar automáticamente. Antes de ejecutar comparar definiciones
-- y probar permisos en una base de laboratorio separada.
-- La consulta deja FUERA las claves de respuesta, retroalimentación, archivos PDF.
CREATE OR REPLACE FUNCTION public.maestro_trabajo_estudio(p_modulo_id uuid)
 RETURNS TABLE(modulo_id uuid, numero_orden integer, titulo text, autor text, contenido_trazado text, preguntas jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
SELECT m.id,m.numero_orden,m.titulo::text,coalesce(m.autor,'')::text,m.contenido_trazado,
  COALESCE((
    SELECT jsonb_agg(
       jsonb_build_object(
         'numero', pregunta.item->'numero',
         'enunciado', pregunta.item->'enunciado',
         'opciones', COALESCE((
           SELECT jsonb_agg(
             jsonb_build_object('letra',op.elem->>'letra','texto',op.elem->>'texto')
             ORDER BY op.ord
           )
           FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(pregunta.item->'opciones')='array'
                  THEN pregunta.item->'opciones' ELSE '[]'::jsonb END
           ) WITH ORDINALITY op(elem,ord)
         ),'[]'::jsonb)
       ) ORDER BY pregunta.ord
    )
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(m.preguntas_json->'preguntas')='array'
           THEN m.preguntas_json->'preguntas' ELSE '[]'::jsonb END
    ) WITH ORDINALITY pregunta(item,ord)
  ),'[]'::jsonb)
FROM public.modulos m
WHERE m.id=p_modulo_id AND m.activo IS TRUE
 AND EXISTS (
  SELECT 1 FROM public.maestro_identidad_actual() a
  WHERE a.auth_user_id=(SELECT auth.uid()) AND a.rol='USER'
 )
LIMIT 1
$function$
;
REVOKE ALL ON FUNCTION public.maestro_trabajo_estudio(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_trabajo_estudio(uuid) TO authenticated;

-- Comprobaciones de solo lectura después del corte:
SELECT has_function_privilege('anon','public.maestro_trabajo_estudio(uuid)'::regprocedure,'EXECUTE') AS anon,
has_function_privilege('authenticated','public.maestro_trabajo_estudio(uuid)'::regprocedure,'EXECUTE') AS authenticated;

-- No revocar permisos legacy de public.modulos con este archivo: hay usuarios
-- sin migrar a Auth que requieren continuidad funcional.
