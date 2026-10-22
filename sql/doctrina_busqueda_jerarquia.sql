-- Búsqueda jerárquica con pertinencia y límite por documento.
-- Registra la constancia documental antes de activar el permiso externo.
-- Conserva el control de Superadmin, hashes, vigencia y permisos Groq.
BEGIN;
CREATE OR REPLACE FUNCTION public.doctrina_texto_superadmin(p_actor uuid, p_accion text, p_datos jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v doctrina.versiones; x doctrina.textos_extraidos; n integer; pagina jsonb; filas jsonb; cobertura jsonb; consulta_id uuid;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.usuarios u join auth.users a on a.id=u.auth_user_id where a.id=p_actor and u.es_admin and lower(u.email)=lower(a.email) and (lower(a.email)='jpintov@gmail.com' or a.raw_app_meta_data->>'superadmin_principal'='true')) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 
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
  if jsonb_typeof(p_datos->'fuentes') is distinct from 'array' or jsonb_array_length(p_datos->'fuentes') not between 1 and 12 or coalesce(p_datos->>'hash','') !~ '^[0-9a-f]{64}$' then raise exception 'Expediente no válido'; end if;
  perform 1 from public.usuarios where auth_user_id=p_actor for update;
  if exists(select 1 from doctrina.llm_consultas where actor=p_actor and creado_en>now()-interval '60 seconds') or (select count(*) from doctrina.llm_consultas where actor=p_actor and creado_en>=date_trunc('day',now()))>=20 then return jsonb_build_object('ok',false,'mensaje','Límite preventivo: una generación por minuto y hasta 20 por día UTC. Se mantiene la consulta documental.'); end if;
  select coalesce(jsonb_agg(f||jsonb_build_object('permiso_revision',a.revision,'texto_revisado_en',t.revisado_en)),'[]') into filas
  from jsonb_array_elements(p_datos->'fuentes') f
  join doctrina.versiones fuente on fuente.id=(f->>'version_id')::uuid and fuente.sha256=f->>'sha256'
  join doctrina.documentos d on d.id=fuente.documento_id and d.estado='vigente'
  join doctrina.textos_extraidos t on t.version_id=fuente.id and t.estado in ('indexado','revision','aprobado') and t.sha256=fuente.sha256
  join doctrina.llm_autorizaciones a on a.version_id=fuente.id and a.autorizado and a.sha256=fuente.sha256 and a.proveedor='groq' and a.modelo='openai/gpt-oss-120b'
  where fuente.numero=(select max(v2.numero) from doctrina.versiones v2 where v2.documento_id=d.id) and (f->>'pagina')::integer between 1 and t.total_paginas;
  if jsonb_array_length(filas)<>jsonb_array_length(p_datos->'fuentes') then return jsonb_build_object('ok',false,'mensaje','Autorización o versión documental cambió. No se enviaron fragmentos.'); end if;
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
end $function$;

COMMIT;

