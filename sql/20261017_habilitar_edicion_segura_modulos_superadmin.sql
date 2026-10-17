-- Incidencia: Superadmin > Auditoría y Edición de Trabajos.
-- El frontend enviaba UPDATE a public.modulos para guardar:
--   numero_orden, titulo, autor, contenido_trazado y preguntas_json.
-- El rol authenticated solo tenia UPDATE(archivo_pdf_base64), por lo que
-- PostgREST devolvia "permission denied for table modulos".
--
-- Aplicada a produccion Supabase el 2026-10-17 mediante la migracion
-- habilitar_edicion_segura_modulos_superadmin_20261017.
-- Precondicion: existe la politica previa modulos_cargar_pdf_superadmin
-- que comprueba maestro_identidad_actual().rol = 'SUPERADMIN'.
--
-- Se otorgan exclusivamente permisos por columna. RLS preserva
-- USUARIO: lectura; SUPERADMIN: modificacion de campos aprobados.
GRANT UPDATE (numero_orden, titulo, autor, contenido_trazado, preguntas_json)
  ON TABLE public.modulos TO authenticated;

ALTER POLICY modulos_cargar_pdf_superadmin
  ON public.modulos RENAME TO modulos_edicion_superadmin;

-- Comprobaciones posteriores sugeridas:
-- SELECT attname, has_column_privilege('authenticated','public.modulos',attname,'UPDATE')
-- FROM pg_attribute WHERE attrelid='public.modulos'::regclass AND attnum>0 AND NOT attisdropped;
-- SELECT polname,pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)
-- FROM pg_policy WHERE polrelid='public.modulos'::regclass;
