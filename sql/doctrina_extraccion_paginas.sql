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
create or replace function public.doctrina_texto_superadmin(p_actor uuid,p_accion text,p_datos jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v doctrina.versiones; x doctrina.textos_extraidos; n integer; pagina jsonb; filas jsonb; cobertura jsonb;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.usuarios u join auth.users a on a.id=u.auth_user_id where a.id=p_actor and u.es_admin and lower(u.email)=lower(a.email) and (lower(a.email)='jpintov@gmail.com' or a.raw_app_meta_data->>'superadmin_principal'='true')) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_accion='texto_buscar' then
  if length(btrim(coalesce(p_datos->>'consulta',''))) not between 3 and 250 then raise exception 'Consulta no válida'; end if;
  select coalesce(jsonb_agg(z),'[]') into filas from (
   select d.titulo,fuente.id as version_id,fuente.numero as version,fuente.sha256,(p->>'numero')::integer as pagina,left(ts_headline('spanish',p->>'texto',websearch_to_tsquery('spanish',p_datos->>'consulta'),'StartSel=, StopSel=, MaxFragments=2, MaxWords=65, MinWords=15'),1200) as fragmento
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
