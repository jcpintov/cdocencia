-- Preparado sin aplicar: archivo de la cuenta Dummy y bloqueo de reactivación.
alter table public.usuarios add column if not exists cuenta_eliminada boolean not null default false;
CREATE OR REPLACE FUNCTION public.primer_acceso_emitir(p_email text, p_codigo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_old public.primer_acceso_codigos%rowtype;
begin
 if exists(select 1 from public.usuarios where lower(email)=lower(p_email) and cuenta_eliminada) then return false; end if;
 if auth.role() <> 'service_role' then raise exception 'Acceso denegado'; end if;
 if p_codigo !~ '^[0-9]{8}$' then return false; end if;
 select id into v_id from public.usuarios
 where lower(email)=lower(trim(p_email)) and auth_user_id is null and coalesce(es_admin,false)=false
 for update;
 if v_id is null then return false; end if;
 select * into v_old from public.primer_acceso_codigos where usuario_id=v_id for update;
 if found and (v_old.enviado_en > now()-interval '60 seconds'
 or (v_old.ventana_inicio > now()-interval '1 hour' and v_old.solicitudes>=5)) then return false; end if;
 insert into public.primer_acceso_codigos(usuario_id,codigo_hash,expira_en,enviado_en,intentos,solicitudes,ventana_inicio)
 values(v_id,extensions.crypt(p_codigo,extensions.gen_salt('bf')),now()+interval '15 minutes',now(),0,
 case when v_old.ventana_inicio>now()-interval '1 hour' then v_old.solicitudes+1 else 1 end,
 case when v_old.ventana_inicio>now()-interval '1 hour' then v_old.ventana_inicio else now() end)
 on conflict(usuario_id) do update set codigo_hash=excluded.codigo_hash,expira_en=excluded.expira_en,
 enviado_en=excluded.enviado_en,intentos=0,solicitudes=excluded.solicitudes,ventana_inicio=excluded.ventana_inicio;
 return true;
end $function$;
CREATE OR REPLACE FUNCTION public.primer_acceso_verificar(p_email text, p_codigo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_row public.primer_acceso_codigos%rowtype;
begin
 if exists(select 1 from public.usuarios where lower(email)=lower(p_email) and cuenta_eliminada) then return null; end if;
  if auth.role() <> 'service_role' then
    raise exception 'Acceso denegado';
  end if;
  if p_codigo !~ '^[0-9]{8}$' then
    return null;
  end if;
  select id into v_id
    from public.usuarios
    where lower(email)=lower(trim(p_email))
      and auth_user_id is null
      and coalesce(es_admin,false)=false
    for update;
  if v_id is null then return null; end if;
  select * into v_row
    from public.primer_acceso_codigos
    where usuario_id=v_id
    for update;
  if not found or v_row.expira_en<=now() or v_row.intentos>=5 then return null; end if;
  if extensions.crypt(p_codigo,v_row.codigo_hash)=v_row.codigo_hash then
    -- El código permanece disponible ante fallos de Auth y se elimina
    -- solamente después de vincular con éxito el perfil.
    return v_id;
  end if;
  update public.primer_acceso_codigos
    set intentos=intentos+1
    where usuario_id=v_id;
  return null;
end
$function$;

revoke all on function public.primer_acceso_emitir(text,text),public.primer_acceso_verificar(text,text) from public,anon,authenticated;
grant execute on function public.primer_acceso_emitir(text,text),public.primer_acceso_verificar(text,text) to service_role;
