-- Ampliación compatible: los comentarios existentes siguen siendo raíces.
alter table public.comentarios_muro add column if not exists comentario_padre_id uuid;
alter table public.comentarios_muro add column if not exists solicitud_id uuid;
create unique index if not exists comentarios_muro_contexto_hilo on public.comentarios_muro(id,progreso_id,modulo_id);
create index if not exists comentarios_muro_padre on public.comentarios_muro(comentario_padre_id) where comentario_padre_id is not null;
create unique index if not exists comentarios_muro_solicitud on public.comentarios_muro(usuario_id,solicitud_id) where solicitud_id is not null;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.comentarios_muro'::regclass and conname='comentario_padre_mismo_contexto') then
  alter table public.comentarios_muro add constraint comentario_padre_mismo_contexto
   foreign key(comentario_padre_id,progreso_id,modulo_id)
   references public.comentarios_muro(id,progreso_id,modulo_id);
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.comentarios_muro'::regclass and conname='comentario_no_autorreferencia') then
  alter table public.comentarios_muro add constraint comentario_no_autorreferencia check(comentario_padre_id is distinct from id);
 end if;
end $$;

-- Integridad independiente del cliente: un comentario no puede cambiar de hilo.
create or replace function public.validar_contexto_hilo_comentario()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.comentario_padre_id is distinct from old.comentario_padre_id
  or new.progreso_id is distinct from old.progreso_id or new.modulo_id is distinct from old.modulo_id
  or new.usuario_id is distinct from old.usuario_id or new.id is distinct from old.id
  or new.solicitud_id is distinct from old.solicitud_id) then
  raise exception 'No se puede trasladar un comentario ni cambiar su autor o solicitud' using errcode='42501';
 end if;
 if tg_op='INSERT' and new.comentario_padre_id is not null then
  if new.progreso_id is null or new.modulo_id is null or not exists(
   select 1 from public.comentarios_muro p
   where p.id=new.comentario_padre_id and p.progreso_id=new.progreso_id and p.modulo_id=new.modulo_id and p.activo is true
  ) or not exists(select 1 from public.progreso_maestro mi join public.modulos m on m.id=mi.modulo_id and m.activo is true
   where mi.usuario_id=new.usuario_id and mi.modulo_id=new.modulo_id and mi.completado is true)
  then raise exception 'Comentario de origen no disponible en este trabajo' using errcode='23514'; end if;
 end if;
 return new;
end $$;
revoke all on function public.validar_contexto_hilo_comentario() from public,anon,authenticated;
drop trigger if exists trg_contexto_hilo_comentario on public.comentarios_muro;
create trigger trg_contexto_hilo_comentario before insert or update on public.comentarios_muro
 for each row execute function public.validar_contexto_hilo_comentario();

-- La identidad y la reserva docente se comprueban en servidor. La firma anterior
-- para comentarios raíz no cambia. La solicitud hace seguros los reintentos.
create or replace function public.maestro_responder_comentario(
 p_comentario_padre_id uuid,p_contenido text,p_solicitud_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; padre public.comentarios_muro%rowtype; previo public.comentarios_muro%rowtype; texto text; nuevo uuid;
begin
 select a.legacy_user_id into actor from public.maestro_identidad_actual() a
 where a.auth_user_id=(select auth.uid()) and a.rol='USER';
 if actor is null then raise exception 'Sesión de participante requerida' using errcode='42501'; end if;
 texto:=btrim(coalesce(p_contenido,''));
 if length(texto) not between 5 and 1500 or p_solicitud_id is null then
  raise exception 'Escriba entre 5 y 1500 caracteres y vuelva a intentar' using errcode='22023';
 end if;
 -- Serializa solamente las publicaciones del mismo participante.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
 select c.* into padre from public.comentarios_muro c
 join public.progreso_maestro p on p.id=c.progreso_id and p.modulo_id=c.modulo_id and p.completado is true
 join public.modulos m on m.id=c.modulo_id and m.activo is true
 join public.usuarios autor on autor.id=c.usuario_id and autor.es_admin is not true
 where c.id=p_comentario_padre_id and c.activo is true for share of c;
 if padre.id is null or not exists(select 1 from public.progreso_maestro p
   where p.usuario_id=actor and p.modulo_id=padre.modulo_id and p.completado is true) then
  raise exception 'Complete este trabajo para responder a un comentario disponible' using errcode='42501';
 end if;
 select * into previo from public.comentarios_muro where usuario_id=actor and solicitud_id=p_solicitud_id;
 if previo.id is not null then
  if previo.comentario_padre_id is distinct from padre.id or previo.contenido_original is distinct from texto then
   raise exception 'Esta solicitud ya fue publicada. Actualice el muro antes de escribir otra respuesta' using errcode='22023';
  end if;
  return previo.id;
 end if;
 if (select count(*) from public.comentarios_muro where usuario_id=actor and creado_en>now()-interval '1 minute')>=5 then
  raise exception 'Espere un minuto antes de publicar otra respuesta' using errcode='22023';
 end if;
 insert into public.comentarios_muro(progreso_id,modulo_id,usuario_id,contenido,contenido_original,editado,activo,ip_origen,comentario_padre_id,solicitud_id)
 values(padre.progreso_id,padre.modulo_id,actor,texto,texto,false,true,null,padre.id,p_solicitud_id) returning id into nuevo;
 return nuevo;
end $$;
revoke all on function public.maestro_responder_comentario(uuid,text,uuid) from public,anon;
grant execute on function public.maestro_responder_comentario(uuid,text,uuid) to authenticated;

create or replace function public.muro_docente_autorizado(p_modulo uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid; administrador boolean; resultado jsonb;
begin
 select id,coalesce(es_admin,false) into actor,administrador from public.usuarios where auth_user_id=auth.uid();
 if actor is null then raise exception 'Sesión docente requerida' using errcode='42501'; end if;
 if not administrador and not exists(select 1 from public.progreso_maestro where usuario_id=actor and completado) then
  raise exception 'Complete un trabajo para acceder al muro' using errcode='42501';
 end if;
 with permitidos as (
  select m.id,m.numero_orden,m.titulo from public.modulos m where m.activo and (p_modulo is null or m.id=p_modulo)
   and (administrador or exists(select 1 from public.progreso_maestro p where p.modulo_id=m.id and p.usuario_id=actor and p.completado))
 ), aportes as (
  select p.id,p.reflexion,p.completado_en,p.modulo_id,p.usuario_id,
   jsonb_build_object('nombre',u.nombre) usuarios,jsonb_build_object('numero_orden',m.numero_orden,'titulo',m.titulo) modulos
  from public.progreso_maestro p join permitidos m on m.id=p.modulo_id join public.usuarios u on u.id=p.usuario_id
  where p.completado and nullif(trim(p.reflexion),'') is not null and u.es_admin is not true
 ), comentarios as (
  select c.id,c.progreso_id,c.usuario_id,c.comentario_padre_id,c.contenido,c.editado,c.editado_en,c.creado_en,
    jsonb_build_object('nombre',u.nombre) usuarios
  from public.comentarios_muro c join aportes p on p.id=c.progreso_id and p.modulo_id=c.modulo_id
   join public.usuarios u on u.id=c.usuario_id where c.activo and u.es_admin is not true
 )
 select jsonb_build_object('aportes',coalesce((select jsonb_agg(a order by a.completado_en desc) from aportes a),'[]'::jsonb),
   'comentarios',coalesce((select jsonb_agg(c order by c.creado_en) from comentarios c),'[]'::jsonb)) into resultado;
 return resultado;
end $$;
revoke all on function public.muro_docente_autorizado(uuid) from public,anon;
grant execute on function public.muro_docente_autorizado(uuid) to authenticated;


notify pgrst, 'reload schema';
