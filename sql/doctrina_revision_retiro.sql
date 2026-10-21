alter table doctrina.versiones add column if not exists nota_revision text not null default '', add column if not exists revisado_en timestamptz, add column if not exists revisado_por uuid references auth.users(id);
create table if not exists doctrina.revision_historial(id uuid primary key default gen_random_uuid(),version_id uuid not null references doctrina.versiones(id),actor uuid not null references auth.users(id),accion text not null,decision text,nota text not null default '',creado_en timestamptz not null default now());
alter table doctrina.revision_historial enable row level security;
revoke all on doctrina.revision_historial from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.doctrina_gestion_superadmin(p_actor uuid, p_accion text, p_datos jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_doc uuid; v_version uuid; v_path text; v_result jsonb;
begin
 if auth.role() is distinct from 'service_role' or not exists(
   select 1 from public.usuarios u join auth.users a on a.id=u.auth_user_id
   where a.id=p_actor and u.es_admin is true and lower(a.email)='jpintov@gmail.com' and lower(u.email)='jpintov@gmail.com'
 ) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_accion='listar' then
   select jsonb_build_object(
     'documentos',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'titulo',d.titulo,'clase',d.clase,'estado',d.estado,'version_id',v.id,'sha256',v.sha256,'bytes',v.bytes,'revision',v.estado,'nota_revision',v.nota_revision,'revisado_en',v.revisado_en,'creado_en',d.creado_en) order by d.creado_en desc) from doctrina.documentos d left join lateral(select * from doctrina.versiones where documento_id=d.id order by numero desc limit 1)v on true),'[]'::jsonb),
     'inventario',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'archivo',i.archivo_nombre,'clase',i.clase_propuesta,'estado',i.estado,'grado_validado',i.grado_validado,'derechos_verificados',i.derechos_verificados,'publicacion_autorizada',i.publicacion_autorizada) order by i.archivo_nombre) from doctrina.ingesta_documental i),'[]'::jsonb)
   ) into v_result;
   return v_result;
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
end $function$;

revoke all on function public.doctrina_gestion_superadmin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.doctrina_gestion_superadmin(uuid,text,jsonb) to service_role;
