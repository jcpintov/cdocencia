-- R7 | DOCTRINA–DOCENCIA | Definiciones vigentes recuperadas de PostgreSQL
-- Ya aplicadas y verificadas el 2026-10-12. No volver a ejecutar sin comparar migraciones.
-- SOLO funciones SQL y concesiones, NO hay datos, credenciales ni contenido del corpus.

-- public.maestro_comentarios_modulo(uuid)
CREATE OR REPLACE FUNCTION public.maestro_comentarios_modulo(p_modulo_id uuid)
 RETURNS TABLE(comentario_id uuid, progreso_id uuid, autor_nombre text, contenido text, editado boolean, creado_en timestamp with time zone, es_autor boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 WITH actor AS (
   SELECT a.legacy_user_id,a.rol
   FROM public.maestro_identidad_actual() a
   WHERE a.auth_user_id=(SELECT auth.uid())
 ), autorizado AS (
   SELECT a.legacy_user_id FROM actor a
   WHERE a.rol='SUPERADMIN' OR EXISTS (
     SELECT 1 FROM public.progreso_maestro p
     WHERE p.usuario_id=a.legacy_user_id AND p.modulo_id=p_modulo_id
       AND p.completado IS TRUE
   )
 )
 SELECT c.id,c.progreso_id,coalesce(u.nombre,'Hermano')::text,
        c.contenido,coalesce(c.editado,false),c.creado_en,
        c.usuario_id=a.legacy_user_id
 FROM public.comentarios_muro c
 JOIN public.usuarios u ON u.id=c.usuario_id
 CROSS JOIN autorizado a
 WHERE p_modulo_id IS NOT NULL AND c.modulo_id=p_modulo_id
   AND c.activo IS TRUE
   AND EXISTS(SELECT 1 FROM public.modulos m WHERE m.id=p_modulo_id AND m.activo IS TRUE)
 ORDER BY c.creado_en,c.id
 LIMIT 500
$function$
;
REVOKE ALL ON FUNCTION public.maestro_comentarios_modulo(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_comentarios_modulo(uuid) TO authenticated;

-- public.maestro_consagrar_reflexion(uuid,text)
CREATE OR REPLACE FUNCTION public.maestro_consagrar_reflexion(p_modulo_id uuid, p_reflexion text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_usuario uuid; v_texto text; v_palabras integer;
BEGIN
 SELECT a.legacy_user_id INTO v_usuario
 FROM public.maestro_identidad_actual() a
 WHERE a.auth_user_id=(SELECT auth.uid()) AND a.rol IN ('USER','SUPERADMIN');
 IF v_usuario IS NULL THEN
   RAISE EXCEPTION 'Sin identidad institucional válida' USING ERRCODE='42501';
 END IF;
 v_texto:=btrim(coalesce(p_reflexion,''));
 v_palabras:=cardinality(regexp_split_to_array(v_texto,'[[:space:]]+'));
 IF length(v_texto)>18000 OR v_palabras NOT BETWEEN 15 AND 200 THEN
   RAISE EXCEPTION 'La reflexión requiere entre 15 y 200 palabras' USING ERRCODE='22023';
 END IF;
 UPDATE public.progreso_maestro p
 SET reflexion=v_texto,leido=true,completado=true,
     completado_en=coalesce(p.completado_en,now())
 WHERE p.usuario_id=v_usuario AND p.modulo_id=p_modulo_id
   AND EXISTS(SELECT 1 FROM public.modulos m WHERE m.id=p.modulo_id AND m.activo IS TRUE)
   AND (p.completado IS TRUE OR (
     jsonb_typeof(p.respuestas_evaluacion)='object'
     AND (SELECT count(*) FROM jsonb_object_keys(p.respuestas_evaluacion))=8
   ));
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Debe registrar primero las ocho respuestas del trabajo'
     USING ERRCODE='42501';
 END IF;
 RETURN true;
END
$function$
;
REVOKE ALL ON FUNCTION public.maestro_consagrar_reflexion(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_consagrar_reflexion(uuid,text) TO authenticated;

-- public.maestro_editar_comentario_propio(uuid,text)
CREATE OR REPLACE FUNCTION public.maestro_editar_comentario_propio(p_comentario_id uuid, p_contenido text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_usuario uuid; v_texto text;
BEGIN
 SELECT a.legacy_user_id INTO v_usuario
 FROM public.maestro_identidad_actual() a
 WHERE a.auth_user_id=(SELECT auth.uid());
 IF v_usuario IS NULL THEN RAISE EXCEPTION 'Sin identidad institucional' USING ERRCODE='42501'; END IF;
 v_texto:=btrim(coalesce(p_contenido,''));
 IF length(v_texto) NOT BETWEEN 5 AND 1500 THEN
   RAISE EXCEPTION 'Longitud del comentario no admitida' USING ERRCODE='22023';
 END IF;
 UPDATE public.comentarios_muro c
 SET contenido=v_texto,editado=true,editado_en=now()
 WHERE c.id=p_comentario_id AND c.usuario_id=v_usuario
   AND c.activo IS TRUE
   AND EXISTS(SELECT 1 FROM public.modulos m WHERE m.id=c.modulo_id AND m.activo IS TRUE);
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Comentario propio activo no encontrado' USING ERRCODE='42501';
 END IF;
 RETURN true;
END
$function$
;
REVOKE ALL ON FUNCTION public.maestro_editar_comentario_propio(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_editar_comentario_propio(uuid,text) TO authenticated;

-- public.maestro_marcar_lectura(uuid)
CREATE OR REPLACE FUNCTION public.maestro_marcar_lectura(p_modulo_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_usuario uuid;
BEGIN
 SELECT a.legacy_user_id INTO v_usuario
 FROM public.maestro_identidad_actual() a
 WHERE a.auth_user_id=(SELECT auth.uid());
 IF v_usuario IS NULL THEN
   RAISE EXCEPTION 'Sesión institucional no autorizada' USING ERRCODE='42501';
 END IF;
 IF p_modulo_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.modulos m WHERE m.id=p_modulo_id AND m.activo IS TRUE
 ) THEN RAISE EXCEPTION 'Trabajo no disponible' USING ERRCODE='P0002'; END IF;
 INSERT INTO public.progreso_maestro(usuario_id,modulo_id,leido,inicio_lectura_en)
 VALUES(v_usuario,p_modulo_id,true,now())
 ON CONFLICT (usuario_id,modulo_id) DO UPDATE
 SET leido=true,inicio_lectura_en=coalesce(public.progreso_maestro.inicio_lectura_en,now());
 RETURN true;
END
$function$
;
REVOKE ALL ON FUNCTION public.maestro_marcar_lectura(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_marcar_lectura(uuid) TO authenticated;

-- public.maestro_mis_progresos()
CREATE OR REPLACE FUNCTION public.maestro_mis_progresos()
 RETURNS TABLE(progreso_id uuid, modulo_id uuid, leido boolean, completado boolean, reflexion text, respuestas_evaluacion jsonb, intentos_preguntas integer, completado_en timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT p.id,p.modulo_id,coalesce(p.leido,false),coalesce(p.completado,false),
        p.reflexion,p.respuestas_evaluacion,coalesce(p.intentos_preguntas,0),p.completado_en
 FROM public.progreso_maestro p
 JOIN public.maestro_identidad_actual() a ON p.usuario_id=a.legacy_user_id
 WHERE a.auth_user_id=(SELECT auth.uid())
 ORDER BY p.completado_en DESC NULLS LAST,p.modulo_id
 LIMIT 500
$function$
;
REVOKE ALL ON FUNCTION public.maestro_mis_progresos() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_mis_progresos() TO authenticated;

-- public.maestro_modulos_activos()
CREATE OR REPLACE FUNCTION public.maestro_modulos_activos()
 RETURNS TABLE(modulo_id uuid, numero_orden integer, titulo text, autor text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT m.id,m.numero_orden,m.titulo::text,m.autor::text
 FROM public.modulos m
 WHERE m.activo IS TRUE
   AND EXISTS(
      SELECT 1 FROM public.maestro_identidad_actual() a
      WHERE a.auth_user_id=(SELECT auth.uid())
        AND a.rol IN ('USER','SUPERADMIN')
   )
 ORDER BY m.numero_orden,m.id
 LIMIT 100
$function$
;
REVOKE ALL ON FUNCTION public.maestro_modulos_activos() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_modulos_activos() TO authenticated;

-- public.maestro_publicar_comentario(uuid,text)
CREATE OR REPLACE FUNCTION public.maestro_publicar_comentario(p_progreso_id uuid, p_contenido text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_usuario uuid; v_modulo uuid; v_id uuid; v_texto text;
BEGIN
 SELECT a.legacy_user_id INTO v_usuario
 FROM public.maestro_identidad_actual() a
 WHERE a.auth_user_id=(SELECT auth.uid());
 IF v_usuario IS NULL THEN RAISE EXCEPTION 'Sin identidad institucional' USING ERRCODE='42501'; END IF;
 v_texto:=btrim(coalesce(p_contenido,''));
 IF length(v_texto) NOT BETWEEN 5 AND 1500 THEN
   RAISE EXCEPTION 'Longitud del comentario no admitida' USING ERRCODE='22023';
 END IF;
 SELECT p.modulo_id INTO v_modulo
 FROM public.progreso_maestro p
 JOIN public.modulos m ON m.id=p.modulo_id AND m.activo IS TRUE
 WHERE p.id=p_progreso_id AND p.completado IS TRUE;
 IF v_modulo IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.progreso_maestro mi
    WHERE mi.usuario_id=v_usuario AND mi.modulo_id=v_modulo AND mi.completado IS TRUE
 ) THEN RAISE EXCEPTION 'Muro reservado a Maestros que completaron este trabajo'
  USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.comentarios_muro c
      WHERE c.usuario_id=v_usuario AND c.creado_en>now()-interval '1 minute') >= 5
 THEN RAISE EXCEPTION 'Límite temporal de comentarios alcanzado' USING ERRCODE='22023'; END IF;
 INSERT INTO public.comentarios_muro(
   progreso_id,modulo_id,usuario_id,contenido,contenido_original,
   editado,activo,ip_origen
 ) VALUES(p_progreso_id,v_modulo,v_usuario,v_texto,v_texto,false,true,NULL)
 RETURNING id INTO v_id;
 RETURN v_id;
END
$function$
;
REVOKE ALL ON FUNCTION public.maestro_publicar_comentario(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_publicar_comentario(uuid,text) TO authenticated;

-- public.maestro_registrar_evaluacion(uuid,jsonb)
CREATE OR REPLACE FUNCTION public.maestro_registrar_evaluacion(p_modulo_id uuid, p_respuestas jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_usuario uuid; v_indice integer;
BEGIN
 SELECT a.legacy_user_id INTO v_usuario
 FROM public.maestro_identidad_actual() a
 WHERE a.auth_user_id=(SELECT auth.uid()) AND a.rol IN ('USER','SUPERADMIN');
 IF v_usuario IS NULL THEN
   RAISE EXCEPTION 'Sin identidad institucional válida' USING ERRCODE='42501';
 END IF;
 IF p_modulo_id IS NULL OR p_respuestas IS NULL OR jsonb_typeof(p_respuestas)<>'object'
    OR length(p_respuestas::text)>200
    OR (SELECT count(*) FROM jsonb_object_keys(p_respuestas))<>8
    OR NOT EXISTS(
       SELECT 1 FROM public.modulos m WHERE m.id=p_modulo_id
       AND m.activo IS TRUE
       AND jsonb_typeof(m.preguntas_json->'preguntas')='array'
       AND jsonb_array_length(m.preguntas_json->'preguntas')=8
    )
 THEN RAISE EXCEPTION 'Evaluación no válida o trabajo no disponible'
   USING ERRCODE='22023'; END IF;
 FOR v_indice IN 0..7 LOOP
   IF p_respuestas->>(v_indice::text) NOT IN ('A','B','C','D')
      OR p_respuestas->>(v_indice::text) IS NULL THEN
      RAISE EXCEPTION 'Se requieren ocho respuestas A, B, C o D'
        USING ERRCODE='22023';
   END IF;
 END LOOP;
 INSERT INTO public.progreso_maestro(
   usuario_id,modulo_id,respuestas_evaluacion,intentos_preguntas,
   leido,inicio_lectura_en
 ) VALUES(v_usuario,p_modulo_id,p_respuestas,8,true,now())
 ON CONFLICT (usuario_id,modulo_id) DO UPDATE
 SET respuestas_evaluacion=p_respuestas,intentos_preguntas=8,
     leido=true,inicio_lectura_en=coalesce(public.progreso_maestro.inicio_lectura_en,now());
 RETURN true;
END
$function$
;
REVOKE ALL ON FUNCTION public.maestro_registrar_evaluacion(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_registrar_evaluacion(uuid,jsonb) TO authenticated;

-- ACL de borrado directo revocada en R7 (mantener hasta migración Auth total):
REVOKE DELETE ON public.progreso_maestro FROM PUBLIC,anon,authenticated;
REVOKE DELETE ON public.comentarios_muro FROM PUBLIC,anon,authenticated;
