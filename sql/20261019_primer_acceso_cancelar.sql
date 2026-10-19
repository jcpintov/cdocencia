-- Aplicar antes de publicar el handler que invoca esta RPC.
create or replace function public.primer_acceso_cancelar(p_email text, p_codigo text)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare v_id uuid; v_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Acceso denegado';
  end if;
  if p_codigo is null or p_codigo !~ '^[0-9]{8}$' then return false; end if;
  select id into v_id from public.usuarios
    where lower(email)=lower(trim(p_email)) and auth_user_id is null
      and coalesce(es_admin,false)=false for update;
  if v_id is null then return false; end if;
  -- Conservar ventana y contadores; una emisión posterior no coincide con este hash.
  update public.primer_acceso_codigos
    set expira_en=least(expira_en,now())
    where usuario_id=v_id and extensions.crypt(p_codigo,codigo_hash)=codigo_hash;
  get diagnostics v_count = row_count;
  return v_count=1;
end
$function$;
revoke all on function public.primer_acceso_cancelar(text,text) from public, anon, authenticated;
grant execute on function public.primer_acceso_cancelar(text,text) to service_role;
