-- Preparado para revisión conjunta; no aplicado a producción.
create table if not exists doctrina.cambios_perfil(
 id uuid primary key,actor uuid not null references auth.users(id),email_anterior text not null,nombre text not null,email_nuevo text not null,
 codigo_hash text not null check(codigo_hash~'^[0-9a-f]{64}$'),intentos integer not null default 0,
 estado text not null check(estado in ('preparado','enviado','autorizado','consumido','fallido','recuperacion')),
 creado_en timestamptz not null default now(),autorizado_en timestamptz,completado_en timestamptz,expira_en timestamptz not null default now()+interval '10 minutes'
);
alter table doctrina.cambios_perfil enable row level security;
revoke all on doctrina.cambios_perfil from public,anon,authenticated;
create or replace function public.superadmin_perfil_codigo(p_actor uuid,p_accion text,p_datos jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u public.usuarios; a auth.users; c doctrina.cambios_perfil;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Acceso denegado' using errcode='42501'; end if;
 select * into u from public.usuarios where auth_user_id=p_actor and es_admin for update;
 select * into a from auth.users where id=p_actor;
 if u.id is null or a.id is null or not(lower(a.email)='jpintov@gmail.com' or coalesce(a.raw_app_meta_data->>'superadmin_principal','false')='true') then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_accion='pendiente' then
  select * into c from doctrina.cambios_perfil where actor=p_actor and (estado in ('autorizado','recuperacion') or (estado='enviado' and expira_en>now() and intentos<5)) order by creado_en desc limit 1;
  if not found then return jsonb_build_object('pendiente',false); end if;
  return jsonb_build_object('pendiente',true,'estado',c.estado,'id',c.id,'nombre',c.nombre,'email_nuevo',c.email_nuevo);
 end if;
 if p_accion='solicitar' then
  if lower(a.email)<>lower(u.email) then return jsonb_build_object('error','Hay un cambio de identidad pendiente de completar'); end if;
  if exists(select 1 from doctrina.cambios_perfil where actor=p_actor and creado_en>now()-interval '1 minute') then return jsonb_build_object('error','Espere un minuto antes de solicitar otro código'); end if;
  if exists(select 1 from doctrina.cambios_perfil where actor=p_actor and estado in ('autorizado','recuperacion')) then return jsonb_build_object('error','Complete el cambio pendiente antes de iniciar otro'); end if;
  if length(btrim(p_datos->>'nombre')) not between 3 and 150 or length(p_datos->>'email')>254 or p_datos->>'email'!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Datos no válidos'; end if;
  if exists(select 1 from public.usuarios where lower(email)=lower(p_datos->>'email') and id<>u.id) or exists(select 1 from auth.users where lower(email)=lower(p_datos->>'email') and id<>a.id) then return jsonb_build_object('error','El correo ya está registrado'); end if;
  update doctrina.cambios_perfil set estado='fallido' where actor=p_actor and estado in ('preparado','enviado');
  insert into doctrina.cambios_perfil(id,actor,email_anterior,nombre,email_nuevo,codigo_hash,estado) values((p_datos->>'id')::uuid,p_actor,u.email,btrim(p_datos->>'nombre'),lower(p_datos->>'email'),p_datos->>'hash','preparado') returning * into c;
 else
  select * into c from doctrina.cambios_perfil where id=(p_datos->>'id')::uuid and actor=p_actor for update;
  if not found then return jsonb_build_object('error','Solicitud no válida'); end if;
  if p_accion='habilitar' and c.estado='preparado' then update doctrina.cambios_perfil set estado='enviado' where id=c.id;
  elsif p_accion='validar' then
   if c.estado<>'enviado' or c.expira_en<=now() or c.intentos>=5 or lower(u.email)<>lower(c.email_anterior) or lower(a.email)<>lower(c.email_anterior) then return jsonb_build_object('error','Código inválido o vencido'); end if;
   update doctrina.cambios_perfil set intentos=intentos+1 where id=c.id;
   if c.codigo_hash<>p_datos->>'hash' then return jsonb_build_object('error','Código inválido o vencido'); end if;
   update doctrina.cambios_perfil set estado='autorizado',autorizado_en=now() where id=c.id;
  elsif p_accion='recuperar' then
   if (c.estado not in ('autorizado','recuperacion') and not(c.estado='consumido' and lower(u.email)=lower(c.email_nuevo) and u.nombre=c.nombre)) or lower(a.email) not in (lower(c.email_anterior),lower(c.email_nuevo)) then return jsonb_build_object('error','No hay un cambio autorizado que recuperar'); end if;
  elsif p_accion='finalizar' then
   if c.estado='consumido' and lower(a.email)=lower(c.email_nuevo) and lower(u.email)=lower(c.email_nuevo) and u.nombre=c.nombre then return jsonb_build_object('id',c.id,'nombre',u.nombre,'email_nuevo',u.email); end if;
   if c.estado not in ('autorizado','recuperacion') or lower(a.email)<>lower(c.email_nuevo) or lower(u.email)<>lower(c.email_anterior) then return jsonb_build_object('error','El cambio requiere recuperación'); end if;
   update public.usuarios set nombre=c.nombre,email=c.email_nuevo where id=u.id;
   update doctrina.cambios_perfil set estado='consumido',completado_en=now() where id=c.id;
  elsif p_accion='fallido' or p_accion='recuperacion' then
   update doctrina.cambios_perfil set estado=p_accion where id=c.id and estado<>'consumido';
  else return jsonb_build_object('error','Solicitud no válida'); end if;
 end if;
 return jsonb_build_object('id',c.id,'email_anterior',c.email_anterior,'nombre',c.nombre,'email_nuevo',c.email_nuevo);
end $$;
revoke all on function public.superadmin_perfil_codigo(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.superadmin_perfil_codigo(uuid,text,jsonb) to service_role;
