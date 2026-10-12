-- R6 | OFL146 Doctrina–Docencia | SQL DE REFERENCIA DE MIGRACIONES YA APLICADAS
-- Fecha: 2026-10-12
-- NO EJECUTAR SIN COMPARAR CON LOS OBJETOS EXISTENTES Y EL HISTORIAL DE MIGRACIONES.
--
-- Los siguientes comandos resumen las protecciones aplicadas. No incluyen
-- contraseñas, claves ni valores del corpus; la auditoría es privada.
--
-- (1) revocación de escrituras directas sobre padrón:
REVOKE INSERT, UPDATE, DELETE ON TABLE public.usuarios FROM PUBLIC, anon, authenticated;
--
-- (2) sólo columnas NO SECRETAS en el padrón, para compatibilidad temporal:
REVOKE SELECT ON TABLE public.usuarios FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,email,nombre,es_admin,terminos_aceptados,creado_en,debe_cambiar_clave)
  ON TABLE public.usuarios TO anon,authenticated;
--
-- Quedan inaccesibles para anon/authenticated: clave_hash,
-- token_recuperacion,token_expira,auth_user_id.
--
-- (3) configuración segura: sólo contenido docente de compatibilidad:
ALTER TABLE public.config_segura ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso seguro a configuracion" ON public.config_segura;
CREATE POLICY "Consulta transitoria de docencia sin secretos"
  ON public.config_segura FOR SELECT TO anon,authenticated
  USING (clave='doctrina_docencia_maestros');
REVOKE INSERT,UPDATE,DELETE ON public.config_segura FROM PUBLIC,anon,authenticated;
--
-- ADVERTENCIA: existe una entrada gemini_api_key. Su valor se ocultó
-- por RLS, pero la clave pudo haber quedado expuesta anteriormente.
-- Es obligatorio ROTARLA/REVOCARLA en el proveedor (Google AI Studio).
--
-- (4) trabajos docentes: escritura legacy bloqueada:
REVOKE INSERT,UPDATE,DELETE ON TABLE public.modulos FROM PUBLIC,anon,authenticated;
--
-- (5) funciones nuevas APROBADAS POR SERVIDOR:
-- public.maestro_admin_editar_trabajo(uuid,text,text,text)
-- public.maestro_admin_actualizar_preguntas(uuid,jsonb)
-- (ambas usan auth.uid() y public.maestro_identidad_actual();
-- escriben en doctrina.auditoria_docencia, con RLS privado).
-- DEFINICIONES completas: revisar pg_get_functiondef en Supabase y
-- el historial de migraciones p1_rpc_admin_editar_trabajo_solo_auth_con_auditoria_20261012
-- y p1_rpc_actualizar_ocho_preguntas_auth_auditado_20261012.
--
-- NO REABRIR LAS SIETE RPC ADMINISTRATIVAS LEGACY REVOCADAS.
-- NO REVOCAR SELECT DE TODAS LAS TABLAS DOCENTES HASTA MIGRAR
-- A LOS 25 USUARIOS SIN SUPABASE AUTH.

-- LECTURAS DE VERIFICACIÓN (ejecutables sin modificar datos):
SELECT
has_table_privilege('anon','public.usuarios','UPDATE') AS anon_edita_padron,
has_column_privilege('anon','public.usuarios','clave_hash','SELECT') AS anon_lee_hash,
has_column_privilege('anon','public.usuarios','token_recuperacion','SELECT') AS anon_lee_token,
has_table_privilege('anon','public.config_segura','UPDATE') AS anon_edita_config,
has_table_privilege('anon','public.modulos','UPDATE') AS anon_edita_trabajos,
has_table_privilege('anon','public.modulos','SELECT') AS anon_lee_trabajos,
has_function_privilege('anon',
 'public.maestro_admin_editar_trabajo(uuid,text,text,text)'::regprocedure,
 'EXECUTE') AS anon_rpc_edicion,
has_function_privilege('anon',
 'public.maestro_admin_actualizar_preguntas(uuid,jsonb)'::regprocedure,
 'EXECUTE') AS anon_rpc_preguntas;

-- PRUEBA DE VISIBILIDAD CONFIGURACIÓN:
-- BEGIN;
-- SET LOCAL ROLE anon;
-- SELECT clave FROM public.config_segura;
-- ROLLBACK;
-- Debe devolver únicamente doctrina_docencia_maestros, jamás gemini_api_key.
