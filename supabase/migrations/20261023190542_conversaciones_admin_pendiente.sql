-- Conversaciones candidatas y roles previos al primer acceso.
ALTER TABLE public.agente_casos DROP CONSTRAINT agente_casos_fuentes_check;
ALTER TABLE public.agente_casos ADD CONSTRAINT agente_casos_fuentes_check CHECK(jsonb_typeof(fuentes)='array' AND jsonb_array_length(fuentes) BETWEEN 0 AND 6);
ALTER TABLE public.agente_casos ADD COLUMN conversacion jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(conversacion)='array' AND jsonb_array_length(conversacion)<=102);

CREATE OR REPLACE FUNCTION public.admin_gestionar_rol(p_actor uuid, p_usuario uuid, p_rol text, p_rol_actual text, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u public.usuarios;
BEGIN
 IF coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
 AND coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role' IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'Servicio requerido' USING ERRCODE='42501'; END IF;
 IF doctrina.rol_verificado(p_actor) IS DISTINCT FROM 'SUPERADMIN' THEN RAISE EXCEPTION 'Superadmin requerido' USING ERRCODE='42501'; END IF;
 IF p_rol IS NULL OR p_rol NOT IN('USER','ADMIN') OR p_rol_actual IS NULL OR p_rol_actual NOT IN('USER','ADMIN')
 OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 SELECT * INTO u FROM public.usuarios WHERE id=p_usuario FOR UPDATE;
 IF NOT FOUND OR u.cuenta_eliminada THEN RAISE EXCEPTION 'Usuario no disponible' USING ERRCODE='P0002'; END IF;
 IF u.rol='SUPERADMIN' OR u.auth_user_id=p_actor OR EXISTS(SELECT 1 FROM doctrina.superadmins s WHERE s.auth_user_id=u.auth_user_id AND s.activo)
 THEN RAISE EXCEPTION 'Cuenta protegida' USING ERRCODE='42501'; END IF;
 IF u.rol IS DISTINCT FROM p_rol_actual THEN RAISE EXCEPTION 'Rol desactualizado' USING ERRCODE='40001'; END IF;
 IF p_rol='ADMIN' AND u.auth_user_id IS NOT NULL AND doctrina.rol_verificado(u.auth_user_id) IS DISTINCT FROM u.rol THEN
 RAISE EXCEPTION 'Cuenta sin activar' USING ERRCODE='22023'; END IF;
 IF p_rol=u.rol THEN RETURN jsonb_build_object('id',u.id,'rol',u.rol); END IF;
 UPDATE public.usuarios SET rol=p_rol,es_admin=(p_rol='ADMIN') WHERE id=u.id;
 INSERT INTO doctrina.auditoria_roles(actor,usuario,rol_anterior,rol_nuevo,motivo) VALUES(p_actor,u.id,u.rol,p_rol,btrim(p_motivo));
 RETURN jsonb_build_object('id',u.id,'rol',p_rol);
END
$function$
;

CREATE OR REPLACE FUNCTION public.primer_acceso_cancelar(p_email text, p_codigo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Acceso denegado';
  end if;
  if p_codigo is null or p_codigo !~ '^[0-9]{8}$' then return false; end if;
  select id into v_id from public.usuarios
    where lower(email)=lower(trim(p_email)) and auth_user_id is null
      and rol IN('USER','ADMIN') AND cuenta_eliminada IS FALSE for update;
  if v_id is null then return false; end if;
  -- Conservar ventana y contadores; una emisión posterior no coincide con este hash.
  update public.primer_acceso_codigos
    set expira_en=least(expira_en,now())
    where usuario_id=v_id and extensions.crypt(p_codigo,codigo_hash)=codigo_hash;
  get diagnostics v_count = row_count;
  return v_count=1;
end
$function$
;

CREATE OR REPLACE FUNCTION public.primer_acceso_emitir(p_email text, p_codigo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_old public.primer_acceso_codigos%rowtype;
begin
 if exists(select 1 from public.usuarios where lower(email)=lower(p_email) and cuenta_eliminada) then return false; end if;
 if auth.role() is distinct from 'service_role' then raise exception 'Acceso denegado'; end if;
 if p_codigo !~ '^[0-9]{8}$' then return false; end if;
 select id into v_id from public.usuarios
 where lower(email)=lower(trim(p_email)) and auth_user_id is null and rol IN('USER','ADMIN') AND cuenta_eliminada IS FALSE
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
end $function$
;

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
  if auth.role() is distinct from 'service_role' then
    raise exception 'Acceso denegado';
  end if;
  if p_codigo !~ '^[0-9]{8}$' then
    return null;
  end if;
  select id into v_id
    from public.usuarios
    where lower(email)=lower(trim(p_email))
      and auth_user_id is null
      and rol IN('USER','ADMIN') AND cuenta_eliminada IS FALSE
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
$function$
;
