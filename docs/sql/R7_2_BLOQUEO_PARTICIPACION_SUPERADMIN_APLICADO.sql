-- R7.2: segregación estricta SUPERADMIN / USER en Docencia
-- Fecha: 2026-10-12
-- ESTADO: YA APLICADO en Supabase pwnnpjygnviyzyyvfxnq.
-- No aplicar a ciegas; comparar pg_trigger y las migraciones existentes.
-- No modifica filas ni expone originales o contraseñas.
BEGIN;
CREATE OR REPLACE FUNCTION doctrina.bloquear_participacion_superadmin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $guard$
BEGIN
  IF NEW.usuario_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id=NEW.usuario_id AND u.es_admin IS TRUE
  ) THEN
    RAISE EXCEPTION
      'El perfil administrativo no participa en actividades formativas de Docencia'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION doctrina.bloquear_participacion_superadmin()
FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_no_superadmin_progreso ON public.progreso_maestro;
CREATE TRIGGER trg_no_superadmin_progreso
BEFORE INSERT OR UPDATE ON public.progreso_maestro
FOR EACH ROW EXECUTE FUNCTION doctrina.bloquear_participacion_superadmin();
DROP TRIGGER IF EXISTS trg_no_superadmin_comentarios ON public.comentarios_muro;
CREATE TRIGGER trg_no_superadmin_comentarios
BEFORE INSERT OR UPDATE ON public.comentarios_muro
FOR EACH ROW EXECUTE FUNCTION doctrina.bloquear_participacion_superadmin();
COMMIT;

-- Verificar después sin alterar datos:
SELECT tgrelid::regclass AS tabla, tgname,pg_get_triggerdef(oid) AS definicion
FROM pg_trigger
WHERE tgname IN ('trg_no_superadmin_progreso','trg_no_superadmin_comentarios')
AND NOT tgisinternal ORDER BY tabla;
SELECT
 (SELECT count(*)::int FROM public.progreso_maestro p
    JOIN public.usuarios u ON u.id=p.usuario_id WHERE u.es_admin) AS admin_progresos,
 (SELECT count(*)::int FROM public.comentarios_muro c
    JOIN public.usuarios u ON u.id=c.usuario_id WHERE u.es_admin) AS admin_comentarios;
