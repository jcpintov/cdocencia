-- Preparada y probada localmente. NO aplicar sin autorización de publicación.
BEGIN;
CREATE TABLE public.docencia_observaciones (
 usuario_id uuid PRIMARY KEY REFERENCES public.usuarios(id),
 observacion text NOT NULL DEFAULT '' CHECK(length(observacion)<=500),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 actualizado_por uuid NOT NULL REFERENCES auth.users(id),
 actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.docencia_observaciones_historial (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 usuario_id uuid NOT NULL REFERENCES public.usuarios(id),actor uuid NOT NULL REFERENCES auth.users(id),
 anterior text NOT NULL,posterior text NOT NULL,creado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.docencia_observaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docencia_observaciones FORCE ROW LEVEL SECURITY;
ALTER TABLE public.docencia_observaciones_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docencia_observaciones_historial FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.docencia_observaciones,public.docencia_observaciones_historial FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.docencia_observaciones TO service_role;
GRANT SELECT,INSERT ON public.docencia_observaciones_historial TO service_role;
GRANT USAGE ON SEQUENCE public.docencia_observaciones_historial_id_seq TO service_role;
ALTER TABLE public.docencia_asignaciones ADD COLUMN entregado_el date,
 ADD COLUMN entregado_por uuid REFERENCES auth.users(id),ADD COLUMN entrega_nota text NOT NULL DEFAULT '' CHECK(length(entrega_nota)<=500),ADD COLUMN entrega_registrada_en timestamptz,
 ADD CONSTRAINT entrega_manual_completa CHECK((entregado_el IS NULL AND entregado_por IS NULL AND entrega_registrada_en IS NULL AND entrega_nota='') OR (entregado_el IS NOT NULL AND entregado_por IS NOT NULL AND entrega_registrada_en IS NOT NULL));
CREATE OR REPLACE FUNCTION public.docencia_recordatorio_contexto(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object(
 'estado',case when a.entregado_el is not null then 'entregado' when r.estado is not null then r.estado when not a.vigente then 'anulada'
   when p.trabajos is not null then 'publicado' when c.id is null then 'sin_solicitud'
   when exists(select 1 from public.docencia_asignaciones_correos pc where pc.asignacion_id=a.id and pc.estado='preparado') then 'solicitud_pendiente'
   when now() < ((a.fecha_entrega+7)+a.hora_entrega) at time zone 'America/Santiago' then 'programado' else 'pendiente' end,
 'entregado',a.entregado_el is not null or p.trabajos is not null,'publicado',p.trabajos is not null,'trabajos_publicados',coalesce(p.trabajos,'[]'::jsonb),
 'programado_para',((a.fecha_entrega+7)+a.hora_entrega) at time zone 'America/Santiago',
 'solicitud_id',c.id,'solicitud_enviada_en',c.finalizado_en,
 'id',r.id,'creado_en',r.creado_en,'finalizado_en',r.finalizado_en,'copia_estado',r.copia_estado)
 from public.docencia_asignaciones a join public.usuarios u on u.id=a.usuario_id
 left join lateral(select c.id,c.finalizado_en from public.docencia_asignaciones_correos c
  where c.asignacion_id=a.id and c.estado='enviado' and c.finalizado_en is not null
   and c.usuario_id=a.usuario_id and c.codigo=a.codigo and lower(c.destinatario)=lower(u.email)
  order by c.finalizado_en,c.id limit 1) c on true
 left join lateral(select jsonb_agg(jsonb_build_object('id',m.id,'titulo',m.titulo,'fecha_subida',m.creado_en) order by m.numero_orden) trabajos
  from public.modulos m where m.activo and (m.unidad_codigo=a.codigo or exists(select 1 from public.modulos_temas mt where mt.modulo_id=m.id and mt.codigo=a.codigo))) p on true
 left join public.docencia_asignaciones_recordatorios r on r.asignacion_id=a.id and not(r.estado='cancelado' and exists(select 1 from public.docencia_asignaciones_historial h where h.asignacion_id=a.id and h.accion='entregar'))
 where a.id=p_id;
$function$;


create or replace function public.docencia_asignacion_contexto(p_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(a)||jsonb_build_object('observacion',coalesce(o.observacion,''),'nombre',u.nombre,'email',u.email,'tema',t.detalle,
 'unidad',un.detalle,'subunidad',su.detalle,'recordatorio',public.docencia_recordatorio_contexto(a.id),
 'avisos_publicacion',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'codigo',p.codigo,'tema',p.tema,'estado',p.estado,'creado_en',p.creado_en,'finalizado_en',p.finalizado_en,'copia_estado',p.copia_estado) order by p.creado_en desc) from public.docencia_publicaciones_correos p where p.usuario_id=a.usuario_id and p.codigo=a.codigo),'[]'::jsonb),
 'correos',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'estado',c.estado,'version',c.version,'creado_en',c.creado_en,'finalizado_en',c.finalizado_en,'copia_estado',c.copia_estado) order by c.creado_en desc)
 from public.docencia_asignaciones_correos c where c.asignacion_id=a.id),'[]'::jsonb))
 from public.docencia_asignaciones a join public.usuarios u on u.id=a.usuario_id left join public.docencia_observaciones o on o.usuario_id=u.id
 join public.unidades_docencia t on t.codigo=a.codigo
 left join public.unidades_docencia un on un.codigo=left(a.codigo,6)||'00'
 left join public.unidades_docencia su on su.codigo=left(a.codigo,7)||'0' where a.id=p_id;
$$;


CREATE OR REPLACE FUNCTION public.admin_asignaciones_docentes(p_actor uuid, p_accion text, p_datos jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.docencia_asignaciones%rowtype; nuevo public.docencia_asignaciones%rowtype;
 v_obs public.docencia_observaciones; v_texto text; v_real date; v_id uuid; v_usuario uuid; v_codigo text; v_fecha date; v_entrega date; v_correo uuid; v_email text; v_msg jsonb;
begin

 if auth.role() is distinct from 'service_role' or coalesce(doctrina.rol_verificado(p_actor) IN('ADMIN','SUPERADMIN'),false) IS NOT TRUE then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_accion='listar' then
  return jsonb_build_object('usuarios',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'nombre',u.nombre,'email',u.email,'observacion',coalesce(o.observacion,''),'observacion_version',coalesce(o.version,0)) order by nombre)
   from public.usuarios u left join public.docencia_observaciones o on o.usuario_id=u.id where u.rol='USER' and not u.cuenta_eliminada),'[]'::jsonb),
   'catalogo',coalesce((select jsonb_agg(jsonb_build_object('codigo',codigo,'detalle',detalle,'orden',orden) order by orden)
   from public.unidades_docencia where activo),'[]'::jsonb),
   'asignaciones',coalesce((select jsonb_agg(public.docencia_asignacion_contexto(id) order by creado_en desc) from public.docencia_asignaciones),'[]'::jsonb));
 end if;
 if p_accion='observacion' then
  v_usuario:=(p_datos->>'usuario_id')::uuid;v_texto:=btrim(p_datos->>'observacion');
  if v_texto is null or length(v_texto)>500 or jsonb_typeof(p_datos->'observacion') is distinct from 'string' then raise exception 'Observación inválida (máximo 500 caracteres)' using errcode='22023';end if;
  perform 1 from public.usuarios where id=v_usuario and rol='USER' and not cuenta_eliminada for update;
  if not found then raise exception 'Usuario docente no disponible' using errcode='P0002';end if;
  select * into v_obs from public.docencia_observaciones where usuario_id=v_usuario;
  if (p_datos->>'version')::integer is distinct from coalesce(v_obs.version,0) then raise exception 'La observación cambió. Actualice antes de guardar' using errcode='40001';end if;
  insert into public.docencia_observaciones(usuario_id,observacion,version,actualizado_por)
   values(v_usuario,v_texto,1,p_actor) on conflict(usuario_id) do update set observacion=excluded.observacion,version=public.docencia_observaciones.version+1,actualizado_por=p_actor,actualizado_en=clock_timestamp();
  insert into public.docencia_observaciones_historial(usuario_id,actor,anterior,posterior) values(v_usuario,p_actor,coalesce(v_obs.observacion,''),v_texto);
  return jsonb_build_object('guardado',true);
 end if;
 if p_accion in ('crear','modificar') then
  v_usuario:=(p_datos->>'usuario_id')::uuid; v_codigo:=p_datos->>'codigo';
  v_fecha:=(p_datos->>'fecha_asignacion')::date;
  v_entrega:=coalesce((p_datos->>'fecha_entrega')::date,v_fecha+21);
  if v_fecha is null or v_entrega is null or v_entrega<v_fecha then raise exception 'Revise las fechas de asignación y entrega' using errcode='22023';end if;
  if not exists(select 1 from public.usuarios where id=v_usuario and rol='USER' and not cuenta_eliminada)
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
 if p_accion in ('entregar','reabrir') then
  if p_datos->'confirmado' is distinct from 'true'::jsonb then raise exception 'Confirme el cambio de entrega' using errcode='22023';end if;
  perform 1 from public.usuarios where id=r.usuario_id and rol='USER' and not cuenta_eliminada;
  if not found then raise exception 'Usuario docente no disponible' using errcode='P0002';end if;
  if (public.docencia_recordatorio_contexto(r.id)->>'publicado')::boolean then raise exception 'El trabajo publicado ya está entregado; gestione primero su publicación' using errcode='55000';end if;
  if exists(select 1 from public.docencia_asignaciones_correos where asignacion_id=r.id and estado='preparado') or exists(select 1 from public.docencia_asignaciones_recordatorios where asignacion_id=r.id and estado='enviando') then raise exception 'Hay un correo en curso o sin confirmar. Revise su estado antes de continuar' using errcode='55000';end if;
  if p_accion='entregar' then
   if r.entregado_el is not null then raise exception 'La entrega ya fue registrada' using errcode='40001';end if;
   v_real:=(p_datos->>'fecha_entrega_real')::date;v_texto:=btrim(coalesce(p_datos->>'nota',''));
   if v_real is null or v_real<r.fecha_asignacion or v_real>(now() at time zone 'America/Santiago')::date or length(v_texto)>500 then raise exception 'Revise la fecha efectiva y la nota de entrega' using errcode='22023';end if;
   update public.docencia_asignaciones_recordatorios set estado='cancelado',finalizado_en=clock_timestamp() where asignacion_id=r.id and estado='preparado';
  elsif r.entregado_el is null then raise exception 'No hay una entrega manual que reabrir' using errcode='22023';end if;
  update public.docencia_asignaciones set entregado_el=case when p_accion='entregar' then v_real end,
   entregado_por=case when p_accion='entregar' then p_actor end,entrega_nota=case when p_accion='entregar' then v_texto else '' end,
   entrega_registrada_en=case when p_accion='entregar' then clock_timestamp() end,
   version=version+1,actualizado_por=p_actor,actualizado_en=clock_timestamp() where id=r.id returning * into nuevo;
  insert into public.docencia_asignaciones_historial(asignacion_id,actor,accion,anterior,posterior) values(r.id,p_actor,p_accion,to_jsonb(r),to_jsonb(nuevo));
  return public.docencia_asignacion_contexto(r.id);
 end if;
 if p_accion='modificar' and r.entregado_el is not null then raise exception 'Reabra la entrega antes de modificar la asignación' using errcode='55000';end if;
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


create or replace function public.docencia_recordatorios_servicio(p_accion text,p_datos jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.docencia_asignaciones%rowtype;r public.docencia_asignaciones_recordatorios%rowtype;
 ctx jsonb;v_id uuid;v_intento uuid;v_correo jsonb;v_email text;v_n integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Servicio exclusivo del servidor' using errcode='42501';end if;
 if p_accion='candidatos' then
  return coalesce((select jsonb_agg(public.docencia_asignacion_contexto(x.id)) from (
   select asignada.id from public.docencia_asignaciones asignada where asignada.vigente and public.docencia_recordatorio_contexto(asignada.id)->>'estado'='pendiente'
   order by asignada.fecha_entrega,asignada.id limit 100) x),'[]'::jsonb);
 end if;
 v_id:=(p_datos->>'id')::uuid;v_intento:=(p_datos->>'intento')::uuid;
 if p_accion in ('reservar','confirmar') then
  select * into a from public.docencia_asignaciones where id=v_id for update;
  if not found then return jsonb_build_object('enviar',false);end if;
  ctx:=public.docencia_recordatorio_contexto(a.id);
  if p_accion='reservar' then
   if ctx->>'estado'<>'pendiente' or (p_datos->>'version')::int is distinct from a.version
    or (p_datos->>'solicitud_id')::uuid is distinct from (ctx->>'solicitud_id')::uuid then return jsonb_build_object('enviar',false);end if;
   select email into v_email from public.usuarios where id=a.usuario_id and es_admin is not true and lower(email)<>'dummy@ofl.cl';
   v_correo:=p_datos->'correo';
   if v_intento is null or v_email is null or lower(v_correo->>'to') is distinct from lower(v_email)
    or nullif(v_correo->>'html','') is null or nullif(v_correo->>'text','') is null then raise exception 'Correo no válido' using errcode='22023';end if;
   insert into public.docencia_asignaciones_recordatorios(asignacion_id,id,version,solicitud_id,destinatario,asunto,texto,html)
    values(a.id,v_intento,a.version,(ctx->>'solicitud_id')::uuid,v_email,v_correo->>'subject',v_correo->>'text',v_correo->>'html') on conflict(asignacion_id) do update set id=excluded.id,version=excluded.version,solicitud_id=excluded.solicitud_id,estado='preparado',destinatario=excluded.destinatario,asunto=excluded.asunto,texto=excluded.texto,html=excluded.html,creado_en=clock_timestamp(),finalizado_en=null,copia_estado='sin_registro',message_id=null where public.docencia_asignaciones_recordatorios.estado='cancelado' and exists(select 1 from public.docencia_asignaciones_historial h where h.asignacion_id=a.id and h.accion='entregar');
   get diagnostics v_n=row_count;return jsonb_build_object('enviar',v_n=1);
  end if;
  select * into r from public.docencia_asignaciones_recordatorios where asignacion_id=a.id and id=v_intento for update;
  if not found or r.estado<>'preparado' then return jsonb_build_object('enviar',false);end if;
  select email into v_email from public.usuarios where id=a.usuario_id and es_admin is not true and lower(email)<>'dummy@ofl.cl';
  if not a.vigente or a.version<>r.version or coalesce((ctx->>'entregado')::boolean,true)
   or ctx->>'solicitud_id' is null or v_email is null or lower(v_email)<>lower(r.destinatario)
   or now()<((a.fecha_entrega+7)+a.hora_entrega) at time zone 'America/Santiago'
   or exists(select 1 from public.docencia_asignaciones_correos where asignacion_id=a.id and estado='preparado') then
   update public.docencia_asignaciones_recordatorios set estado='cancelado',finalizado_en=clock_timestamp() where asignacion_id=a.id;
   return jsonb_build_object('enviar',false);
  end if;
  update public.docencia_asignaciones_recordatorios set estado='enviando' where asignacion_id=a.id;
  return jsonb_build_object('enviar',true);
 end if;
 if p_accion='finalizar' then
  update public.docencia_asignaciones_recordatorios set estado=case when p_datos->>'estado'='enviado' then 'enviado' else 'incierto' end,
   copia_estado=case when p_datos->>'copia_estado'='aceptada' then 'aceptada' else 'sin_confirmar' end,
   message_id=left(p_datos->>'message_id',500),finalizado_en=clock_timestamp()
   where asignacion_id=v_id and id=v_intento and estado in ('preparado','enviando');
  return jsonb_build_object('ok',found);
 end if;
 raise exception 'Acción no admitida' using errcode='22023';
end $$;
revoke all on function public.docencia_recordatorios_servicio(text,jsonb) from public,anon,authenticated;
grant execute on function public.docencia_recordatorios_servicio(text,jsonb) to service_role;


REVOKE ALL ON FUNCTION public.admin_asignaciones_docentes(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_asignaciones_docentes(uuid,text,jsonb) TO service_role;
COMMIT;
