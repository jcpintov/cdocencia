BEGIN;
CREATE TABLE IF NOT EXISTS doctrina.trabajos_tenida (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor uuid NOT NULL REFERENCES auth.users(id),
 path text UNIQUE NOT NULL,
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 bytes bigint NOT NULL CHECK(bytes BETWEEN 1 AND 10485760),
 datos jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 1,
 bloqueo uuid,
 bloqueado_hasta timestamptz,
 creado_en timestamptz NOT NULL DEFAULT now(),
 actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trabajos_actor_fecha ON doctrina.trabajos_tenida(actor,creado_en DESC);
CREATE TABLE IF NOT EXISTS doctrina.trabajos_historial (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 trabajo_id uuid NOT NULL REFERENCES doctrina.trabajos_tenida(id),
 actor uuid NOT NULL REFERENCES auth.users(id),
 accion text NOT NULL,
 revision integer NOT NULL,
 resultado jsonb NOT NULL DEFAULT '{}',
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trabajos_historial_actor_fecha ON doctrina.trabajos_historial(actor,creado_en DESC);
ALTER TABLE doctrina.trabajos_tenida ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctrina.trabajos_historial ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON doctrina.trabajos_tenida,doctrina.trabajos_historial FROM PUBLIC,anon,authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('trabajos-tenida-privados','trabajos-tenida-privados',false,10485760,ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT(id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trabajos_tenida_superadmin(p_actor uuid,p_accion text,p_datos jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE w doctrina.trabajos_tenida; resultado jsonb; id_bloqueo uuid;
BEGIN
 IF coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
 AND coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.usuarios u JOIN auth.users a ON a.id=u.auth_user_id
 WHERE a.id=p_actor AND u.es_admin IS TRUE AND lower(u.email)=lower(a.email)
 AND (lower(a.email)='jpintov@gmail.com' OR a.raw_app_meta_data->>'superadmin_principal'='true'))
 THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501'; END IF;
 IF p_accion='listar' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision,'ficha',datos->'ficha','creado_en',creado_en,'oratoria',datos ? 'oratoria') ORDER BY creado_en DESC),'[]') INTO resultado
  FROM (SELECT * FROM doctrina.trabajos_tenida WHERE actor=p_actor ORDER BY creado_en DESC LIMIT 100) t;
  RETURN jsonb_build_object('trabajos',resultado);
 ELSIF p_accion='registrar' THEN
  IF p_datos->>'path' !~ ('^superadmin/'||p_actor::text||'/[0-9a-f-]{36}[.](pdf|docx)$')
  OR coalesce(length(p_datos->'datos'->'ficha'->>'tema'),0) NOT BETWEEN 2 AND 250
  OR coalesce(length(p_datos->'datos'->'ficha'->>'autor'),0) NOT BETWEEN 2 AND 250
  OR coalesce(length(p_datos->'datos'->'ficha'->>'tenida'),0) NOT BETWEEN 2 AND 250
  OR coalesce(p_datos->>'sha256','') !~ '^[0-9a-f]{64}$'
  OR coalesce((p_datos->>'bytes')::bigint,0) NOT BETWEEN 1 AND 10485760
  OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='trabajos-tenida-privados' AND name=p_datos->>'path' AND (metadata->>'size')::bigint=(p_datos->>'bytes')::bigint)
  THEN RAISE EXCEPTION 'Original o ficha inválidos' USING ERRCODE='22023'; END IF;
  INSERT INTO doctrina.trabajos_tenida(actor,path,sha256,bytes,datos)
  VALUES(p_actor,p_datos->>'path',p_datos->>'sha256',(p_datos->>'bytes')::bigint,p_datos->'datos')
  ON CONFLICT(path) DO UPDATE SET path=excluded.path RETURNING * INTO w;
  IF w.actor<>p_actor OR w.sha256<>p_datos->>'sha256' THEN RAISE EXCEPTION 'Original diferente'; END IF;
  RETURN to_jsonb(w);
 END IF;
 SELECT * INTO w FROM doctrina.trabajos_tenida WHERE id=(p_datos->>'id')::uuid AND actor=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trabajo no encontrado' USING ERRCODE='P0002'; END IF;
 IF p_accion='obtener' THEN RETURN to_jsonb(w); END IF;
 IF p_accion='iniciar' THEN
  PERFORM pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,0));
  IF w.revision<>(p_datos->>'revision')::integer THEN RAISE EXCEPTION 'Actualice el trabajo antes de continuar' USING ERRCODE='40001'; END IF;
  IF w.bloqueado_hasta>now() THEN RAISE EXCEPTION 'Este trabajo ya se está procesando' USING ERRCODE='40001'; END IF;
  IF (SELECT count(*) FROM doctrina.trabajos_historial WHERE actor=p_actor AND accion='iniciar' AND creado_en>now()-interval '1 hour')>=60 THEN RAISE EXCEPTION 'Límite horario alcanzado'; END IF;
  id_bloqueo=gen_random_uuid();
  UPDATE doctrina.trabajos_tenida SET bloqueo=id_bloqueo,bloqueado_hasta=now()+interval '6 minutes' WHERE id=w.id RETURNING * INTO w;
  INSERT INTO doctrina.trabajos_historial(trabajo_id,actor,accion,revision) VALUES(w.id,p_actor,'iniciar',w.revision);
  RETURN to_jsonb(w);
 ELSIF p_accion IN ('guardar','liberar') THEN
  IF w.bloqueo IS DISTINCT FROM (p_datos->>'bloqueo')::uuid OR w.bloqueo IS NULL OR w.bloqueado_hasta<now() THEN RAISE EXCEPTION 'El paso venció. Actualice el trabajo' USING ERRCODE='40001'; END IF;
  IF p_accion='guardar' THEN
   IF w.revision<>(p_datos->>'revision')::integer THEN RAISE EXCEPTION 'El trabajo cambió' USING ERRCODE='40001'; END IF;
   UPDATE doctrina.trabajos_tenida SET datos=p_datos->'datos',revision=revision+1,actualizado_en=now(),bloqueo=NULL,bloqueado_hasta=NULL WHERE id=w.id RETURNING * INTO w;
   INSERT INTO doctrina.trabajos_historial(trabajo_id,actor,accion,revision,resultado) VALUES(w.id,p_actor,p_datos->>'paso',w.revision,jsonb_build_object('revision_bloques',w.datos->'revision_bloques','contraste',w.datos->'contraste','oratoria',w.datos->'oratoria','decision',w.datos->'decision'));
  ELSE UPDATE doctrina.trabajos_tenida SET bloqueo=NULL,bloqueado_hasta=NULL WHERE id=w.id; END IF;
  RETURN to_jsonb(w);
 END IF;
 RAISE EXCEPTION 'Acción inválida' USING ERRCODE='22023';
END $f$;
REVOKE ALL ON FUNCTION public.trabajos_tenida_superadmin(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trabajos_tenida_superadmin(uuid,text,jsonb) TO service_role;
COMMIT;
