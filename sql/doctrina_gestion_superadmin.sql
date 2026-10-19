-- Complemento aditivo. No publica documentos ni concede acceso a participantes.
create or replace function public.doctrina_gestion_superadmin(p_actor uuid,p_accion text,p_datos jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_doc uuid; v_version uuid; v_path text; v_result jsonb;
begin
 if auth.role() is distinct from 'service_role' or not exists(
   select 1 from public.usuarios u join auth.users a on a.id=u.auth_user_id
   where a.id=p_actor and u.es_admin is true and lower(a.email)='jpintov@gmail.com' and lower(u.email)='jpintov@gmail.com'
 ) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_accion='listar' then
   select jsonb_build_object(
     'documentos',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'titulo',d.titulo,'clase',d.clase,'estado',d.estado,'version_id',v.id,'sha256',v.sha256,'bytes',v.bytes,'revision',v.estado,'creado_en',d.creado_en) order by d.creado_en desc) from doctrina.documentos d left join lateral(select * from doctrina.versiones where documento_id=d.id order by numero desc limit 1)v on true),'[]'::jsonb),
     'inventario',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'archivo',i.archivo_nombre,'clase',i.clase_propuesta,'estado',i.estado,'grado_validado',i.grado_validado,'derechos_verificados',i.derechos_verificados,'publicacion_autorizada',i.publicacion_autorizada) order by i.archivo_nombre) from doctrina.ingesta_documental i),'[]'::jsonb)
   ) into v_result;
   return v_result;
 elsif p_accion='obtener' then
   select jsonb_build_object('path',v.objeto_storage,'sha256',v.sha256,'bytes',v.bytes,'titulo',d.titulo) into v_result
   from doctrina.versiones v join doctrina.documentos d on d.id=v.documento_id where v.id=(p_datos->>'id')::uuid;
   return v_result;
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
end $fn$;
revoke all on function public.doctrina_gestion_superadmin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.doctrina_gestion_superadmin(uuid,text,jsonb) to service_role;
