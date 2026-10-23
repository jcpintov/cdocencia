-- Preparada localmente. NO aplicar hasta autorizar la publicación del conjunto.
BEGIN;
-- El nuevo RPC usa SECURITY INVOKER: habilitar solo la verificación de rol para el servidor.
GRANT USAGE ON SCHEMA doctrina TO service_role;
GRANT EXECUTE ON FUNCTION doctrina.rol_verificado(uuid) TO service_role;
CREATE TABLE public.docencia_borradores (
 id uuid PRIMARY KEY,actor uuid NOT NULL REFERENCES auth.users(id),revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 estado text NOT NULL DEFAULT 'borrador' CHECK(estado IN('borrador','publicado')),
 original jsonb NOT NULL CHECK(octet_length(original::text)<=2900000),
 extraccion jsonb NOT NULL CHECK(octet_length(extraccion::text)<=1000000),
 ficha jsonb NOT NULL DEFAULT '{}',texto text NOT NULL CHECK(length(texto) BETWEEN 200 AND 60000),
 preguntas jsonb,preguntas_hash text,
 creado_en timestamptz NOT NULL DEFAULT now(),actualizado_en timestamptz NOT NULL DEFAULT now(),publicado_en timestamptz,
 CHECK((preguntas IS NULL AND preguntas_hash IS NULL) OR (preguntas_hash IS NOT NULL AND jsonb_typeof(preguntas->'preguntas') IS NOT DISTINCT FROM 'array' AND jsonb_array_length(preguntas->'preguntas')=8 AND preguntas_hash ~ '^[0-9a-f]{64}$'))
);
CREATE INDEX docencia_borradores_actor ON public.docencia_borradores(actor,actualizado_en DESC);
CREATE TABLE public.docencia_borradores_historial (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,borrador_id uuid NOT NULL REFERENCES public.docencia_borradores(id),actor uuid NOT NULL REFERENCES auth.users(id),accion text NOT NULL,revision integer NOT NULL,creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.docencia_borradores_ia (
 id uuid PRIMARY KEY,borrador_id uuid NOT NULL REFERENCES public.docencia_borradores(id),actor uuid NOT NULL REFERENCES auth.users(id),revision integer NOT NULL,estado text NOT NULL DEFAULT 'reservado' CHECK(estado IN('reservado','completado','fallido')),creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX docencia_borradores_ia_actor ON public.docencia_borradores_ia(actor,creado_en DESC);
ALTER TABLE public.docencia_borradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docencia_borradores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.docencia_borradores_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docencia_borradores_historial FORCE ROW LEVEL SECURITY;
ALTER TABLE public.docencia_borradores_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docencia_borradores_ia FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.docencia_borradores,public.docencia_borradores_historial,public.docencia_borradores_ia FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.docencia_borradores,public.docencia_borradores_ia TO service_role;
GRANT SELECT,INSERT ON public.docencia_borradores_historial TO service_role;
GRANT USAGE ON SEQUENCE public.docencia_borradores_historial_id_seq TO service_role;
CREATE FUNCTION public.admin_borradores_docentes(p_actor uuid,p_accion text,p_datos jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE b public.docencia_borradores;v_id uuid;v_intento uuid;f jsonb;v_preguntas jsonb;n integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR coalesce(doctrina.rol_verificado(p_actor) IN('ADMIN','SUPERADMIN'),false) IS NOT TRUE THEN RAISE EXCEPTION 'Administración docente requerida' USING ERRCODE='42501';END IF;
 IF p_accion='listar' THEN RETURN jsonb_build_object('borradores',coalesce((SELECT jsonb_agg(x ORDER BY x.actualizado_en DESC) FROM (SELECT id,revision,estado,ficha,actualizado_en FROM public.docencia_borradores WHERE actor=p_actor AND estado='borrador' ORDER BY actualizado_en DESC LIMIT 100) x),'[]'::jsonb));END IF;
 v_id:=(p_datos->>'id')::uuid;
 IF p_accion='crear' THEN
  IF v_id IS NULL OR jsonb_typeof(p_datos->'original') IS DISTINCT FROM 'object' OR jsonb_typeof(p_datos->'extraccion') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Original inválido' USING ERRCODE='22023';END IF;
  PERFORM pg_advisory_xact_lock(hashtext('borradores:'||p_actor::text));
  IF (SELECT count(*) FROM public.docencia_borradores WHERE actor=p_actor AND estado='borrador')>=100 THEN RAISE EXCEPTION 'Hay 100 borradores pendientes. Termine su revisión antes de cargar más' USING ERRCODE='55000';END IF;
  INSERT INTO public.docencia_borradores(id,actor,original,extraccion,texto,ficha) VALUES(v_id,p_actor,p_datos->'original',p_datos->'extraccion',p_datos->>'texto',coalesce(p_datos->'ficha','{}'));
  INSERT INTO public.docencia_borradores_historial(borrador_id,actor,accion,revision) VALUES(v_id,p_actor,'crear',1);
  RETURN jsonb_build_object('id',v_id,'revision',1);
 END IF;
 SELECT * INTO b FROM public.docencia_borradores WHERE id=v_id AND actor=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Borrador no disponible' USING ERRCODE='P0002';END IF;
 IF p_accion='obtener' THEN RETURN to_jsonb(b);END IF;
 IF p_accion='publicar' AND b.estado='publicado' THEN RETURN jsonb_build_object('id',b.id,'publicado',true,'repetido',true);END IF;
 IF b.estado<>'borrador' THEN RAISE EXCEPTION 'El trabajo ya fue publicado' USING ERRCODE='55000';END IF;
 IF (p_datos->>'revision')::integer IS DISTINCT FROM b.revision THEN RAISE EXCEPTION 'El borrador cambió. Actualice antes de continuar' USING ERRCODE='40001';END IF;
 IF p_accion='guardar' THEN
  f:=p_datos->'ficha';v_preguntas:=nullif(p_datos->'preguntas','null'::jsonb);
  IF jsonb_typeof(f) IS DISTINCT FROM 'object' OR length(btrim(f->>'titulo')) NOT BETWEEN 2 AND 250 OR length(btrim(f->>'autor')) NOT BETWEEN 2 AND 250 OR (f->>'numero_orden')::int NOT BETWEEN 1 AND 999 OR NOT EXISTS(SELECT 1 FROM public.unidades_docencia WHERE codigo=f->>'codigo' AND activo AND codigo ~ '^(INCI|INST|FILO|ETIC)[0-9]{2}[0-9A-Z][A-Z1-9]$') THEN RAISE EXCEPTION 'Revise título, autor, orden y tema activo' USING ERRCODE='22023';END IF;
  IF f->>'titulo' IS NULL OR f->>'autor' IS NULL OR f->>'numero_orden' IS NULL OR jsonb_typeof(p_datos->'texto') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Ficha incompleta' USING ERRCODE='22023';END IF;
  -- Cambiar el texto invalida las preguntas previas, incluso si el cliente intenta reenviarlas.
  IF b.texto IS DISTINCT FROM p_datos->>'texto' THEN v_preguntas:=NULL;END IF;
  UPDATE public.docencia_borradores SET ficha=f,texto=p_datos->>'texto',preguntas=v_preguntas,preguntas_hash=CASE WHEN v_preguntas IS NOT NULL THEN p_datos->>'preguntas_hash' END,revision=revision+1,actualizado_en=clock_timestamp() WHERE id=b.id RETURNING * INTO b;
 ELSIF p_accion='reservar_ia' THEN
  IF p_datos->'confirmado' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Autorice el envío del texto a Groq' USING ERRCODE='22023';END IF;
  PERFORM pg_advisory_xact_lock(hashtext('borradores-ia:'||p_actor::text));
  IF (SELECT count(*) FROM public.docencia_borradores_ia WHERE actor=p_actor AND creado_en>now()-interval '1 hour')>=10 OR (SELECT count(*) FROM public.docencia_borradores_ia WHERE actor=p_actor AND creado_en>now()-interval '1 day')>=30 THEN RAISE EXCEPTION 'Límite de generación alcanzado. El borrador se conserva' USING ERRCODE='55000';END IF;
  IF EXISTS(SELECT 1 FROM public.docencia_borradores_ia WHERE borrador_id=b.id AND estado='reservado' AND creado_en>now()-interval '2 minutes') THEN RAISE EXCEPTION 'Hay una generación en curso. Espere y actualice' USING ERRCODE='55000';END IF;
  v_intento:=(p_datos->>'intento')::uuid;
  INSERT INTO public.docencia_borradores_ia(id,borrador_id,actor,revision) VALUES(v_intento,b.id,p_actor,b.revision);
  RETURN jsonb_build_object('reservado',true);
 ELSIF p_accion='finalizar_ia' THEN
  v_intento:=(p_datos->>'intento')::uuid;
  UPDATE public.docencia_borradores_ia SET estado=CASE WHEN p_datos->'preguntas' IS NULL OR p_datos->'preguntas'='null'::jsonb THEN 'fallido' ELSE 'completado' END WHERE id=v_intento AND actor=p_actor AND borrador_id=b.id AND revision=b.revision AND estado='reservado';
  IF NOT FOUND THEN RAISE EXCEPTION 'La generación no está disponible' USING ERRCODE='40001';END IF;
  IF p_datos->'preguntas' IS NULL OR p_datos->'preguntas'='null'::jsonb THEN RETURN jsonb_build_object('guardado',false);END IF;
  UPDATE public.docencia_borradores SET preguntas=p_datos->'preguntas',preguntas_hash=p_datos->>'preguntas_hash',revision=revision+1,actualizado_en=clock_timestamp() WHERE id=b.id RETURNING * INTO b;
 ELSIF p_accion='publicar' THEN
  IF p_datos->'confirmado' IS DISTINCT FROM 'true'::jsonb OR b.preguntas IS NULL THEN RAISE EXCEPTION 'Revise el texto y las ocho preguntas antes de publicar' USING ERRCODE='22023';END IF;
  PERFORM pg_advisory_xact_lock(hashtext('docencia-publicacion-orden'));
  f:=b.ficha;
  IF EXISTS(SELECT 1 FROM public.modulos WHERE numero_orden=(f->>'numero_orden')::integer) THEN RAISE EXCEPTION 'Ya existe un trabajo con ese número de orden' USING ERRCODE='23505';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.unidades_docencia WHERE codigo=f->>'codigo' AND activo) THEN RAISE EXCEPTION 'El tema ya no está activo' USING ERRCODE='22023';END IF;
  INSERT INTO public.modulos(id,numero_orden,titulo,autor,contenido_trazado,preguntas_json,archivo_pdf_base64,unidad_codigo,activo)
   VALUES(b.id,(f->>'numero_orden')::integer,f->>'titulo',f->>'autor',b.texto,b.preguntas,b.original->>'data_url',f->>'codigo',true);
  INSERT INTO public.modulos_temas(modulo_id,codigo) VALUES(b.id,f->>'codigo') ON CONFLICT DO NOTHING;
  UPDATE public.docencia_borradores SET estado='publicado',publicado_en=clock_timestamp(),actualizado_en=clock_timestamp(),revision=revision+1 WHERE id=b.id RETURNING * INTO b;
 ELSE RAISE EXCEPTION 'Acción no admitida' USING ERRCODE='22023';END IF;
 INSERT INTO public.docencia_borradores_historial(borrador_id,actor,accion,revision) VALUES(b.id,p_actor,p_accion,b.revision);
 RETURN jsonb_build_object('id',b.id,'revision',b.revision,'publicado',b.estado='publicado');
END $$;
REVOKE ALL ON FUNCTION public.admin_borradores_docentes(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_borradores_docentes(uuid,text,jsonb) TO service_role;
COMMIT;
