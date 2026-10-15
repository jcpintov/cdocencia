-- R12.1 · COPIA EXACTA EFECTIVA EN SUPABASE (2026-10-14).
-- Se incorporó verificación en vivo de auth.mfa_factors verified además
-- del nivel AAL2 del JWT. Sin MFA verificado no puede vincular nadie.
-- Migraciones YA APLICADAS: r12_vinculacion_auth_mfa_aal2_superadmin_auditada_sin_invitar
-- y r12_factor_mfa_live_verificado_adicional_al_jwt_aal2.
-- NO reejecutar a ciegas; contrastar permisos, versión y roles.

CREATE OR REPLACE FUNCTION public.maestro_admin_vincular_auth(p_perfil_legacy uuid, p_motivo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_correo text;
  v_rol_admin boolean;
  v_vinculo_actual uuid;
  v_auth_id uuid;
  v_cantidad integer;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.maestro_identidad_actual() i
    WHERE i.auth_user_id=v_actor AND i.rol='SUPERADMIN'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere SUPERADMIN verificado'
      USING ERRCODE='42501';
  END IF;

  -- Vincular identidades nuevas requiere segundo factor real en la sesión.
  -- La comprobación se hace sobre el JWT emitido por Supabase Auth,
  -- nunca sobre una bandera enviada por JavaScript.
  IF (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'Se requiere autenticación multifactor AAL2'
      USING ERRCODE='42501';
  END IF;

  -- Segundo control independiente del JWT: factor TOTP realmente verificado
  -- en Auth para el mismo administrador. Falla cerrado si se revoca el factor.
  IF NOT EXISTS (
    SELECT 1 FROM auth.mfa_factors f
    WHERE f.user_id=v_actor AND f.status='verified'
  ) THEN
    RAISE EXCEPTION 'No existe un segundo factor MFA verificado actualmente'
      USING ERRCODE='42501';
  END IF;

  IF p_perfil_legacy IS NULL OR p_motivo IS NULL OR
     char_length(btrim(p_motivo)) NOT BETWEEN 12 AND 500 THEN
    RAISE EXCEPTION 'Se requiere perfil y motivo de vinculación verificable'
      USING ERRCODE='22023';
  END IF;

  -- Serializar intentos concurrentes, también de futuros operadores.
  PERFORM pg_advisory_xact_lock(146,2027);

  SELECT p.email::text, p.es_admin, p.auth_user_id
    INTO v_correo,v_rol_admin,v_vinculo_actual
  FROM public.usuarios p
  WHERE p.id=p_perfil_legacy
  FOR UPDATE;

  IF NOT FOUND OR v_rol_admin IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'Perfil no encontrado o no habilitado como USER'
      USING ERRCODE='42501';
  END IF;
  IF v_vinculo_actual IS NOT NULL THEN
    RAISE EXCEPTION 'Este perfil ya posee un vínculo Auth; no se modifica'
      USING ERRCODE='23505';
  END IF;

  SELECT count(*)::integer, min(a.id)
    INTO v_cantidad,v_auth_id
  FROM auth.users a
  WHERE lower(btrim(a.email))=lower(btrim(v_correo))
    AND a.email_confirmed_at IS NOT NULL
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until<=now());

  IF v_cantidad<>1 OR v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No existe exactamente una identidad Auth confirmada y activa'
      USING ERRCODE='42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios p WHERE p.auth_user_id=v_auth_id)
     OR EXISTS (SELECT 1 FROM doctrina.superadmins s WHERE s.auth_user_id=v_auth_id) THEN
    RAISE EXCEPTION 'La identidad Auth está reservada o asociada a otro perfil'
      USING ERRCODE='23505';
  END IF;

  UPDATE public.usuarios
  SET auth_user_id=v_auth_id
  WHERE id=p_perfil_legacy AND auth_user_id IS NULL AND es_admin IS FALSE;
  GET DIAGNOSTICS v_cantidad=ROW_COUNT;
  IF v_cantidad<>1 THEN
    RAISE EXCEPTION 'No se vinculó exactamente un perfil; transacción abortada';
  END IF;

  INSERT INTO doctrina.migracion_auth_auditoria
    (actor_auth_id,perfil_legacy_id,auth_usuario_id,accion,motivo)
  VALUES (v_actor,p_perfil_legacy,v_auth_id,'VINCULACION',btrim(p_motivo));

  RETURN TRUE;
END
$function$
;
REVOKE ALL ON FUNCTION public.maestro_admin_vincular_auth(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maestro_admin_vincular_auth(uuid,text) TO authenticated;

-- Verificación solo lectura:
SELECT has_function_privilege('anon','public.maestro_admin_vincular_auth(uuid,text)'::regprocedure,'EXECUTE') AS anon,
 (SELECT count(*) FROM doctrina.migracion_auth_auditoria) AS operaciones_realizadas,
 (SELECT count(*) FROM public.usuarios WHERE auth_user_id IS NOT NULL) AS vinculados;
