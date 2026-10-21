-- Mantiene autorización tras un cambio de correo confirmado. app_metadata solo lo escribe el servidor.
CREATE OR REPLACE FUNCTION public.admin_asignaciones_docentes(p_actor uuid, p_accion text, p_datos jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r public.docencia_asignaciones%rowtype; nuevo public.docencia_asignaciones%rowtype;
 v_id uuid; v_usuario uuid; v_codigo text; v_fecha date; v_entrega date; v_correo uuid; v_email text; v_msg jsonb;
begin
 if auth.role() is distinct from 'service_role' or not exists(
 select 1 from public.usuarios u
 where u.auth_user_id=p_actor and u.es_admin is true and exists(select 1 from auth.users sa where sa.id=p_actor and lower(sa.email)=lower(u.email) and (lower(sa.email)='jpintov@gmail.com' or sa.raw_app_meta_data->>'superadmin_principal'='true')))
 then raise exception 'Operación exclusiva de Superadmin' using errcode='42501'; end if;
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
end $function$;

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
   where a.id=p_actor and u.es_admin is true and lower(u.email)=lower(a.email) and (lower(a.email)='jpintov@gmail.com' or a.raw_app_meta_data->>'superadmin_principal'='true')
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

revoke all on function public.admin_asignaciones_docentes(uuid,text,jsonb),public.doctrina_gestion_superadmin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_asignaciones_docentes(uuid,text,jsonb),public.doctrina_gestion_superadmin(uuid,text,jsonb) to service_role;
