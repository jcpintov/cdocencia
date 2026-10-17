-- Normalización excepcional, 2026-10-17. Aplicar UNA VEZ en la base de Docencia.
-- No modifica autor, evaluaciones, PDF, progreso ni otras tablas.
-- Conserva íntegro el cuerpo, sustituye solo el saludo/firma del final.
-- Cierre obligatorio: S.·.F.·.U.·. + línea en blanco + Nombre Del Autor + línea vacía.
--
-- Este cambio de DATOS se aplica manualmente, no como migración CI.
DO $docencia$
DECLARE
  actualizados int;
BEGIN
  IF (SELECT count(*) FROM public.modulos) <> 6 THEN
    RAISE EXCEPTION 'La cantidad de trabajos ha cambiado. Revisar antes de normalizar.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.modulos
    WHERE numero_orden BETWEEN 1 AND 6
      AND (autor IS NULL OR btrim(autor) = '')
  ) THEN
    RAISE EXCEPTION 'Existen trabajos sin autor.';
  END IF;

  UPDATE public.modulos AS m
  SET contenido_trazado =
    rtrim(
      regexp_replace(
        replace(replace(m.contenido_trazado,chr(13)||chr(10),chr(10)),chr(13),chr(10)),
        $rx$\n+[ \t]*S[.·:]+F[.·:]+U[.·:]+(\n+[ \t]*[^\n]+)?[ \t\n]*$$rx$,
        '', 'g'
      ),
      chr(10)||chr(9)||' '
    )
    || chr(10)||chr(10)||'S.·.F.·.U.·.'
    || chr(10)||chr(10)
    || regexp_replace(btrim(m.autor), '^Q[.·:]+H[.·:]+[ \t]*', '')
    || chr(10)||chr(10)
  WHERE m.numero_orden BETWEEN 1 AND 6;

  GET DIAGNOSTICS actualizados = ROW_COUNT;
  IF actualizados <> 6 THEN
    RAISE EXCEPTION 'Se esperaban 6 trabajos, se modificaron %.', actualizados;
  END IF;
END
$docencia$;
