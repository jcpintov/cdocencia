-- Migración preparada, sin aplicar. Los originales y sus aprobaciones no se modifican.
create table if not exists doctrina.textos_extraidos(
 version_id uuid primary key references doctrina.versiones(id),sha256 text not null,motor text not null,
 paginas jsonb not null check(jsonb_typeof(paginas)='array'),total_paginas integer not null check(total_paginas between 1 and 600),
 estado text not null default 'revision' check(estado in ('revision','aprobado')),
 creado_por uuid not null references auth.users(id),creado_en timestamptz not null default now(),revisado_por uuid references auth.users(id),revisado_en timestamptz
);
alter table doctrina.textos_extraidos enable row level security;
revoke all on doctrina.textos_extraidos from public,anon,authenticated;
create table if not exists doctrina.textos_revision_historial(
 id uuid primary key default gen_random_uuid(),version_id uuid not null references doctrina.textos_extraidos(version_id),
 actor uuid not null references auth.users(id),accion text not null,pagina integer,anterior jsonb,siguiente jsonb,creado_en timestamptz not null default now()
);
alter table doctrina.textos_revision_historial enable row level security;
revoke all on doctrina.textos_revision_historial from public,anon,authenticated;
-- Permisos externos revocables, por versión/huella y modelo. No contienen originales.
create table if not exists doctrina.llm_autorizaciones(
 version_id uuid primary key references doctrina.versiones(id), sha256 text not null,
 proveedor text not null check(proveedor='groq'),modelo text not null check(modelo='openai/gpt-oss-120b'),
 autorizado boolean not null default false,revision uuid not null default gen_random_uuid(),actor uuid not null references auth.users(id),actualizado_en timestamptz not null default now()
);
create table if not exists doctrina.llm_autorizaciones_historial(
 id uuid primary key default gen_random_uuid(),version_id uuid not null references doctrina.versiones(id),actor uuid not null references auth.users(id),
 autorizado boolean not null,proveedor text not null,modelo text not null,sha256 text not null,creado_en timestamptz not null default now()
);
create table if not exists doctrina.llm_consultas(
 id uuid primary key default gen_random_uuid(),actor uuid not null references auth.users(id),proveedor text not null default 'groq',modelo text not null default 'openai/gpt-oss-120b',
 hash text not null,fuentes jsonb not null,estado text not null default 'reservado' check(estado in ('reservado','completado','fallido','limite')),creado_en timestamptz not null default now(),finalizado_en timestamptz
);
create index if not exists llm_consultas_actor_fecha on doctrina.llm_consultas(actor,creado_en desc);
alter table doctrina.llm_autorizaciones enable row level security;
alter table doctrina.llm_autorizaciones_historial enable row level security;
alter table doctrina.llm_consultas enable row level security;
revoke all on doctrina.llm_autorizaciones,doctrina.llm_autorizaciones_historial,doctrina.llm_consultas from public,anon,authenticated;

create or replace function public.doctrina_texto_superadmin(p_actor uuid,p_accion text,p_datos jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v doctrina.versiones; x doctrina.textos_extraidos; n integer; pagina jsonb; filas jsonb; cobertura jsonb; consulta_id uuid;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.usuarios u join auth.users a on a.id=u.auth_user_id where a.id=p_actor and u.es_admin and lower(u.email)=lower(a.email) and (lower(a.email)='jpintov@gmail.com' or a.raw_app_meta_data->>'superadmin_principal'='true')) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_accion='texto_llm_listar' then
  select coalesce(jsonb_agg(jsonb_build_object('version_id',fuente.id,'titulo',d.titulo,'version',fuente.numero,'sha256',fuente.sha256,'modelo','openai/gpt-oss-120b','texto_aprobado',coalesce(t.estado='aprobado' and t.sha256=fuente.sha256,false),'autorizado',coalesce(a.autorizado and a.sha256=fuente.sha256,false)) order by d.titulo),'[]') into filas
  from doctrina.documentos d join doctrina.versiones fuente on fuente.documento_id=d.id
  left join doctrina.textos_extraidos t on t.version_id=fuente.id left join doctrina.llm_autorizaciones a on a.version_id=fuente.id
  where d.estado='vigente' and fuente.numero=(select max(v2.numero) from doctrina.versiones v2 where v2.documento_id=d.id);
  return jsonb_build_object('autorizaciones',filas);
 elsif p_accion in ('texto_llm_autorizar','texto_llm_revocar') then
  select fuente.* into v from doctrina.versiones fuente join doctrina.documentos d on d.id=fuente.documento_id where fuente.id=(p_datos->>'id')::uuid
  and (p_accion='texto_llm_revocar' or (d.estado='vigente' and fuente.numero=(select max(v2.numero) from doctrina.versiones v2 where v2.documento_id=d.id) and exists(select 1 from doctrina.textos_extraidos t where t.version_id=fuente.id and t.estado='aprobado' and t.sha256=fuente.sha256))) for share of d;
  if not found then raise exception 'Se requiere una versión vigente con texto aprobado'; end if;
  insert into doctrina.llm_autorizaciones(version_id,sha256,proveedor,modelo,autorizado,actor) values(v.id,v.sha256,'groq','openai/gpt-oss-120b',p_accion='texto_llm_autorizar',p_actor)
  on conflict(version_id) do update set sha256=excluded.sha256,autorizado=excluded.autorizado,revision=gen_random_uuid(),actor=p_actor,actualizado_en=now();
  insert into doctrina.llm_autorizaciones_historial(version_id,actor,autorizado,proveedor,modelo,sha256) values(v.id,p_actor,p_accion='texto_llm_autorizar','groq','openai/gpt-oss-120b',v.sha256);
  return jsonb_build_object('ok',true);
 elsif p_accion='texto_llm_reservar' then
  if jsonb_typeof(p_datos->'fuentes') is distinct from 'array' or jsonb_array_length(p_datos->'fuentes') not between 1 and 6 or coalesce(p_datos->>'hash','') !~ '^[0-9a-f]{64}$' then raise exception 'Expediente no válido'; end if;
  perform 1 from public.usuarios where auth_user_id=p_actor for update;
  if exists(select 1 from doctrina.llm_consultas where actor=p_actor and creado_en>now()-interval '60 seconds') or (select count(*) from doctrina.llm_consultas where actor=p_actor and creado_en>=date_trunc('day',now()))>=20 then return jsonb_build_object('ok',false,'mensaje','Límite preventivo: una generación por minuto y hasta 20 por día UTC. Se mantiene la consulta documental.'); end if;
  select coalesce(jsonb_agg(f||jsonb_build_object('permiso_revision',a.revision,'texto_revisado_en',t.revisado_en)),'[]') into filas
  from jsonb_array_elements(p_datos->'fuentes') f
  join doctrina.versiones fuente on fuente.id=(f->>'version_id')::uuid and fuente.sha256=f->>'sha256'
  join doctrina.documentos d on d.id=fuente.documento_id and d.estado='vigente'
  join doctrina.textos_extraidos t on t.version_id=fuente.id and t.estado='aprobado' and t.sha256=fuente.sha256
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
    join doctrina.textos_extraidos t on t.version_id=fuente.id and t.estado='aprobado' and t.sha256=fuente.sha256
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
  select coalesce(jsonb_agg(z),'[]') into filas from (
   select d.titulo,d.clase,fuente.id as version_id,fuente.numero as version,fuente.sha256,(p->>'numero')::integer as pagina,left(ts_headline('spanish',p->>'texto',websearch_to_tsquery('spanish',p_datos->>'consulta'),'StartSel=, StopSel=, MaxFragments=2, MaxWords=65, MinWords=15'),1200) as fragmento
   from doctrina.textos_extraidos t join doctrina.versiones fuente on fuente.id=t.version_id join doctrina.documentos d on d.id=fuente.documento_id
   cross join lateral jsonb_array_elements(t.paginas) p
   where t.estado='aprobado' and d.estado='vigente' and fuente.sha256=t.sha256 and fuente.numero=(select max(v2.numero) from doctrina.versiones v2 where v2.documento_id=d.id)
   and to_tsvector('spanish',p->>'texto') @@ websearch_to_tsquery('spanish',p_datos->>'consulta')
   order by d.titulo,(p->>'numero')::integer limit 50
  ) z;
  select jsonb_build_object('vigentes',count(*),'consultables',count(*) filter(where t.estado='aprobado' and t.sha256=fuente.sha256),'pendientes',count(*) filter(where t.estado is distinct from 'aprobado' or t.sha256 is distinct from fuente.sha256)) into cobertura
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
  insert into doctrina.textos_extraidos(version_id,sha256,motor,paginas,total_paginas,creado_por) values(v.id,v.sha256,p_datos->>'motor',p_datos->'paginas',jsonb_array_length(p_datos->'paginas'),p_actor) on conflict(version_id) do nothing;
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
end $$;
revoke all on function public.doctrina_texto_superadmin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.doctrina_texto_superadmin(uuid,text,jsonb) to service_role;
