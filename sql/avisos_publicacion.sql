-- Avisos únicamente para nuevas publicaciones de trabajos asignados. Sin envíos retroactivos.
create table public.docencia_publicaciones_correos (
 id uuid primary key default gen_random_uuid(),
 modulo_id uuid references public.modulos(id) on delete set null,
 usuario_id uuid not null references public.usuarios(id),
 codigo text not null references public.unidades_docencia(codigo),
 tema text not null,
 estado text not null default 'pendiente' check(estado in ('pendiente','preparado','enviando','enviado','incierto','cancelado')),
 destinatario text not null,copia_oculta text not null default 'jpintov@gmail.com',
 copia_estado text not null default 'sin_registro' check(copia_estado in ('sin_registro','aceptada','sin_confirmar')),
 intento uuid unique,asunto text,texto text,html text,message_id text,
 creado_en timestamptz not null default now(),finalizado_en timestamptz,
 unique(modulo_id,usuario_id)
);
alter table public.docencia_publicaciones_correos enable row level security;
alter table public.docencia_publicaciones_correos force row level security;
revoke all on public.docencia_publicaciones_correos from public,anon,authenticated;
grant select,insert,update on public.docencia_publicaciones_correos to service_role;
create index docencia_publicaciones_pendientes on public.docencia_publicaciones_correos(creado_en) where estado='pendiente';

create function public.docencia_nombre_autor(p_nombre text) returns text language sql immutable security invoker set search_path='' as $$
 select trim(regexp_replace(translate(upper(regexp_replace(coalesce(p_nombre,''),'^[[:space:]]*(Q[.·:[:space:]]*H|V[.·:[:space:]]*M)[.·:[:space:]]*','','i')),'ÁÉÍÓÚÜ','AEIOUU'),'[[:space:]]+',' ','g'));
$$;
revoke all on function public.docencia_nombre_autor(text) from public,anon,authenticated;
grant execute on function public.docencia_nombre_autor(text) to service_role;
create schema if not exists docencia_interna;
revoke all on schema docencia_interna from public,anon,authenticated;
create function docencia_interna.encolar_aviso_publicacion() returns trigger
 language plpgsql security definer set search_path='' as $$
declare v_modulo uuid;v_usuario uuid;v_n bigint;v_codigo text;m public.modulos%rowtype;
begin
 if auth.role() is distinct from 'service_role' and session_user not in ('postgres','supabase_admin') and not exists(
  select 1 from public.usuarios where auth_user_id=auth.uid() and es_admin and lower(email)='jpintov@gmail.com') then return new;end if;
 if tg_table_name='modulos' then v_modulo:=new.id;
  if tg_op='UPDATE' and new.activo is not distinct from old.activo and new.unidad_codigo is not distinct from old.unidad_codigo and new.autor is not distinct from old.autor then return new;end if;
 else v_modulo:=new.modulo_id;end if;
 select * into m from public.modulos where id=v_modulo and activo;
 if not found then return new;end if;
 select min(u.id::text)::uuid,count(*) into v_usuario,v_n from public.usuarios u
  where not u.es_admin and lower(u.email)<>'dummy@ofl.cl' and public.docencia_nombre_autor(u.nombre)=public.docencia_nombre_autor(m.autor)
   and public.docencia_nombre_autor(m.autor)<>'';
 if v_n<>1 then return new;end if;
 for v_codigo in select t.codigo from public.unidades_docencia t where (t.codigo=m.unidad_codigo or exists(
  select 1 from public.modulos_temas mt where mt.modulo_id=m.id and mt.codigo=t.codigo)) and exists(
  select 1 from public.docencia_asignaciones a where a.vigente and a.usuario_id=v_usuario and a.codigo=t.codigo) order by case when t.codigo=m.unidad_codigo then 0 else 1 end,t.orden limit 1
 loop
  insert into public.docencia_publicaciones_correos(modulo_id,usuario_id,codigo,tema,destinatario)
   select m.id,u.id,v_codigo,m.titulo,u.email from public.usuarios u where u.id=v_usuario on conflict do nothing;
 end loop;
 return new;
end $$;
revoke all on function docencia_interna.encolar_aviso_publicacion() from public,anon,authenticated;
create trigger docencia_aviso_modulo after insert or update of activo,unidad_codigo,autor on public.modulos for each row execute function docencia_interna.encolar_aviso_publicacion();
create trigger docencia_aviso_tema after insert on public.modulos_temas for each row execute function docencia_interna.encolar_aviso_publicacion();

create function public.docencia_publicaciones_servicio(p_accion text,p_datos jsonb default '{}'::jsonb)
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.docencia_publicaciones_correos%rowtype;m public.modulos%rowtype;v_correo jsonb;v_email text;v_nombre text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Servicio exclusivo del servidor' using errcode='42501';end if;
 if p_accion='candidatos' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'nombre',u.nombre,'email',u.email,'tema',x.tema,'codigo',x.codigo)) from (
   select * from public.docencia_publicaciones_correos where estado='pendiente' order by creado_en limit 100) x join public.usuarios u on u.id=x.usuario_id),'[]'::jsonb);
 end if;
 select * into r from public.docencia_publicaciones_correos where id=(p_datos->>'id')::uuid for update;
 if not found then return jsonb_build_object('enviar',false,'ok',false);end if;
 if p_accion in ('reservar','confirmar') then
  if (p_accion='reservar' and r.estado<>'pendiente') or (p_accion='confirmar' and (r.estado<>'preparado' or r.intento is distinct from (p_datos->>'intento')::uuid)) then return jsonb_build_object('enviar',false);end if;
  select * into m from public.modulos where id=r.modulo_id and activo;
  select email,nombre into v_email,v_nombre from public.usuarios where id=r.usuario_id and not es_admin and lower(email)<>'dummy@ofl.cl';
  if m.id is null or v_email is null or lower(v_email)<>lower(r.destinatario) or m.titulo<>r.tema
   or public.docencia_nombre_autor(v_nombre)<>public.docencia_nombre_autor(m.autor)
   or (select count(*) from public.usuarios u where not u.es_admin and public.docencia_nombre_autor(u.nombre)=public.docencia_nombre_autor(m.autor))<>1
   or not exists(select 1 from public.docencia_asignaciones where vigente and usuario_id=r.usuario_id and codigo=r.codigo)
   or not(coalesce(m.unidad_codigo=r.codigo,false) or exists(select 1 from public.modulos_temas where modulo_id=m.id and codigo=r.codigo)) then
   update public.docencia_publicaciones_correos set estado='cancelado',finalizado_en=clock_timestamp() where id=r.id;return jsonb_build_object('enviar',false);
  end if;
  if p_accion='reservar' then
   v_correo:=p_datos->'correo';
   if lower(v_correo->>'to') is distinct from lower(v_email) or (p_datos->>'intento') is null or nullif(v_correo->>'html','') is null then raise exception 'Correo no válido' using errcode='22023';end if;
   update public.docencia_publicaciones_correos set estado='preparado',intento=(p_datos->>'intento')::uuid,asunto=v_correo->>'subject',texto=v_correo->>'text',html=v_correo->>'html' where id=r.id;
  else update public.docencia_publicaciones_correos set estado='enviando' where id=r.id;end if;
  return jsonb_build_object('enviar',true);
 end if;
 if p_accion='finalizar' then
  update public.docencia_publicaciones_correos set estado=case when p_datos->>'estado'='enviado' then 'enviado' else 'incierto' end,
   copia_estado=case when p_datos->>'copia_estado'='aceptada' then 'aceptada' else 'sin_confirmar' end,
   message_id=left(p_datos->>'message_id',500),finalizado_en=clock_timestamp()
   where id=r.id and intento=(p_datos->>'intento')::uuid and estado in ('preparado','enviando');
  return jsonb_build_object('ok',found);
 end if;
 raise exception 'Acción no admitida' using errcode='22023';
end $$;
revoke all on function public.docencia_publicaciones_servicio(text,jsonb) from public,anon,authenticated;
grant execute on function public.docencia_publicaciones_servicio(text,jsonb) to service_role;

create or replace function public.docencia_asignacion_contexto(p_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(a)||jsonb_build_object('nombre',u.nombre,'email',u.email,'tema',t.detalle,
 'unidad',un.detalle,'subunidad',su.detalle,'recordatorio',public.docencia_recordatorio_contexto(a.id),
 'avisos_publicacion',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'codigo',p.codigo,'tema',p.tema,'estado',p.estado,'creado_en',p.creado_en,'finalizado_en',p.finalizado_en,'copia_estado',p.copia_estado) order by p.creado_en desc) from public.docencia_publicaciones_correos p where p.usuario_id=a.usuario_id and p.codigo=a.codigo),'[]'::jsonb),
 'correos',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'estado',c.estado,'version',c.version,'creado_en',c.creado_en,'finalizado_en',c.finalizado_en,'copia_estado',c.copia_estado) order by c.creado_en desc)
 from public.docencia_asignaciones_correos c where c.asignacion_id=a.id),'[]'::jsonb))
 from public.docencia_asignaciones a join public.usuarios u on u.id=a.usuario_id
 join public.unidades_docencia t on t.codigo=a.codigo
 left join public.unidades_docencia un on un.codigo=left(a.codigo,6)||'00'
 left join public.unidades_docencia su on su.codigo=left(a.codigo,7)||'0' where a.id=p_id;
$$;

