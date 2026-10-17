-- Catálogo institucional de unidades para Docencia de Maestros.
-- Los códigos, títulos y orden se cargarán ÚNICAMENTE desde la lista oficial
-- que proporcione el Superadmin; esta migración no inventa unidades.
CREATE TABLE IF NOT EXISTS public.unidades_docencia (
  codigo varchar(40) PRIMARY KEY,
  detalle text NOT NULL CHECK (length(btrim(detalle)) > 0),
  orden integer NOT NULL DEFAULT 0 CHECK (orden >= 0),
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT unidades_docencia_codigo_alfanumerico CHECK (codigo ~ '^[A-Z0-9]+$')
);

ALTER TABLE public.unidades_docencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY unidades_docencia_lectura_usuarios
  ON public.unidades_docencia FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

REVOKE ALL ON TABLE public.unidades_docencia FROM PUBLIC, anon, authenticated;
GRANT SELECT (codigo, detalle, orden, activo) ON TABLE public.unidades_docencia TO authenticated;

-- Los seis trabajos actuales permanecen SIN UNIDAD hasta recibir la nómina.
ALTER TABLE public.modulos ADD COLUMN IF NOT EXISTS unidad_codigo varchar(40)
 REFERENCES public.unidades_docencia(codigo)
 ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS modulos_unidad_codigo_idx
 ON public.modulos(unidad_codigo) WHERE unidad_codigo IS NOT NULL;

-- El privilegio es por columna. La política de UPDATE de public.modulos
-- ya restringe USING y WITH CHECK a maestro_identidad_actual().rol='SUPERADMIN'.
GRANT UPDATE (unidad_codigo) ON TABLE public.modulos TO authenticated;
