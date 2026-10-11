-- Doctrina Superadmin administration, staged migration; NOT applied to production.
-- Never infer privilege from Docencia legacy roles.
create table if not exists doctrina.superadmin_auditoria (
 id bigint generated always as identity primary key,
 actor uuid not null references auth.users(id),
 objetivo uuid not null references auth.users(id),
 accion text not null check (accion in ('ACTIVAR','REVOCAR')),
 motivo text not null check (length(trim(motivo)) between 10 and 1000),
 fecha timestamptz not null default now()
);
alter table doctrina.superadmin_auditoria enable row level security;
revoke all on doctrina.superadmin_auditoria from public, anon, authenticated;

create or replace function public.doctrina_admin_listar()
returns table(auth_user_id uuid, email text, activo boolean, creado_en timestamptz)
language sql stable security definer set search_path = '' as $$
 select s.auth_user_id, u.email::text, s.activo, s.creado_en
 from doctrina.superadmins s join auth.users u on u.id=s.auth_user_id
 where public.doctrina_es_superadmin()
 order by s.creado_en desc
$$;
revoke all on function public.doctrina_admin_listar() from public, anon;
grant execute on function public.doctrina_admin_listar() to authenticated;

create or replace function public.doctrina_admin_cambiar(p_email text,p_activo boolean,p_motivo text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_target uuid; v_active boolean;
begin
 if v_actor is null or not public.doctrina_es_superadmin() then raise exception 'Acceso denegado'; end if;
 if p_email is null or p_activo is null or p_motivo is null or length(trim(p_motivo)) not between 10 and 1000 then raise exception 'Parámetros inválidos'; end if;
 select id into v_target from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null;
 if v_target is null then raise exception 'Usuario no verificado'; end if;
 -- Serialize concurrent admin mutations to prevent removing all active administrators.
 perform pg_advisory_xact_lock(146, 2026);
 if not p_activo and v_target=v_actor then raise exception 'No puede revocar su propio acceso'; end if;
 if not p_activo and (select count(*) from doctrina.superadmins where activo) <= 1 then raise exception 'Debe conservarse un Superadmin'; end if;
 insert into doctrina.superadmins(auth_user_id,activo,fundamento,autorizado_por)
 values(v_target,p_activo,trim(p_motivo),v_actor)
 on conflict(auth_user_id) do update set activo=excluded.activo,fundamento=excluded.fundamento,autorizado_por=excluded.autorizado_por,actualizado_en=now();
 insert into doctrina.superadmin_auditoria(actor,objetivo,accion,motivo)
 values(v_actor,v_target,case when p_activo then 'ACTIVAR' else 'REVOCAR' end,trim(p_motivo));
 return true;
end $$;
revoke all on function public.doctrina_admin_cambiar(text,boolean,text) from public, anon;
grant execute on function public.doctrina_admin_cambiar(text,boolean,text) to authenticated;

create or replace function public.doctrina_admin_auditoria()
returns table(fecha timestamptz, actor uuid, objetivo uuid, accion text, motivo text)
language sql stable security definer set search_path = '' as $$
 select a.fecha,a.actor,a.objetivo,a.accion,a.motivo
 from doctrina.superadmin_auditoria a
 where public.doctrina_es_superadmin()
 order by a.fecha desc limit 100
$$;
revoke all on function public.doctrina_admin_auditoria() from public, anon;
grant execute on function public.doctrina_admin_auditoria() to authenticated;
