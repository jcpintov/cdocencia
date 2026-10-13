-- DOCTRINA DOCENCIA R10 · DIAGNOSTICO SOLO LECTURA
-- Nunca ejecutar REVOKE/GRANT/UPDATE/DELETE desde este archivo.

-- 1. Funciones privilegiadas realmente accesibles desde el exterior.
SELECT n.nspname AS esquema,p.oid::regprocedure AS funcion,
 p.prosecdef AS security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
ORDER BY n.nspname,p.proname;

-- 2. Todas las tablas public deben negar acceso directo.
SELECT c.relname AS tabla,c.relrowsecurity AS rls,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
 has_table_privilege('anon',c.oid,'INSERT') AS anon_insert,
 has_table_privilege('anon',c.oid,'UPDATE') AS anon_update,
 has_table_privilege('authenticated',c.oid,'SELECT') AS auth_select,
 has_table_privilege('authenticated',c.oid,'UPDATE') AS auth_update
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p')
ORDER BY c.relname;

-- 3. Integridad del censo y corpus, sin divulgar identidades.
SELECT (SELECT count(*) FROM public.usuarios) AS perfiles,
 (SELECT count(*) FROM auth.users) AS auth_total,
 (SELECT count(*) FROM public.usuarios p
   JOIN auth.users a ON a.id=p.auth_user_id
   WHERE a.email_confirmed_at IS NOT NULL
     AND lower(trim(a.email))=lower(trim(p.email))) AS auth_vinculados,
 (SELECT count(*) FROM doctrina.superadmins WHERE activo) AS superadmins,
 (SELECT count(*) FROM public.modulos WHERE activo=true) AS trabajos,
 (SELECT count(*) FROM public.progreso_maestro) AS avances,
 (SELECT count(*) FROM public.comentarios_muro) AS comentarios,
 (SELECT count(*) FROM doctrina.ingesta_documental) AS cuarentena,
 (SELECT count(*) FROM storage.objects
   WHERE bucket_id='doctrina-originales-privados') AS pdf_almacenados;
