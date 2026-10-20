alter table public.registro_accesos
 add column if not exists ultima_actividad_en timestamptz,
 add column if not exists ultimo_latido_en timestamptz,
 add column if not exists cerrado_en timestamptz,
 add column if not exists segundos_activos integer,
 add column if not exists seguimiento_version integer;
create or replace function public.bitacora_sesion_servidor(p_actor uuid,p_accion text,p_sesion uuid,p_ip text default null,p_activo boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p record; r public.registro_accesos%rowtype; t timestamptz:=clock_timestamp(); incremento integer:=0;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_accion not in ('iniciar','latido','cerrar') or p_accion is null or p_sesion is null then raise exception 'Solicitud inválida'; end if;
 select id,nombre,email into p from public.usuarios where auth_user_id=p_actor;
 if not found then raise exception 'Perfil no vinculado' using errcode='42501'; end if;
 if p_accion='iniciar' then
  insert into public.registro_accesos(id,usuario_id,nombre,email,ip_origen,fecha_acceso,creado_en,ultima_actividad_en,ultimo_latido_en,segundos_activos,seguimiento_version)
  values(p_sesion,p.id,p.nombre,p.email,p_ip,t,t,t,t,0,1)
  on conflict(id) do nothing;
 end if;
 select * into r from public.registro_accesos where id=p_sesion and usuario_id=p.id and seguimiento_version=1 for update;
 if not found then raise exception 'Sesión no encontrada' using errcode='42501'; end if;
 if r.cerrado_en is not null then return jsonb_build_object('id',r.id,'cerrada',true); end if;
 if p_accion<>'iniciar' then
  -- Tiempo medido por servidor. Nunca sumar huecos largos de conexión ni cifras del cliente.
  if p_activo and t-r.ultimo_latido_en <= interval '60 seconds' then
   incremento:=greatest(0,floor(extract(epoch from t-r.ultimo_latido_en))::integer);
  end if;
  update public.registro_accesos set ultimo_latido_en=t,
   ultima_actividad_en=case when p_activo then t else ultima_actividad_en end,
   segundos_activos=coalesce(segundos_activos,0)+incremento,
   cerrado_en=case when p_accion='cerrar' then t else null end
  where id=r.id;
 end if;
 return jsonb_build_object('id',r.id,'cerrada',p_accion='cerrar');
end $$;
revoke all on function public.bitacora_sesion_servidor(uuid,text,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.bitacora_sesion_servidor(uuid,text,uuid,text,boolean) to service_role;
