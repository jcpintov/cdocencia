-- Ejecutar solo después de confirmar en Vercel producción una versión
-- que incluya el PR #15 (commit 5d360805278d91dc6eeb388a7dd8cf8576d1ec49
-- o una revisión descendiente que contenga el directorio jerárquico).
-- Vercel devolvió HTTP 402 api-deployments-free-per-day, límite 100/24h.
-- Los 112 registros se almacenaron inactivos para no afectar el frontend anterior.
--
-- Este script NO asigna unidades a trabajos: esas correspondencias requieren
-- una definición explícita del Superadmin.
DO $activar$
DECLARE total integer;
        activos integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE activo)
    INTO total, activos
    FROM public.unidades_docencia;
  IF total <> 112 THEN
    RAISE EXCEPTION 'Catálogo incompleto o ampliado: % registros, esperaba 112.', total;
  END IF;
  IF activos = 112 THEN
    RETURN; -- ejecución idempotente
  END IF;
  IF activos <> 0 THEN
    RAISE EXCEPTION 'Activación parcial detectada (% de 112). Revisar antes de continuar.', activos;
  END IF;
  UPDATE public.unidades_docencia SET activo=TRUE WHERE activo IS FALSE;
  GET DIAGNOSTICS activos = ROW_COUNT;
  IF activos <> 112 THEN
    RAISE EXCEPTION 'Se esperaban 112 activaciones, se realizaron %.', activos;
  END IF;
END $activar$;
