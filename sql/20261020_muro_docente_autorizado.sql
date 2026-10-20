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
  select c.id,c.progreso_id,c.usuario_id,c.contenido,c.editado,c.editado_en,c.creado_en,
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
