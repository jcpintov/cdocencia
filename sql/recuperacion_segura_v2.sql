-- MIGRACIÓN PROPUESTA: ejecutar primero en laboratorio y verificar.
-- Solo service_role puede invocar estas funciones; no exponer claves en navegador.
CREATE TABLE IF NOT EXISTS public.recuperacion_limites (
  clave text PRIMARY KEY,
  ventana_inicio timestamptz NOT NULL DEFAULT now(),
  intentos integer NOT NULL DEFAULT 0
);
ALTER TABLE public.recuperacion_limites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recuperacion_limites FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.recuperacion_limites TO service_role;

CREATE OR REPLACE FUNCTION public.recuperacion_consumir_cupo_servidor(
  p_clave text, p_maximo integer, p_ventana interval
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_intentos integer;
BEGIN
  IF length(p_clave) > 180 OR length(p_clave) < 10
     OR p_maximo < 1 OR p_maximo > 100 OR p_ventana < interval '1 minute'
     OR p_ventana > interval '1 day' THEN RETURN false; END IF;
  INSERT INTO public.recuperacion_limites AS t (clave, ventana_inicio, intentos)
  VALUES (p_clave, now(), 1)
  ON CONFLICT (clave) DO UPDATE SET
    ventana_inicio = CASE WHEN t.ventana_inicio <= now() - p_ventana
      THEN now() ELSE t.ventana_inicio END,
    intentos = CASE WHEN t.ventana_inicio <= now() - p_ventana
      THEN 1 ELSE t.intentos + 1 END
  RETURNING intentos INTO v_intentos;
  RETURN v_intentos <= p_maximo;
END $$;

CREATE OR REPLACE FUNCTION public.recuperacion_emitir_servidor(p_email text)
RETURNS TABLE(encontrado boolean, codigo text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_id uuid; v_codigo text; v_num bigint;
BEGIN
  SELECT id INTO v_id FROM public.usuarios
  WHERE lower(btrim(email)) = lower(btrim(p_email)) LIMIT 1;
  IF v_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;
  v_num := (('x' || encode(gen_random_bytes(8),'hex'))::bit(64)::bigint & 9223372036854775807);
  v_codigo := lpad((v_num % 100000000)::text, 8, '0');
  UPDATE public.usuarios SET
    token_recuperacion = crypt(v_codigo, gen_salt('bf')),
    token_expira = now() + interval '15 minutes'
  WHERE id = v_id;
  RETURN QUERY SELECT true, v_codigo;
END $$;

CREATE OR REPLACE FUNCTION public.recuperacion_confirmar_servidor(
  p_email text, p_codigo text, p_nueva_clave text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_id uuid; v_hash text; v_expira timestamptz;
BEGIN
  IF p_codigo !~ '^[0-9]{8}$' THEN RETURN false; END IF;
  IF length(p_nueva_clave) < 10 OR length(p_nueva_clave) > 128
    OR p_nueva_clave !~ '[A-Za-z]' OR p_nueva_clave !~ '[0-9]'
    THEN RAISE EXCEPTION 'La contraseña requiere 10-128 caracteres, letras y números'; END IF;
  SELECT id, token_recuperacion, token_expira INTO v_id, v_hash, v_expira
  FROM public.usuarios
  WHERE lower(btrim(email)) = lower(btrim(p_email))
  FOR UPDATE;
  IF v_id IS NULL OR v_hash IS NULL OR v_expira IS NULL
    OR v_expira <= now() OR crypt(p_codigo, v_hash) <> v_hash
    THEN RETURN false; END IF;
  UPDATE public.usuarios SET
    clave_hash = crypt(p_nueva_clave,gen_salt('bf')),
    debe_cambiar_clave = false,
    token_recuperacion = NULL, token_expira = NULL
  WHERE id = v_id;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.recuperacion_consumir_cupo_servidor(text,integer,interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recuperacion_emitir_servidor(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recuperacion_confirmar_servidor(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recuperacion_consumir_cupo_servidor(text,integer,interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.recuperacion_emitir_servidor(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.recuperacion_confirmar_servidor(text,text,text) TO service_role;
