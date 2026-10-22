-- Migración aditiva: agente_casos_revisados_json_sesion_20261022.
-- Memoria privada del administrador, separada de la biblioteca normativa.
BEGIN;
CREATE TABLE IF NOT EXISTS public.agente_casos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor uuid NOT NULL REFERENCES auth.users(id),
 huella text NOT NULL CHECK(huella ~ '^[0-9a-f]{64}$'),
 pregunta text NOT NULL CHECK(length(pregunta) BETWEEN 1 AND 2000),
 respuesta text NOT NULL CHECK(length(respuesta) BETWEEN 1 AND 5000),
 fuentes jsonb NOT NULL CHECK(jsonb_typeof(fuentes)='array' AND jsonb_array_length(fuentes) BETWEEN 1 AND 6),
 estado text NOT NULL DEFAULT 'candidato' CHECK(estado IN ('candidato','revisado','retirado')),
 creado_en timestamptz NOT NULL DEFAULT now(),
 revisado_en timestamptz,
 indice tsvector GENERATED ALWAYS AS (to_tsvector('spanish'::regconfig,pregunta||' '||respuesta)) STORED,
 UNIQUE(actor,huella)
);
CREATE INDEX IF NOT EXISTS agente_casos_actor_estado ON public.agente_casos(actor,estado,revisado_en DESC);
CREATE INDEX IF NOT EXISTS agente_casos_indice ON public.agente_casos USING gin(indice);
ALTER TABLE public.agente_casos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agente_casos FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.agente_casos TO service_role;
COMMIT;
