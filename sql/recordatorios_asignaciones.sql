-- Recordatorio único por asignación; datos y RPC exclusivos del servidor.
alter table public.docencia_asignaciones_correos
 add column usuario_id uuid references public.usuarios(id),
 add column codigo text references public.unidades_docencia(codigo),
 add column copia_oculta text not null default 'jpintov@gmail.com',
 add column copia_estado text not null default 'sin_registro' check(copia_estado in ('sin_registro','aceptada','sin_confirmar'));
-- Los envíos anteriores sin identidad verificable no habilitan recordatorios.
update public.docencia_asignaciones_correos c set usuario_id=(h.posterior->>'usuario_id')::uuid,codigo=h.posterior->>'codigo'
 from public.docencia_asignaciones_historial h where h.asignacion_id=c.asignacion_id and (h.posterior->>'version')::int=c.version;
create table public.docencia_asignaciones_recordatorios (
 asignacion_id uuid primary key references public.docencia_asignaciones(id),
 id uuid not null unique,
 version integer not null,
 solicitud_id uuid not null references public.docencia_asignaciones_correos(id),
 estado text not null default 'preparado' check(estado in ('preparado','enviando','enviado','incierto','cancelado')),
 destinatario text not null,
 copia_oculta text not null default 'jpintov@gmail.com',
 copia_estado text not null default 'sin_registro' check(copia_estado in ('sin_registro','aceptada','sin_confirmar')),
 asunto text not null,texto text not null,html text not null,message_id text,
 creado_en timestamptz not null default now(),finalizado_en timestamptz
);
alter table public.docencia_asignaciones_recordatorios enable row level security;
alter table public.docencia_asignaciones_recordatorios force row level security;
revoke all on public.docencia_asignaciones_recordatorios from public,anon,authenticated;
grant select,insert,update on public.docencia_asignaciones_recordatorios to service_role;

create function public.docencia_recordatorio_contexto(p_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'estado',case when r.estado is not null then r.estado when not a.vigente then 'anulada'
   when p.trabajos is not null then 'publicado' when c.id is null then 'sin_solicitud'
   when exists(select 1 from public.docencia_asignaciones_correos pc where pc.asignacion_id=a.id and pc.estado='preparado') then 'solicitud_pendiente'
   when now() < ((a.fecha_entrega+7)+a.hora_entrega) at time zone 'America/Santiago' then 'programado' else 'pendiente' end,
 'publicado',p.trabajos is not null,'trabajos_publicados',coalesce(p.trabajos,'[]'::jsonb),
 'programado_para',((a.fecha_entrega+7)+a.hora_entrega) at time zone 'America/Santiago',
 'solicitud_id',c.id,'solicitud_enviada_en',c.finalizado_en,
 'id',r.id,'creado_en',r.creado_en,'finalizado_en',r.finalizado_en,'copia_estado',r.copia_estado)
 from public.docencia_asignaciones a join public.usuarios u on u.id=a.usuario_id
 left join lateral(select c.id,c.finalizado_en from public.docencia_asignaciones_correos c
  where c.asignacion_id=a.id and c.estado='enviado' and c.finalizado_en is not null
   and c.usuario_id=a.usuario_id and c.codigo=a.codigo and lower(c.destinatario)=lower(u.email)
  order by c.finalizado_en,c.id limit 1) c on true
 left join lateral(select jsonb_agg(jsonb_build_object('id',m.id,'titulo',m.titulo) order by m.numero_orden) trabajos
  from public.modulos m where m.activo and (m.unidad_codigo=a.codigo or exists(select 1 from public.modulos_temas mt where mt.modulo_id=m.id and mt.codigo=a.codigo))) p on true
 left join public.docencia_asignaciones_recordatorios r on r.asignacion_id=a.id
 where a.id=p_id;
$$;
revoke all on function public.docencia_recordatorio_contexto(uuid) from public,anon,authenticated;
grant execute on function public.docencia_recordatorio_contexto(uuid) to service_role;

create or replace function public.docencia_asignacion_contexto(p_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(a)||jsonb_build_object('nombre',u.nombre,'email',u.email,'tema',t.detalle,
 'unidad',un.detalle,'subunidad',su.detalle,'recordatorio',public.docencia_recordatorio_contexto(a.id),
 'correos',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'estado',c.estado,'version',c.version,'creado_en',c.creado_en,'finalizado_en',c.finalizado_en,'copia_estado',c.copia_estado) order by c.creado_en desc)
 from public.docencia_asignaciones_correos c where c.asignacion_id=a.id),'[]'::jsonb))
 from public.docencia_asignaciones a join public.usuarios u on u.id=a.usuario_id
 join public.unidades_docencia t on t.codigo=a.codigo
 left join public.unidades_docencia un on un.codigo=left(a.codigo,6)||'00'
 left join public.unidades_docencia su on su.codigo=left(a.codigo,7)||'0' where a.id=p_id;
$$;

create function public.docencia_recordatorios_servicio(p_accion text,p_datos jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.docencia_asignaciones%rowtype;r public.docencia_asignaciones_recordatorios%rowtype;
 ctx jsonb;v_id uuid;v_intento uuid;v_correo jsonb;v_email text;v_n integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Servicio exclusivo del servidor' using errcode='42501';end if;
 if p_accion='candidatos' then
  return coalesce((select jsonb_agg(public.docencia_asignacion_contexto(x.id)) from (
   select a.id from public.docencia_asignaciones a where a.vigente and public.docencia_recordatorio_contexto(a.id)->>'estado'='pendiente'
   order by a.fecha_entrega,a.id limit 100) x),'[]'::jsonb);
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
    values(a.id,v_intento,a.version,(ctx->>'solicitud_id')::uuid,v_email,v_correo->>'subject',v_correo->>'text',v_correo->>'html') on conflict do nothing;
   get diagnostics v_n=row_count;return jsonb_build_object('enviar',v_n=1);
  end if;
  select * into r from public.docencia_asignaciones_recordatorios where asignacion_id=a.id and id=v_intento for update;
  if not found or r.estado<>'preparado' then return jsonb_build_object('enviar',false);end if;
  select email into v_email from public.usuarios where id=a.usuario_id and es_admin is not true and lower(email)<>'dummy@ofl.cl';
  if not a.vigente or a.version<>r.version or coalesce((ctx->>'publicado')::boolean,true)
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

create or replace function public.admin_asignaciones_docentes(p_actor uuid,p_accion text,p_datos jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.docencia_asignaciones%rowtype; nuevo public.docencia_asignaciones%rowtype;
 v_id uuid; v_usuario uuid; v_codigo text; v_fecha date; v_entrega date; v_correo uuid; v_email text; v_msg jsonb;
begin
 if auth.role() is distinct from 'service_role' or not exists(
 select 1 from public.usuarios u
 where u.auth_user_id=p_actor and u.es_admin is true and lower(u.email)='jpintov@gmail.com')
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
end $$;
revoke all on function public.admin_asignaciones_docentes(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_asignaciones_docentes(uuid,text,jsonb) to service_role;
