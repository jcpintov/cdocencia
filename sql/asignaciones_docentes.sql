create table public.docencia_asignaciones (
 id uuid primary key default gen_random_uuid(),
 usuario_id uuid not null references public.usuarios(id) on delete restrict,
 codigo text not null references public.unidades_docencia(codigo) on update cascade on delete restrict,
 fecha_asignacion date not null,
 fecha_entrega date not null,
 hora_entrega time not null default '23:30' check(hora_entrega='23:30'),
 vigente boolean not null default true,
 version integer not null default 1 check(version>0),
 creado_por uuid not null references auth.users(id),
 actualizado_por uuid not null references auth.users(id),
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now(),
 check(fecha_entrega>=fecha_asignacion)
);
create unique index docencia_asignaciones_tema_vigente on public.docencia_asignaciones(codigo) where vigente;
create index docencia_asignaciones_usuario on public.docencia_asignaciones(usuario_id);
create table public.docencia_asignaciones_historial (
 id bigint generated always as identity primary key,
 asignacion_id uuid not null references public.docencia_asignaciones(id),
 actor uuid not null references auth.users(id),
 accion text not null,
 anterior jsonb,
 posterior jsonb,
 creado_en timestamptz not null default now()
);
create index docencia_asignaciones_historial_asignacion on public.docencia_asignaciones_historial(asignacion_id);
create table public.docencia_asignaciones_correos (
 id uuid primary key,
 asignacion_id uuid not null references public.docencia_asignaciones(id),
 version integer not null,
 estado text not null default 'preparado' check(estado in ('preparado','enviado','incierto')),
 destinatario text not null,
 asunto text not null,
 texto text not null,
 html text not null,
 message_id text,
 creado_por uuid not null references auth.users(id),
 creado_en timestamptz not null default now(),
 finalizado_en timestamptz
);
create index docencia_asignaciones_correos_asignacion on public.docencia_asignaciones_correos(asignacion_id,creado_en desc);
create unique index docencia_asignaciones_un_envio on public.docencia_asignaciones_correos(asignacion_id) where estado='preparado';
alter table public.docencia_asignaciones enable row level security;
alter table public.docencia_asignaciones force row level security;
alter table public.docencia_asignaciones_historial enable row level security;
alter table public.docencia_asignaciones_historial force row level security;
alter table public.docencia_asignaciones_correos enable row level security;
alter table public.docencia_asignaciones_correos force row level security;
revoke all on public.docencia_asignaciones,public.docencia_asignaciones_historial,public.docencia_asignaciones_correos from public,anon,authenticated;
grant select,insert,update on public.docencia_asignaciones,public.docencia_asignaciones_historial,public.docencia_asignaciones_correos to service_role;
grant usage on sequence public.docencia_asignaciones_historial_id_seq to service_role;

create function public.docencia_asignacion_contexto(p_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(a)||jsonb_build_object('nombre',u.nombre,'email',u.email,'tema',t.detalle,
 'unidad',un.detalle,'subunidad',su.detalle,
 'correos',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'estado',c.estado,'version',c.version,'creado_en',c.creado_en,'finalizado_en',c.finalizado_en) order by c.creado_en desc)
 from public.docencia_asignaciones_correos c where c.asignacion_id=a.id),'[]'::jsonb))
 from public.docencia_asignaciones a join public.usuarios u on u.id=a.usuario_id
 join public.unidades_docencia t on t.codigo=a.codigo
 left join public.unidades_docencia un on un.codigo=left(a.codigo,6)||'00'
 left join public.unidades_docencia su on su.codigo=left(a.codigo,7)||'0'
 where a.id=p_id;
$$;
revoke all on function public.docencia_asignacion_contexto(uuid) from public,anon,authenticated;
grant execute on function public.docencia_asignacion_contexto(uuid) to service_role;

create function public.admin_asignaciones_docentes(p_actor uuid,p_accion text,p_datos jsonb default '{}'::jsonb)
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
  insert into public.docencia_asignaciones_correos(id,asignacion_id,version,destinatario,asunto,texto,html,creado_por)
  values(v_correo,r.id,r.version,v_email,v_msg->>'subject',v_msg->>'text',v_msg->>'html',p_actor);
  return jsonb_build_object('enviar',true);
 end if;
 if p_accion in ('finalizar_correo','cerrar_intento') then
  v_correo:=(p_datos->>'intento')::uuid;
  if p_accion='cerrar_intento' and not exists(select 1 from public.docencia_asignaciones_correos where id=v_correo and asignacion_id=r.id and estado='preparado' and creado_en<now()-interval '2 minutes') then
   raise exception 'Espere dos minutos y revise antes de cerrar el intento' using errcode='55000';end if;
  update public.docencia_asignaciones_correos set estado=case when p_accion='finalizar_correo' and p_datos->>'estado'='enviado' then 'enviado' else 'incierto' end,
   message_id=left(p_datos->>'message_id',500),finalizado_en=clock_timestamp()
   where id=v_correo and asignacion_id=r.id and estado='preparado';
  return jsonb_build_object('ok',found);
 end if;
 raise exception 'Acción no admitida' using errcode='22023';
end $$;
revoke all on function public.admin_asignaciones_docentes(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_asignaciones_docentes(uuid,text,jsonb) to service_role;
