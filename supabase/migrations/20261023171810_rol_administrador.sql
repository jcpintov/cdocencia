-- Roles explícitos. No se delega ninguna cuenta automáticamente.
ALTER TABLE public.usuarios ADD COLUMN rol text NOT NULL DEFAULT 'USER';
UPDATE public.usuarios u SET rol='SUPERADMIN'
WHERE u.es_admin IS TRUE AND EXISTS(SELECT 1 FROM doctrina.superadmins s WHERE s.auth_user_id=u.auth_user_id AND s.activo);
-- Un es_admin legado sin identidad principal no recibe privilegios delegados.
UPDATE public.usuarios SET es_admin=false WHERE rol='USER' AND es_admin IS DISTINCT FROM false;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_rol_check CHECK(rol IN('USER','ADMIN','SUPERADMIN'));
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_rol_admin_coherente CHECK(es_admin IS NOT DISTINCT FROM (rol IN('ADMIN','SUPERADMIN')));
CREATE UNIQUE INDEX usuarios_superadmin_unico ON public.usuarios ((rol)) WHERE rol='SUPERADMIN';

CREATE OR REPLACE FUNCTION doctrina.rol_verificado(p_actor uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT u.rol FROM public.usuarios u JOIN auth.users a ON a.id=u.auth_user_id
 WHERE a.id=p_actor AND NOT u.cuenta_eliminada AND a.email_confirmed_at IS NOT NULL
 AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now())
 AND lower(btrim(a.email))=lower(btrim(u.email))
 AND (SELECT count(*) FROM public.usuarios x WHERE x.auth_user_id=a.id)=1
 AND ((u.rol='SUPERADMIN' AND u.es_admin AND EXISTS(SELECT 1 FROM doctrina.superadmins s WHERE s.auth_user_id=a.id AND s.activo)
 AND (lower(a.email)='jpintov@gmail.com' OR a.raw_app_meta_data->>'superadmin_principal'='true'))
 OR (u.rol IN('USER','ADMIN') AND NOT EXISTS(SELECT 1 FROM doctrina.superadmins s WHERE s.auth_user_id=a.id AND s.activo)))
 LIMIT 1
$$;
REVOKE ALL ON FUNCTION doctrina.rol_verificado(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.es_superadmin_actual() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(doctrina.rol_verificado((SELECT auth.uid()))='SUPERADMIN',false)
$$;
CREATE OR REPLACE FUNCTION public.es_operador_actual() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(doctrina.rol_verificado((SELECT auth.uid())) IN('ADMIN','SUPERADMIN'),false)
$$;
REVOKE ALL ON FUNCTION public.es_operador_actual() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.es_operador_actual() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.doctrina_es_superadmin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.es_superadmin_actual()
$$;
CREATE OR REPLACE FUNCTION public.maestro_identidad_actual()
RETURNS TABLE(auth_user_id uuid,legacy_user_id uuid,rol text,nombre text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT u.auth_user_id,u.id,u.rol,u.nombre::text FROM public.usuarios u
 WHERE u.auth_user_id=(SELECT auth.uid()) AND doctrina.rol_verificado(u.auth_user_id)=u.rol
$$;
CREATE OR REPLACE FUNCTION doctrina.proteger_roles() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_user IS NULL THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
 -- No hay ruta pública que permita editar roles, incluso si se amplían permisos de columna.
 IF coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role' IN('anon','authenticated')
 OR coalesce(current_setting('request.jwt.claim.role',true),'') IN('anon','authenticated') THEN
  IF TG_OP='INSERT' AND (NEW.rol<>'USER' OR NEW.es_admin) THEN RAISE EXCEPTION 'Rol protegido' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND (NEW.rol IS DISTINCT FROM OLD.rol OR NEW.es_admin IS DISTINCT FROM OLD.es_admin) THEN RAISE EXCEPTION 'Rol protegido' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION doctrina.proteger_roles() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER usuarios_proteger_roles BEFORE INSERT OR UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION doctrina.proteger_roles();

CREATE TABLE doctrina.auditoria_roles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor uuid NOT NULL,usuario uuid NOT NULL,
 rol_anterior text NOT NULL,rol_nuevo text NOT NULL,motivo text NOT NULL,creado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE doctrina.auditoria_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON doctrina.auditoria_roles FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_gestionar_rol(p_actor uuid,p_usuario uuid,p_rol text,p_rol_actual text,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u public.usuarios;
BEGIN
 IF coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
 AND coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role' IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'Servicio requerido' USING ERRCODE='42501'; END IF;
 IF doctrina.rol_verificado(p_actor) IS DISTINCT FROM 'SUPERADMIN' THEN RAISE EXCEPTION 'Superadmin requerido' USING ERRCODE='42501'; END IF;
 IF p_rol IS NULL OR p_rol NOT IN('USER','ADMIN') OR p_rol_actual IS NULL OR p_rol_actual NOT IN('USER','ADMIN')
 OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 SELECT * INTO u FROM public.usuarios WHERE id=p_usuario FOR UPDATE;
 IF NOT FOUND OR u.cuenta_eliminada THEN RAISE EXCEPTION 'Usuario no disponible' USING ERRCODE='P0002'; END IF;
 IF u.rol='SUPERADMIN' OR u.auth_user_id=p_actor OR EXISTS(SELECT 1 FROM doctrina.superadmins s WHERE s.auth_user_id=u.auth_user_id AND s.activo)
 THEN RAISE EXCEPTION 'Cuenta protegida' USING ERRCODE='42501'; END IF;
 IF u.rol IS DISTINCT FROM p_rol_actual THEN RAISE EXCEPTION 'Rol desactualizado' USING ERRCODE='40001'; END IF;
 IF p_rol='ADMIN' AND doctrina.rol_verificado(u.auth_user_id) IS DISTINCT FROM u.rol THEN
 RAISE EXCEPTION 'Cuenta sin activar' USING ERRCODE='22023'; END IF;
 IF p_rol=u.rol THEN RETURN jsonb_build_object('id',u.id,'rol',u.rol); END IF;
 UPDATE public.usuarios SET rol=p_rol,es_admin=(p_rol='ADMIN') WHERE id=u.id;
 INSERT INTO doctrina.auditoria_roles(actor,usuario,rol_anterior,rol_nuevo,motivo) VALUES(p_actor,u.id,u.rol,p_rol,btrim(p_motivo));
 RETURN jsonb_build_object('id',u.id,'rol',p_rol);
END
$$;
REVOKE ALL ON FUNCTION public.admin_gestionar_rol(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_gestionar_rol(uuid,uuid,text,text,text) TO service_role;
-- La lectura administrativa es operacional; config_segura conserva es_superadmin_actual.
ALTER POLICY usuarios_lectura_admin ON public.usuarios USING((SELECT public.es_operador_actual()));
GRANT SELECT(rol,cuenta_eliminada) ON public.usuarios TO authenticated;
DO $policies$
DECLARE p record; q text; c text;
BEGIN
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='public'
 AND tablename IN('progreso_maestro','registro_accesos','comentarios_muro','modulos') LOOP
  q:=replace(p.qual,'es_superadmin_actual()','es_operador_actual()');
  c:=replace(p.with_check,'es_superadmin_actual()','es_operador_actual()');
  IF p.tablename='modulos' THEN
   q:=replace(q,'''SUPERADMIN''::text','ANY (ARRAY[''ADMIN''::text,''SUPERADMIN''::text])');
   c:=replace(c,'''SUPERADMIN''::text','ANY (ARRAY[''ADMIN''::text,''SUPERADMIN''::text])');
  END IF;
  IF q IS DISTINCT FROM p.qual OR c IS DISTINCT FROM p.with_check THEN
   EXECUTE 'ALTER POLICY '||quote_ident(p.policyname)||' ON public.'||quote_ident(p.tablename)
    ||CASE WHEN q IS NOT NULL THEN ' USING ('||q||')' ELSE '' END
    ||CASE WHEN c IS NOT NULL THEN ' WITH CHECK ('||c||')' ELSE '' END;
  END IF;
 END LOOP;
END
$policies$;

CREATE OR REPLACE FUNCTION public.trabajos_tenida_superadmin(p_actor uuid, p_accion text, p_datos jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE w doctrina.trabajos_tenida; resultado jsonb; id_bloqueo uuid;
BEGIN
 IF coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
 AND coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role' IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501'; END IF;
 IF coalesce(doctrina.rol_verificado(p_actor) IN('ADMIN','SUPERADMIN'),false) IS NOT TRUE THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501'; END IF;
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
END $function$
;

CREATE OR REPLACE FUNCTION public.doctrina_texto_superadmin(p_actor uuid, p_accion text, p_datos jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v doctrina.versiones; x doctrina.textos_extraidos; n integer; pagina jsonb; filas jsonb; cobertura jsonb; consulta_id uuid;
begin

 if auth.role() is distinct from 'service_role' or coalesce(doctrina.rol_verificado(p_actor) IN('ADMIN','SUPERADMIN'),false) IS NOT TRUE then raise exception 'Acceso denegado' using errcode='42501'; end if;
 
if p_accion IN('texto_llm_autorizar','texto_llm_revocar','texto_llm_autorizar_biblioteca') AND doctrina.rol_verificado(p_actor) IS DISTINCT FROM 'SUPERADMIN' then raise exception 'Autorización exclusiva de Superadmin' using errcode='42501'; end if;
if p_accion='texto_llm_autorizar_biblioteca' then
  if p_datos->>'confirmacion' is distinct from 'true' then raise exception 'Se requiere autorización expresa'; end if;
  insert into doctrina.llm_autorizaciones(version_id,sha256,proveedor,modelo,autorizado,actor)
  select v2.id,v2.sha256,'groq','openai/gpt-oss-120b',true,p_actor
  from doctrina.documentos d
  join doctrina.versiones v2 on v2.documento_id=d.id
  join doctrina.textos_extraidos t on t.version_id=v2.id
   and t.sha256=v2.sha256 and t.estado in ('indexado','revision','aprobado')
  where d.estado='vigente'
   and v2.numero=(select max(v3.numero) from doctrina.versiones v3 where v3.documento_id=d.id)
   and exists(select 1 from jsonb_array_elements(t.paginas) p
     where length(btrim(coalesce(p->>'texto','')))>=20
     and not coalesce((p->>'requiere_ocr')::boolean,false))
  on conflict(version_id) do update set sha256=excluded.sha256,proveedor='groq',
   modelo='openai/gpt-oss-120b',autorizado=true,actor=p_actor,
   revision=gen_random_uuid(),actualizado_en=now();

  insert into doctrina.llm_autorizaciones_historial(version_id,actor,autorizado,proveedor,modelo,sha256)
  select a.version_id,p_actor,true,a.proveedor,a.modelo,a.sha256
  from doctrina.llm_autorizaciones a
  join doctrina.versiones v2 on v2.id=a.version_id and v2.sha256=a.sha256
  join doctrina.documentos d on d.id=v2.documento_id and d.estado='vigente'
  where a.autorizado and a.actor=p_actor
   and v2.numero=(select max(v3.numero) from doctrina.versiones v3 where v3.documento_id=d.id);


  -- Registrar la autorización documental que exige el trigger existente.
  insert into doctrina.autorizaciones_fuente(documento_id,alcance,fundamento,autorizado_por)
  select d.id,'llm_externo','Autorización expresa de biblioteca mediante texto_llm_autorizar_biblioteca, limitada a pasajes para Groq / openai/gpt-oss-120b.',p_actor
  from doctrina.documentos d
  where d.estado='vigente' and exists (
   select 1 from doctrina.versiones v2 join doctrina.llm_autorizaciones a on a.version_id=v2.id
   where v2.documento_id=d.id and a.autorizado and a.actor=p_actor and a.sha256=v2.sha256
    and a.proveedor='groq' and a.modelo='openai/gpt-oss-120b'
    and v2.numero=(select max(v3.numero) from doctrina.versiones v3 where v3.documento_id=d.id))
  and not exists(select 1 from doctrina.autorizaciones_fuente af
   where af.documento_id=d.id and af.alcance='llm_externo' and af.revocado_en is null);
  update doctrina.documentos d set autorizacion_procesamiento_externo=true
  where d.estado='vigente' and exists(
   select 1 from doctrina.versiones v2 join doctrina.llm_autorizaciones a on a.version_id=v2.id
   where v2.documento_id=d.id and a.autorizado and a.sha256=v2.sha256
    and v2.numero=(select max(v3.numero) from doctrina.versiones v3 where v3.documento_id=d.id));
  return jsonb_build_object('ok',true,'autorizados',(
   select count(*) from doctrina.llm_autorizaciones a join doctrina.versiones v2 on v2.id=a.version_id
   join doctrina.documentos d on d.id=v2.documento_id
   where d.estado='vigente' and a.autorizado and a.sha256=v2.sha256));
elsif p_accion='texto_llm_listar' then

  select coalesce(jsonb_agg(jsonb_build_object('version_id',fuente.id,'titulo',d.titulo,'version',fuente.numero,'sha256',fuente.sha256,'modelo','openai/gpt-oss-120b','texto_aprobado',coalesce(t.estado in ('indexado','revision','aprobado') and t.sha256=fuente.sha256,false),'texto_indexado',coalesce(t.estado in ('indexado','revision','aprobado') and t.sha256=fuente.sha256,false),'autorizado',coalesce(a.autorizado and a.sha256=fuente.sha256,false)) order by d.titulo),'[]') into filas
  from doctrina.documentos d join doctrina.versiones fuente on fuente.documento_id=d.id
  left join doctrina.textos_extraidos t on t.version_id=fuente.id left join doctrina.llm_autorizaciones a on a.version_id=fuente.id
  where d.estado='vigente' and fuente.numero=(select max(v2.numero) from doctrina.versiones v2 where v2.documento_id=d.id);
  return jsonb_build_object('autorizaciones',filas);
 elsif p_accion in ('texto_llm_autorizar','texto_llm_revocar') then
  select fuente.* into v from doctrina.versiones fuente join doctrina.documentos d on d.id=fuente.documento_id where fuente.id=(p_datos->>'id')::uuid
  and (p_accion='texto_llm_revocar' or (d.estado='vigente' and fuente.numero=(select max(v2.numero) from doctrina.versiones v2 where v2.documento_id=d.id) and exists(select 1 from doctrina.textos_extraidos t where t.version_id=fuente.id and t.estado in ('indexado','revision','aprobado') and t.sha256=fuente.sha256))) for share of d;
  if not found then raise exception 'Se requiere una versión vigente con texto aprobado'; end if;
  insert into doctrina.llm_autorizaciones(version_id,sha256,proveedor,modelo,autorizado,actor) values(v.id,v.sha256,'groq','openai/gpt-oss-120b',p_accion='texto_llm_autorizar',p_actor)
  on conflict(version_id) do update set sha256=excluded.sha256,autorizado=excluded.autorizado,revision=gen_random_uuid(),actor=p_actor,actualizado_en=now();
  insert into doctrina.llm_autorizaciones_historial(version_id,actor,autorizado,proveedor,modelo,sha256) values(v.id,p_actor,p_accion='texto_llm_autorizar','groq','openai/gpt-oss-120b',v.sha256);
  return jsonb_build_object('ok',true);
 elsif p_accion='texto_llm_reservar' then
  if jsonb_typeof(p_datos->'fuentes') is distinct from 'array' or jsonb_array_length(p_datos->'fuentes') not between 1 and 500 or coalesce(p_datos->>'hash','') !~ '^[0-9a-f]{64}$' then raise exception 'Expediente no válido'; end if;
  perform 1 from public.usuarios where auth_user_id=p_actor for update;
  if p_datos->>'id' is null and ((select count(*) from doctrina.llm_consultas where actor=p_actor and creado_en>now()-interval '60 seconds')>=3 or (select count(*) from doctrina.llm_consultas where actor=p_actor and creado_en>=date_trunc('day',now()))>=100) then return jsonb_build_object('ok',false,'mensaje','Límite preventivo: hasta tres turnos por minuto y cien por día UTC. Tu conversación se conserva.'); end if;
  select coalesce(jsonb_agg(f||jsonb_build_object('permiso_revision',a.revision,'texto_revisado_en',t.revisado_en)),'[]') into filas
  from jsonb_array_elements(p_datos->'fuentes') f
  join doctrina.versiones fuente on fuente.id=(f->>'version_id')::uuid and fuente.sha256=f->>'sha256'
  join doctrina.documentos d on d.id=fuente.documento_id and d.estado='vigente'
  join doctrina.textos_extraidos t on t.version_id=fuente.id and t.estado in ('indexado','revision','aprobado') and t.sha256=fuente.sha256
  join doctrina.llm_autorizaciones a on a.version_id=fuente.id and a.autorizado and a.sha256=fuente.sha256 and a.proveedor='groq' and a.modelo='openai/gpt-oss-120b'
  where fuente.numero=(select max(v2.numero) from doctrina.versiones v2 where v2.documento_id=d.id) and (f->>'pagina')::integer between 1 and t.total_paginas;
  if jsonb_array_length(filas)<>jsonb_array_length(p_datos->'fuentes') then return jsonb_build_object('ok',false,'mensaje','Autorización o versión documental cambió. No se enviaron fragmentos.'); end if;
  if p_datos->>'id' is not null then
   update doctrina.llm_consultas set fuentes=filas where id=(p_datos->>'id')::uuid and actor=p_actor and estado='reservado' and creado_en>now()-interval '2 minutes';
   return jsonb_build_object('ok',found,'id',p_datos->>'id');
  end if;
  insert into doctrina.llm_consultas(actor,hash,fuentes) values(p_actor,p_datos->>'hash',filas) returning id into consulta_id;
  return jsonb_build_object('ok',true,'id',consulta_id);
 elsif p_accion='texto_llm_validar' then
  select fuentes into filas from doctrina.llm_consultas where id=(p_datos->>'id')::uuid and actor=p_actor and estado='reservado' and creado_en>now()-interval '2 minutes';
  if not found then return jsonb_build_object('ok',false); end if;
  return jsonb_build_object('ok',not exists(
   select 1 from jsonb_array_elements(filas) f where not exists(
    select 1 from doctrina.versiones fuente join doctrina.documentos d on d.id=fuente.documento_id and d.estado='vigente'
    join doctrina.textos_extraidos t on t.version_id=fuente.id and t.estado in ('indexado','revision','aprobado') and t.sha256=fuente.sha256
    join doctrina.llm_autorizaciones a on a.version_id=fuente.id and a.autorizado and a.sha256=fuente.sha256 and a.revision=(f->>'permiso_revision')::uuid and t.revisado_en is not distinct from (f->>'texto_revisado_en')::timestamptz
    where fuente.id=(f->>'version_id')::uuid and fuente.sha256=f->>'sha256' and fuente.numero=(select max(v2.numero) from doctrina.versiones v2 where v2.documento_id=d.id)
   )
  ));
 elsif p_accion='texto_llm_finalizar' then
  if p_datos->>'estado' not in ('completado','fallido','limite') then raise exception 'Estado no válido'; end if;
  update doctrina.llm_consultas set estado=p_datos->>'estado',finalizado_en=now() where id=(p_datos->>'id')::uuid and actor=p_actor and estado='reservado';
  return jsonb_build_object('ok',found);
 end if;

 if p_accion='texto_contexto' then
  select paginas into filas from doctrina.contexto_base where unico=true;
  if found then return jsonb_build_object('paginas',filas); end if;
  select coalesce(jsonb_agg(z),'[]') into filas from (
   select d.titulo,d.clase,v2.id version_id,v2.numero version,v2.sha256,ip.pagina,ip.texto fragmento,1 relevancia
   from doctrina.documentos d join doctrina.versiones v2 on v2.documento_id=d.id
   join doctrina.indice_paginas ip on ip.version_id=v2.id and ip.sha256=v2.sha256
   join doctrina.llm_autorizaciones a on a.version_id=v2.id and a.sha256=v2.sha256 and a.autorizado and a.modelo='openai/gpt-oss-120b'
   where d.estado='vigente' and d.clase<>'bibliografia' and v2.numero=(select max(v3.numero) from doctrina.versiones v3 where v3.documento_id=d.id)
    and not ip.requiere_ocr and length(btrim(ip.texto))>=20
    and (d.clase='normativa' or d.titulo='PRINCIPIOS DE LA MASONERÍA' or ip.pagina<=3)
   order by case d.clase when 'normativa' then 0 when 'doctrina' then 1 when 'docencia' then 2 when 'tradicion' then 3 else 4 end,d.titulo,ip.pagina
  )z;
  insert into doctrina.contexto_base(unico,paginas) values(true,filas) on conflict(unico) do update set paginas=excluded.paginas,preparado_en=now();
  return jsonb_build_object('paginas',filas);
 end if;

 if p_accion='texto_buscar' then
  if length(btrim(coalesce(p_datos->>'consulta',''))) not between 3 and 250 then raise exception 'Consulta no válida'; end if;
  with consulta as (select websearch_to_tsquery('spanish',p_datos->>'consulta') as q),
  coincidencias as (
   select d.titulo,d.clase,t.estado as estado_texto,fuente.id as version_id,fuente.numero as version,fuente.sha256,
    ip.pagina,ip.texto,consulta.q,
    case when fuente.id='adce9f1f-c193-42f1-83fa-9600a9154a29'::uuid then case when ip.pagina between 4 and 5 then 0 when ip.pagina between 6 and 21 then 1 else 2 end when lower(d.titulo) like '%principios%' then 0 when lower(d.titulo) like '%constituc%' and lower(d.titulo) not like '%reglamento general%' then 1 when lower(d.titulo) like '%reglamento general%' then 2 when lower(d.titulo) like '%justicia%' then 3 else 4 end as prioridad_normativa,
    ts_rank_cd(ip.busqueda,consulta.q) as relevancia,
    case d.clase when 'normativa' then 0 when 'doctrina' then 1 when 'docencia' then 2 when 'tradicion' then 3 when 'bibliografia' then 4 else 5 end as prioridad,
    row_number() over(partition by fuente.id,(case when fuente.id='adce9f1f-c193-42f1-83fa-9600a9154a29'::uuid then case when ip.pagina between 4 and 5 then 0 when ip.pagina between 6 and 21 then 1 else 2 end when lower(d.titulo) like '%principios%' then 0 when lower(d.titulo) like '%constituc%' and lower(d.titulo) not like '%reglamento general%' then 1 when lower(d.titulo) like '%reglamento general%' then 2 when lower(d.titulo) like '%justicia%' then 3 else 4 end) order by ts_rank_cd(ip.busqueda,consulta.q) desc,ip.pagina) as posicion
   from doctrina.indice_paginas ip
   join doctrina.versiones fuente on fuente.id=ip.version_id and fuente.sha256=ip.sha256
   join doctrina.textos_extraidos t on t.version_id=fuente.id and t.sha256=fuente.sha256
   join doctrina.documentos d on d.id=fuente.documento_id cross join consulta
   where t.estado in ('indexado','revision','aprobado') and d.estado='vigente'
    and fuente.numero=(select max(v2.numero) from doctrina.versiones v2 where v2.documento_id=d.id)
    and length(btrim(ip.texto))>=20 and not ip.requiere_ocr and ip.busqueda @@ consulta.q
  ), seleccionadas as materialized (
   select c.* from coincidencias c where c.posicion<=4
   order by c.prioridad,c.prioridad_normativa,c.relevancia desc,c.titulo,c.pagina limit 50
  )
  select coalesce(jsonb_agg(z),'[]') into filas from (
   select c.titulo,c.clase,c.estado_texto,c.version_id,c.version,c.sha256,c.pagina,c.prioridad_normativa,
    left(ts_headline('spanish',c.texto,c.q,'StartSel=, StopSel=, MaxFragments=3, MaxWords=110, MinWords=30'),1800) as fragmento,c.relevancia
   from seleccionadas c order by c.prioridad,c.prioridad_normativa,c.relevancia desc,c.titulo,c.pagina
  ) z;
  select jsonb_build_object('vigentes',count(*),'consultables',count(*) filter(where t.estado in ('indexado','revision','aprobado') and t.sha256=fuente.sha256),'pendientes',count(*) filter(where (t.estado is null or t.estado not in ('indexado','revision','aprobado')) or t.sha256 is distinct from fuente.sha256)) into cobertura
  from doctrina.documentos d
  left join lateral (select v2.* from doctrina.versiones v2 where v2.documento_id=d.id order by v2.numero desc limit 1) fuente on true
  left join doctrina.textos_extraidos t on t.version_id=fuente.id
  where d.estado='vigente';
  return jsonb_build_object('resultados',filas,'cobertura',cobertura);
 end if;
 select v1.* into v from doctrina.versiones v1 join doctrina.documentos d on d.id=v1.documento_id where v1.id=(p_datos->>'id')::uuid and d.estado='vigente' for share of d;
 if not found then raise exception 'Original no vigente'; end if;
 if p_accion='texto_guardar' then
  if p_datos->>'sha256'<>v.sha256 or jsonb_typeof(p_datos->'paginas')<>'array' or jsonb_array_length(p_datos->'paginas') not between 1 and 600 or octet_length((p_datos->'paginas')::text)>6500000 then raise exception 'Extracción no válida'; end if;
  insert into doctrina.textos_extraidos(version_id,sha256,motor,paginas,total_paginas,estado,creado_por) values(v.id,v.sha256,p_datos->>'motor',p_datos->'paginas',jsonb_array_length(p_datos->'paginas'),'indexado',p_actor) on conflict(version_id) do nothing;
 elsif p_accion not in ('texto_pagina','texto_revisar_pagina','texto_aprobar') then raise exception 'Acción no válida'; end if;
 select * into x from doctrina.textos_extraidos where version_id=v.id for update;
 if not found then return jsonb_build_object('extraido',false); end if;
 if p_accion='texto_revisar_pagina' then
  n:=(p_datos->>'pagina')::integer;
  if coalesce((p_datos->>'pagina_sin_texto')::boolean,false) and length(btrim(coalesce(p_datos->>'texto','')))>0 then raise exception 'Una página sin texto debe quedar vacía'; end if;
  if n is null or n<1 or n>x.total_paginas or (length(coalesce(p_datos->>'texto',''))>40000 or (length(btrim(coalesce(p_datos->>'texto','')))=0 and coalesce((p_datos->>'pagina_sin_texto')::boolean,false)=false)) then raise exception 'Página no válida'; end if;
  pagina:=(x.paginas->(n-1))||jsonb_build_object('texto',p_datos->>'texto','revisada',true,'requiere_ocr',false,'pagina_sin_texto',coalesce((p_datos->>'pagina_sin_texto')::boolean,false),'revisado_por',p_actor,'revisado_en',now());
  insert into doctrina.textos_revision_historial(version_id,actor,accion,pagina,anterior,siguiente) values(v.id,p_actor,'revisar_pagina',n,x.paginas->(n-1),pagina);
  update doctrina.textos_extraidos set paginas=jsonb_set(paginas,array[(n-1)::text],pagina),estado='revision',revisado_en=null,revisado_por=null where version_id=v.id returning * into x;
 elsif p_accion='texto_aprobar' then
  if exists(select 1 from jsonb_array_elements(x.paginas) p where coalesce((p->>'revisada')::boolean,false)=false) then raise exception 'Hay páginas pendientes de revisión'; end if;
  insert into doctrina.textos_revision_historial(version_id,actor,accion,anterior,siguiente) values(v.id,p_actor,'aprobar',jsonb_build_object('estado',x.estado),jsonb_build_object('estado','aprobado'));
  update doctrina.textos_extraidos set estado='aprobado',revisado_en=now(),revisado_por=p_actor where version_id=v.id returning * into x;
 end if;
 n:=coalesce((p_datos->>'pagina')::integer,1);if n<1 or n>x.total_paginas then raise exception 'Página no válida'; end if;
 return jsonb_build_object('extraido',true,'estado',x.estado,'total_paginas',x.total_paginas,'pendientes',(select count(*) from jsonb_array_elements(x.paginas) p where coalesce((p->>'revisada')::boolean,false)=false),'pagina',x.paginas->(n-1),'sha256',x.sha256,'motor',x.motor);
end $function$
;

CREATE OR REPLACE FUNCTION public.doctrina_gestion_superadmin(p_actor uuid, p_accion text, p_datos jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_doc uuid; v_version uuid; v_path text; v_result jsonb;
begin

 if auth.role() is distinct from 'service_role' or coalesce(doctrina.rol_verificado(p_actor) IN('ADMIN','SUPERADMIN'),false) IS NOT TRUE then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_accion='listar' then
   select jsonb_build_object(
     'documentos',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'titulo',d.titulo,'clase',d.clase,'estado',d.estado,'version_id',v.id,'sha256',v.sha256,'bytes',v.bytes,'revision',v.estado,'nota_revision',v.nota_revision,'revisado_en',v.revisado_en,'creado_en',d.creado_en) order by d.creado_en desc) from doctrina.documentos d left join lateral(select * from doctrina.versiones where documento_id=d.id order by numero desc limit 1)v on true),'[]'::jsonb),
     'inventario',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'archivo',i.archivo_nombre,'clase',i.clase_propuesta,'estado',i.estado,'grado_validado',i.grado_validado,'derechos_verificados',i.derechos_verificados,'publicacion_autorizada',i.publicacion_autorizada) order by i.archivo_nombre) from doctrina.ingesta_documental i),'[]'::jsonb)
   ) into v_result;
   return v_result;

 elsif p_accion='clasificar' then
   if coalesce(p_datos->>'clase','') not in ('normativa','doctrina','docencia','tradicion','ritual','bibliografia') then raise exception 'Categoría inválida' using errcode='22023'; end if;
   select d.id,v.id,jsonb_build_object('anterior',d.clase,'sha256',v.sha256) into v_doc,v_version,v_result
   from doctrina.documentos d join doctrina.versiones v on v.documento_id=d.id
   where v.id=(p_datos->>'id')::uuid and v.numero=(select max(v2.numero) from doctrina.versiones v2 where v2.documento_id=d.id) for update of d;
   if not found then raise exception 'Versión documental no disponible'; end if;
   if v_result->>'anterior' is distinct from p_datos->>'clase_actual' then raise exception 'La categoría cambió. Actualice la biblioteca' using errcode='40001'; end if;
   if v_result->>'anterior'=p_datos->>'clase' then return jsonb_build_object('documento_id',v_doc,'clase',p_datos->>'clase','sin_cambios',true); end if;
   update doctrina.documentos set clase=p_datos->>'clase' where id=v_doc;
   update doctrina.ingesta_documental set clase_propuesta=p_datos->>'clase' where sha256=v_result->>'sha256';
   insert into doctrina.revision_historial(version_id,actor,accion,decision,nota)
   values(v_version,p_actor,'clasificar',p_datos->>'clase',jsonb_build_object('anterior',v_result->>'anterior','nueva',p_datos->>'clase')::text);
   return jsonb_build_object('documento_id',v_doc,'clase',p_datos->>'clase','anterior',v_result->>'anterior');
 elsif p_accion='obtener' then
   select jsonb_build_object('path',v.objeto_storage,'sha256',v.sha256,'bytes',v.bytes,'titulo',d.titulo) into v_result
   from doctrina.versiones v join doctrina.documentos d on d.id=v.documento_id where v.id=(p_datos->>'id')::uuid and d.estado<>'retirado';
   return v_result;
 elsif p_accion in ('revisar','retirar','restaurar') then
   select d.id,v.id into v_doc,v_version from doctrina.documentos d join doctrina.versiones v on v.documento_id=d.id where v.id=(p_datos->>'id')::uuid for update of d,v;
   if not found then raise exception 'Documento no encontrado'; end if;
   if p_accion='retirar' then
     update doctrina.documentos set estado='retirado' where id=v_doc;
   elsif p_accion='restaurar' then
     update doctrina.documentos set estado='borrador' where id=v_doc;
     update doctrina.versiones set estado='revision',revisado_en=null,revisado_por=null where id=v_version;
   else
     if coalesce(p_datos->>'decision','') not in ('aprobar','devolver') or length(coalesce(p_datos->>'nota',''))>2000 then raise exception 'Revisión inválida'; end if;
     if exists(select 1 from doctrina.documentos where id=v_doc and estado='retirado') then raise exception 'Documento retirado'; end if;
     if p_datos->>'decision'='aprobar' and not exists(select 1 from doctrina.versiones v join storage.objects o on o.name=v.objeto_storage and o.bucket_id='doctrina-originales-privados' where v.id=v_version and (o.metadata->>'size')::bigint=v.bytes) then raise exception 'Original ausente'; end if;
     update doctrina.documentos set estado=case when p_datos->>'decision'='aprobar' then 'vigente' else 'borrador' end where id=v_doc;
     update doctrina.versiones set estado=case when p_datos->>'decision'='aprobar' then 'listo' else 'revision' end,nota_revision=coalesce(p_datos->>'nota',''),revisado_en=now(),revisado_por=p_actor where id=v_version;
   end if;
   insert into doctrina.revision_historial(version_id,actor,accion,decision,nota) values(v_version,p_actor,p_accion,p_datos->>'decision',coalesce(p_datos->>'nota',''));
   return jsonb_build_object('documento_id',v_doc,'version_id',v_version);
 elsif p_accion='registrar' then
   v_path=p_datos->>'path';
   if v_path is null or v_path !~ ('^superadmin/'||p_actor::text||'/[0-9a-f-]{36}\.pdf$')
     or coalesce(length(trim(p_datos->>'titulo')),0) not between 3 and 250
     or coalesce(p_datos->>'clase','') not in ('normativa','doctrina','ritual','tradicion','bibliografia','docencia')
     or coalesce(p_datos->>'sha256','') !~ '^[0-9a-f]{64}$'
     or coalesce((p_datos->>'bytes')::bigint,0) not between 1 and 52428800
   then raise exception 'Datos inválidos' using errcode='22023'; end if;
   perform pg_advisory_xact_lock(pg_catalog.hashtextextended(v_path,0));
   select documento_id,id into v_doc,v_version from doctrina.versiones where objeto_storage=v_path;
   if found then return jsonb_build_object('documento_id',v_doc,'version_id',v_version,'existente',true); end if;
   if not exists(select 1 from storage.objects where bucket_id='doctrina-originales-privados' and name=v_path and (metadata->>'size')::bigint=(p_datos->>'bytes')::bigint)
   then raise exception 'Original no disponible o tamaño diferente'; end if;
   insert into doctrina.documentos(titulo,clase,grado_minimo,estado,creado_por,clasificacion_acceso)
   values(trim(p_datos->>'titulo'),p_datos->>'clase','M','borrador',p_actor,'reservado') returning id into v_doc;
   insert into doctrina.versiones(documento_id,numero,sha256,objeto_storage,mime,bytes,estado,verificacion_integridad_en)
   values(v_doc,1,p_datos->>'sha256',v_path,'application/pdf',(p_datos->>'bytes')::bigint,'revision',now()) returning id into v_version;
   return jsonb_build_object('documento_id',v_doc,'version_id',v_version,'existente',false);
 end if;
 raise exception 'Acción inválida' using errcode='22023';
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_asignaciones_docentes(p_actor uuid, p_accion text, p_datos jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.docencia_asignaciones%rowtype; nuevo public.docencia_asignaciones%rowtype;
 v_id uuid; v_usuario uuid; v_codigo text; v_fecha date; v_entrega date; v_correo uuid; v_email text; v_msg jsonb;
begin

 if auth.role() is distinct from 'service_role' or coalesce(doctrina.rol_verificado(p_actor) IN('ADMIN','SUPERADMIN'),false) IS NOT TRUE then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_accion='listar' then
  return jsonb_build_object('usuarios',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'email',email) order by nombre)
   from public.usuarios where es_admin is not true and lower(email)<>'dummy@ofl.cl'),'[]'::jsonb),
   'catalogo',coalesce((select jsonb_agg(jsonb_build_object('codigo',codigo,'detalle',detalle,'orden',orden) order by orden)
   from public.unidades_docencia where activo),'[]'::jsonb),
   'asignaciones',coalesce((select jsonb_agg(public.docencia_asignacion_contexto(id) order by creado_en desc) from public.docencia_asignaciones),'[]'::jsonb));
 end if;
 if p_accion in ('crear','modificar') then
  v_usuario:=(p_datos->>'usuario_id')::uuid; v_codigo:=p_datos->>'codigo';
  v_fecha:=(p_datos->>'fecha_asignacion')::date;
  v_entrega:=coalesce((p_datos->>'fecha_entrega')::date,v_fecha+21);
  if v_fecha is null or v_entrega is null or v_entrega<v_fecha then raise exception 'Revise las fechas de asignación y entrega' using errcode='22023';end if;
  if not exists(select 1 from public.usuarios where id=v_usuario and es_admin is not true and lower(email)<>'dummy@ofl.cl')
  then raise exception 'Seleccione un integrante del padrón' using errcode='22023'; end if;
  if v_codigo !~ '^(INCI|INST|FILO|ETIC)[0-9]{2}[0-9A-Z][A-Z1-9]$' or not exists(select 1 from public.unidades_docencia where codigo=v_codigo and activo)
  then raise exception 'Seleccione un tema del catálogo' using errcode='22023'; end if;
  if p_accion='crear' then
   insert into public.docencia_asignaciones(usuario_id,codigo,fecha_asignacion,fecha_entrega,creado_por,actualizado_por)
   values(v_usuario,v_codigo,v_fecha,v_entrega,p_actor,p_actor) returning * into nuevo;
   insert into public.docencia_asignaciones_historial(asignacion_id,actor,accion,posterior) values(nuevo.id,p_actor,'crear',to_jsonb(nuevo));
   return public.docencia_asignacion_contexto(nuevo.id);
  end if;
 end if;
 v_id:=(p_datos->>'id')::uuid;
 select * into r from public.docencia_asignaciones where id=v_id for update;
 if not found then raise exception 'Asignación no encontrada' using errcode='P0002';end if;
 if not r.vigente then raise exception 'La asignación está anulada' using errcode='22023';end if;
 if (p_datos->>'version')::integer is distinct from r.version then raise exception 'La asignación cambió. Actualice antes de continuar' using errcode='40001';end if;
 if p_accion='vista_correo' then return public.docencia_asignacion_contexto(r.id);end if;
 if p_accion='cerrar_recordatorio' then
  update public.docencia_asignaciones_recordatorios set estado='incierto',finalizado_en=clock_timestamp(),copia_estado='sin_confirmar'
   where asignacion_id=r.id and id=(p_datos->>'intento')::uuid and estado in ('preparado','enviando') and creado_en<now()-interval '2 minutes';
  if not found then raise exception 'Espere dos minutos y revise el buzón antes de cerrar el intento' using errcode='55000';end if;
  insert into public.docencia_asignaciones_historial(asignacion_id,actor,accion,posterior) values(r.id,p_actor,'recordatorio_sin_confirmar',jsonb_build_object('intento',p_datos->>'intento'));
  return public.docencia_asignacion_contexto(r.id);
 end if;
 if p_accion in ('modificar','eliminar','reservar_correo') and exists(select 1 from public.docencia_asignaciones_recordatorios where asignacion_id=r.id and estado in ('preparado','enviando')) then
  raise exception 'Hay un recordatorio en curso o sin confirmar. Actualice para revisar su estado' using errcode='55000';end if;
 if p_accion in ('modificar','eliminar') then
  if exists(select 1 from public.docencia_asignaciones_correos where asignacion_id=r.id and estado='preparado') then
   raise exception 'Hay un envío en curso. Revise Correo antes de modificar' using errcode='55000';end if;
  update public.docencia_asignaciones set usuario_id=case when p_accion='modificar' then v_usuario else usuario_id end,
   codigo=case when p_accion='modificar' then v_codigo else codigo end,
   fecha_asignacion=case when p_accion='modificar' then v_fecha else fecha_asignacion end,
   fecha_entrega=case when p_accion='modificar' then v_entrega else fecha_entrega end,
   vigente=p_accion<>'eliminar',version=version+1,actualizado_en=clock_timestamp(),actualizado_por=p_actor
   where id=r.id returning * into nuevo;
  insert into public.docencia_asignaciones_historial(asignacion_id,actor,accion,anterior,posterior) values(r.id,p_actor,p_accion,to_jsonb(r),to_jsonb(nuevo));
  return public.docencia_asignacion_contexto(r.id);
 end if;
 if p_accion='reservar_correo' then
  v_correo:=(p_datos->>'intento')::uuid;
  if v_correo is null then raise exception 'Falta identificador de envío' using errcode='22023';end if;
  if exists(select 1 from public.docencia_asignaciones_correos where id=v_correo) then return jsonb_build_object('enviar',false);end if;
  if exists(select 1 from public.docencia_asignaciones_correos where asignacion_id=r.id) and coalesce((p_datos->>'reenviar')::boolean,false) is not true then
   raise exception 'Ya existe un intento de correo. Confirme expresamente el reenvío' using errcode='55000';end if;
  if exists(select 1 from public.docencia_asignaciones_correos where asignacion_id=r.id and estado='preparado') then
   raise exception 'Envío en curso o sin confirmar. No repita el envío' using errcode='55000';end if;
  select email into v_email from public.usuarios where id=r.usuario_id and es_admin is not true and lower(email)<>'dummy@ofl.cl';
  v_msg:=p_datos->'correo';
  if v_email is null or lower(v_msg->>'to') is distinct from lower(v_email) or nullif(v_msg->>'html','') is null or nullif(v_msg->>'text','') is null then
   raise exception 'Destinatario o contenido no válido' using errcode='22023';end if;
  insert into public.docencia_asignaciones_correos(id,asignacion_id,version,destinatario,asunto,texto,html,creado_por,usuario_id,codigo)
  values(v_correo,r.id,r.version,v_email,v_msg->>'subject',v_msg->>'text',v_msg->>'html',p_actor,r.usuario_id,r.codigo);
  return jsonb_build_object('enviar',true);
 end if;
 if p_accion in ('finalizar_correo','cerrar_intento') then
  v_correo:=(p_datos->>'intento')::uuid;
  if p_accion='cerrar_intento' and not exists(select 1 from public.docencia_asignaciones_correos where id=v_correo and asignacion_id=r.id and estado='preparado' and creado_en<now()-interval '2 minutes') then
   raise exception 'Espere dos minutos y revise antes de cerrar el intento' using errcode='55000';end if;
  update public.docencia_asignaciones_correos set estado=case when p_accion='finalizar_correo' and p_datos->>'estado'='enviado' then 'enviado' else 'incierto' end,
   copia_estado=case when p_datos->>'copia_estado'='aceptada' then 'aceptada' else 'sin_confirmar' end,
   message_id=left(p_datos->>'message_id',500),finalizado_en=clock_timestamp()
   where id=v_correo and asignacion_id=r.id and estado='preparado';
  return jsonb_build_object('ok',found);
 end if;
 raise exception 'Acción no admitida' using errcode='22023';
end $function$
;

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
  WHERE actor.auth_user_id=(SELECT auth.uid()) AND actor.rol IN('ADMIN','SUPERADMIN'))
ORDER BY p.nombre,p.id LIMIT 100
$function$
;

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
   WHERE actor.auth_user_id=(SELECT auth.uid()) AND actor.rol IN('ADMIN','SUPERADMIN')
  )
 GROUP BY u.id,u.nombre,u.email
 ORDER BY u.nombre,u.id
 LIMIT 200;
$function$
;

CREATE OR REPLACE FUNCTION public.maestro_admin_actualizar_preguntas(p_modulo_id uuid, p_bateria jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_auth uuid; v_pregunta jsonb; v_opcion jsonb;
        v_letras text[]; v_contador int:=0; v_modulo record;
BEGIN
 v_auth:=(SELECT auth.uid());
 IF v_auth IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.maestro_identidad_actual() x
   WHERE x.auth_user_id=v_auth AND x.rol IN('ADMIN','SUPERADMIN')
 ) THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501'; END IF;

 IF p_modulo_id IS NULL OR p_bateria IS NULL
   OR jsonb_typeof(p_bateria)<>'object'
   OR jsonb_typeof(p_bateria->'preguntas')<>'array'
   OR jsonb_array_length(p_bateria->'preguntas')<>8
   OR length(p_bateria::text)>80000 THEN
   RAISE EXCEPTION 'Estructura de batería inválida' USING ERRCODE='22023';
 END IF;

 FOR v_pregunta IN SELECT value FROM jsonb_array_elements(p_bateria->'preguntas')
 LOOP
  v_contador:=v_contador+1;
  IF jsonb_typeof(v_pregunta)<>'object'
     OR length(btrim(coalesce(v_pregunta->>'enunciado',''))) NOT BETWEEN 5 AND 1800
     OR length(coalesce(v_pregunta->>'retroalimentacion','')) > 6000
     OR v_pregunta->>'respuesta_correcta' NOT IN ('A','B','C','D')
     OR jsonb_typeof(v_pregunta->'opciones')<>'array'
     OR jsonb_array_length(v_pregunta->'opciones')<>4
  THEN RAISE EXCEPTION 'Pregunta % inválida',v_contador USING ERRCODE='22023'; END IF;
  v_letras:=array[]::text[];
  FOR v_opcion IN SELECT value FROM jsonb_array_elements(v_pregunta->'opciones')
  LOOP
    IF jsonb_typeof(v_opcion)<>'object'
       OR v_opcion->>'letra' NOT IN ('A','B','C','D')
       OR length(btrim(coalesce(v_opcion->>'texto',''))) NOT BETWEEN 2 AND 3000
       OR (v_opcion->>'letra')=ANY(v_letras)
    THEN RAISE EXCEPTION 'Alternativa inválida en pregunta %',v_contador USING ERRCODE='22023'; END IF;
    v_letras:=array_append(v_letras,v_opcion->>'letra');
  END LOOP;
 END LOOP;

 SELECT id,preguntas_json INTO v_modulo FROM public.modulos
 WHERE id=p_modulo_id AND activo IS TRUE FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trabajo no disponible' USING ERRCODE='P0002'; END IF;
 UPDATE public.modulos
 SET preguntas_json=jsonb_set(v_modulo.preguntas_json,'{preguntas}',p_bateria->'preguntas',true)
 WHERE id=p_modulo_id;
 INSERT INTO doctrina.auditoria_docencia(auth_user_id,modulo_id,accion,datos_resumen)
 VALUES(v_auth,p_modulo_id,'actualizar_preguntas',
   jsonb_build_object('preguntas',8,'version_anterior','preservada_en_respaldo_de_base',
      'campos_auxiliares_conservados',true));
 RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.maestro_admin_bitacora()
 RETURNS TABLE(registro_id uuid, usuario_id uuid, fecha timestamp with time zone, nombre text, email text, ip_origen text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT r.id,r.usuario_id,coalesce(r.fecha_acceso,r.creado_en) AS fecha,
         r.nombre,r.email,r.ip_origen
  FROM public.registro_accesos r
  WHERE EXISTS (
    SELECT 1 FROM public.maestro_identidad_actual() actor
    WHERE actor.auth_user_id=(SELECT auth.uid())
      AND actor.rol IN('ADMIN','SUPERADMIN')
  )
  ORDER BY coalesce(r.fecha_acceso,r.creado_en) DESC
  LIMIT 200;
$function$
;

CREATE OR REPLACE FUNCTION public.maestro_admin_editar_trabajo(p_modulo_id uuid, p_titulo text, p_autor text, p_contenido_trazado text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_auth uuid; v_previo record;
BEGIN
  v_auth := (SELECT auth.uid());
  IF v_auth IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.maestro_identidad_actual() p
    WHERE p.auth_user_id=v_auth AND p.rol IN('ADMIN','SUPERADMIN')
  ) THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501';
  END IF;
  IF p_modulo_id IS NULL OR p_titulo IS NULL OR
     length(btrim(p_titulo)) NOT BETWEEN 3 AND 180 OR
     p_contenido_trazado IS NULL OR
     length(btrim(p_contenido_trazado)) NOT BETWEEN 20 AND 300000 OR
     length(coalesce(p_autor,'')) > 180 THEN
    RAISE EXCEPTION 'Datos del trabajo fuera de límites' USING ERRCODE='22023';
  END IF;
  SELECT id,titulo,autor,length(contenido_trazado) AS longitud_anterior
  INTO v_previo FROM public.modulos WHERE id=p_modulo_id AND activo IS TRUE FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trabajo no disponible' USING ERRCODE='P0002';
  END IF;
  UPDATE public.modulos
  SET titulo=btrim(p_titulo),autor=nullif(btrim(coalesce(p_autor,'')),''),
      contenido_trazado=p_contenido_trazado
  WHERE id=p_modulo_id;
  INSERT INTO doctrina.auditoria_docencia (auth_user_id,modulo_id,accion,datos_resumen)
  VALUES (v_auth,p_modulo_id,'editar_trabajo',
     jsonb_build_object('titulo_anterior',v_previo.titulo,'titulo_nuevo',btrim(p_titulo),
       'autor_anterior',v_previo.autor,'autor_nuevo',nullif(btrim(coalesce(p_autor,'')),''),
       'longitud_texto_anterior',v_previo.longitud_anterior,
       'longitud_texto_nuevo',length(p_contenido_trazado)));
  RETURN TRUE;
END;
$function$
;

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
  WHERE a.auth_user_id=(SELECT auth.uid()) AND a.rol IN('ADMIN','SUPERADMIN')
 )
ORDER BY m.numero_orden,m.id
LIMIT 200
$function$
;

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
  AND identidad.rol IN ('USER','ADMIN','SUPERADMIN')
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
