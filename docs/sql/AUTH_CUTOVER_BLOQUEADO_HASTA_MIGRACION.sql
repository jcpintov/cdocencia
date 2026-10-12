-- DOCTRINA–DOCENCIA · PLAN DE CORTE DE AUTORIZACIÓN — NO EJECUTAR TODAVÍA
-- Estado: BLOQUEADO por migración incompleta del padrón a Supabase Auth.
-- IMPORTANTE: ejecutar exclusivamente después de aprobar lanzamiento y
-- desplegar/validar los handlers de Auth, recuperación y administración.
-- Esta transacción es fail-closed y aborta si faltan pruebas de corte.
begin;

do $$
declare v_total int; v_vinculados int; v_admins int; v_admins_vinculados int;
begin
 if current_setting('app.auth_cutover_authorized',true) is distinct from 'AUTORIZACION_EXPRESA_VERIFICADA'
    or current_setting('app.auth_client_switched',true) is distinct from 'CLIENTE_NUEVO_VALIDADO'
 then
   raise exception 'Corte no autorizado; se mantiene la API heredada sin cambios';
 end if;

 select count(*) into v_total from public.usuarios;
 select count(*) into v_vinculados from public.usuarios p
 where exists (select 1 from auth.users a
   where lower(a.email) = lower(p.email) and a.email_confirmed_at is not null);
 if v_total <> v_vinculados then
   raise exception 'No migrado: padrón % usuarios, Auth verificados %',v_total,v_vinculados;
 end if;

 select count(*) into v_admins from public.usuarios where es_admin is true;
 select count(*) into v_admins_vinculados
 from public.usuarios p join auth.users a on lower(p.email)=lower(a.email)
 join doctrina.superadmins s on s.auth_user_id=a.id and s.activo is true
 where p.es_admin is true and a.email_confirmed_at is not null;
 if v_admins <> 1 or v_admins_vinculados <> 1 then
    raise exception 'Se requiere un único Superadmin reconocido por Auth y doctrina.superadmins';
 end if;
end $$;

-- Sólo el servidor, con credenciales en el entorno privado, puede invocar el
-- puente legacy durante la transición; nunca los roles cliente anon/authenticated.
revoke all on function public.admin_crear_usuario(uuid,text,text,text,boolean)
 from public,anon,authenticated;
revoke all on function public.admin_editar_usuario(uuid,uuid,text,text,boolean)
 from public,anon,authenticated;
revoke all on function public.admin_eliminar_usuario(uuid,uuid)
 from public,anon,authenticated;
revoke all on function public.admin_cambiar_clave(uuid,uuid,text,boolean)
 from public,anon,authenticated;
revoke all on function public.cambiar_clave_usuario(uuid,text)
 from public,anon,authenticated;

grant execute on function public.admin_crear_usuario(uuid,text,text,text,boolean) to service_role;
grant execute on function public.admin_editar_usuario(uuid,uuid,text,text,boolean) to service_role;
grant execute on function public.admin_eliminar_usuario(uuid,uuid) to service_role;
grant execute on function public.admin_cambiar_clave(uuid,uuid,text,boolean) to service_role;

-- La función de login heredada y recuperación se deshabilitarán solo DESPUÉS
-- de reemplazar su interfaz y verificar el restablecimiento real Supabase Auth.
-- Este script no manipula contraseñas, grupos, documentos ni bitácoras.
commit;

-- Verificación posterior (solo lectura):
-- SELECT p.oid::regprocedure,
--        has_function_privilege('anon', p.oid, 'EXECUTE') anon_execute,
--        has_function_privilege('authenticated',p.oid,'EXECUTE') user_execute
-- FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='public' AND p.proname LIKE 'admin_%';
