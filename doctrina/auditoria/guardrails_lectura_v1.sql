-- Doctrina / auditoría preventiva de separación de privilegios.
-- SOLO LECTURA: inspecciona metadatos de PostgreSQL; no accede a documentos,
-- usuarios, credenciales, textos reservados ni modifica producción.
-- PASS es una comprobación de configuración, NO una prueba de intrusión.
WITH
  tablas AS (
    SELECT c.oid, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'doctrina' AND c.relkind IN ('r','p')
  ),
  funciones AS (
    SELECT p.oid, p.prosecdef, n.nspname, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'doctrina'
  ),
  puerta AS (
    SELECT p.oid, p.prosecdef, pg_get_functiondef(p.oid) AS codigo
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'doctrina_es_superadmin'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ),
  politicas AS (
    SELECT count(*) AS total FROM pg_policies WHERE schemaname = 'doctrina'
  ),
  controles AS (
    SELECT 'D01_TABLAS_RLS' AS control,
           count(*) >= 14 AND coalesce(bool_and(relrowsecurity),false) AS pasa
    FROM tablas
    UNION ALL
    SELECT 'D02_TABLAS_SIN_PRIVILEGIOS_ANON',
           count(*) >= 14 AND coalesce(bool_and(
             NOT has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE')),false)
    FROM tablas
    UNION ALL
    SELECT 'D03_TABLAS_SIN_PRIVILEGIOS_AUTH',
           count(*) >= 14 AND coalesce(bool_and(
             NOT has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE')),false)
    FROM tablas
    UNION ALL
    SELECT 'D04_SIN_POLITICAS_EXPUESTAS', total = 0 FROM politicas
    UNION ALL
    SELECT 'D05_FUNCIONES_PRIVADAS_SIN_ANON',
           count(*) >= 3 AND coalesce(bool_and(
             NOT has_function_privilege('anon',oid,'EXECUTE')),false)
    FROM funciones
    UNION ALL
    SELECT 'D06_FUNCIONES_PRIVADAS_SIN_AUTH',
           count(*) >= 3 AND coalesce(bool_and(
             NOT has_function_privilege('authenticated',oid,'EXECUTE')),false)
    FROM funciones
    UNION ALL
    SELECT 'D07_GATE_SUPERADMIN_NO_ANON',
           count(*) = 1 AND coalesce(bool_and(
             NOT has_function_privilege('anon',oid,'EXECUTE')),false)
    FROM puerta
    UNION ALL
    SELECT 'D08_GATE_SUPERADMIN_AUTH',
           count(*) = 1 AND coalesce(bool_and(
             has_function_privilege('authenticated',oid,'EXECUTE')),false)
    FROM puerta
    UNION ALL
    SELECT 'D09_GATE_CONSULTA_ALLOWLIST_Y_AUTH_UID',
           count(*) = 1 AND coalesce(bool_and(
             prosecdef AND codigo ILIKE '%doctrina.superadmins%'
             AND codigo ILIKE '%auth.uid()%'
             AND codigo NOT ILIKE '%public.usuarios%'
             AND codigo NOT ILIKE '%es_admin%'),false)
    FROM puerta
  )
SELECT control, CASE WHEN pasa THEN 'PASS' ELSE 'FAIL' END AS estado
FROM controles ORDER BY control;
