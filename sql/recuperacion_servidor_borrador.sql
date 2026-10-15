-- Cámara de Docencia: funciones de recuperación SOLO para backend.
-- No ejecutar desde el navegador. Requiere servicio de correo del lado servidor.
-- Migración preparada, no aplicada automáticamente a producción.
CREATE OR REPLACE FUNCTION public.recuperacion_emitir_servidor(p_email text)
RETURNS TABLE(encontrado boolean, codigo text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_id uuid; v_codigo text;
BEGIN
  SELECT id INTO v_id FROM public.usuarios
  WHERE lower(btrim(email)) = lower(btrim(p_email))
  LIMIT 1;
  IF v_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;
  -- Código generado con fuente criptográfica del servidor.
  v_codigo := lpad(((('x' || encode(gen_random_bytes(4),'hex'))::bit(32)::bigint % 1000000)::integer)::text,6,'0');
  UPDATE public.usuarios
  SET token_recuperacion = encode(digest(v_codigo,'sha256'),'hex'),
      token_expira = now() + interval '15 minutes'
  WHERE id = v_id;
  RETURN QUERY SELECT true, v_codigo;
END $$;

CREATE OR REPLACE FUNCTION public.recuperacion_confirmar_servidor(
  p_email text, p_codigo text, p_nueva_clave text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_id uuid;
BEGIN
  IF p_codigo !~ '^[0-9]{6}$' THEN RETURN false; END IF;
  IF length(p_nueva_clave) < 10 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 10 caracteres';
  END IF;
  SELECT id INTO v_id FROM public.usuarios
  WHERE lower(btrim(email)) = lower(btrim(p_email))
    AND token_recuperacion = encode(digest(p_codigo,'sha256'),'hex')
    AND token_expira > now()
  FOR UPDATE;
  IF v_id IS NULL THEN RETURN false; END IF;
  UPDATE public.usuarios SET clave_hash=crypt(p_nueva_clave,gen_salt('bf')),
    debe_cambiar_clave=false,token_recuperacion=NULL,token_expira=NULL
  WHERE id=v_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.recuperacion_emitir_servidor(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recuperacion_confirmar_servidor(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recuperacion_emitir_servidor(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.recuperacion_confirmar_servidor(text,text,text) TO service_role;
-- Pendiente antes de activar: límites de intentos y solicitudes por IP/correo,
-- impedir reutilización tras múltiples intentos y proteger servicio HTTP.
