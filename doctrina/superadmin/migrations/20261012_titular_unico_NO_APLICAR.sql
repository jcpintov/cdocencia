-- DISEÑO DE MIGRACIÓN: NO APLICAR EN PRODUCCIÓN NI AUTOMÁTICAMENTE.
-- Requiere aprobación expresa, respaldo y ensayo con datos sintéticos.
-- Objetivo: impedir delegación de Doctrina Superadmin mediante RPC pública,
-- manteniendo la cuenta titular verificada y las RPC de consulta/auditoría.
-- No modifica identidad, roles ni contraseñas de Docencia.
BEGIN;
DO $verify_single_owner$
DECLARE
  v_active integer;
  v_owner integer;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE lower(u.email) = 'jpintov@gmail.com' AND u.email_confirmed_at IS NOT NULL)
    INTO v_active,v_owner
    FROM doctrina.superadmins s
    JOIN auth.users u ON u.id=s.auth_user_id
   WHERE s.activo=TRUE;

  IF v_active<>1 OR v_owner<>1 THEN
    RAISE EXCEPTION 'Detenido: la política de titular único no está verificada';
  END IF;
END;
$verify_single_owner$;

-- La consola v3 no permite altas ni revocaciones; la RPC de administración
-- queda fuera del alcance de todos los clientes anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.doctrina_admin_cambiar(text,boolean,text)
  FROM PUBLIC, anon, authenticated;
COMMIT;

-- Comprobaciones de solo lectura tras aplicar exclusivamente en ensayo:
-- SELECT has_function_privilege('anon',
--        'public.doctrina_admin_cambiar(text,boolean,text)','EXECUTE');
-- SELECT has_function_privilege('authenticated',
--        'public.doctrina_admin_cambiar(text,boolean,text)','EXECUTE');
-- Resultado esperado: FALSE, FALSE.
-- Verificar además que public.doctrina_es_superadmin() y las RPC de auditoría
-- siguen accesibles únicamente a sesiones autenticadas autorizadas.
-- Si la política de rol cambia, requiere un procedimiento administrativo nuevo,
-- aprobado y ensayado; nunca reactivar la delegación por comodidad.
