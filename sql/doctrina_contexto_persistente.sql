BEGIN;
CREATE TABLE IF NOT EXISTS doctrina.contexto_base (
 unico boolean PRIMARY KEY DEFAULT true CHECK(unico),
 paginas jsonb NOT NULL,
 preparado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE doctrina.contexto_base ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON doctrina.contexto_base FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION doctrina.invalidar_contexto_base() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN
 DELETE FROM doctrina.contexto_base;
 RETURN NULL;
END $f$;
REVOKE ALL ON FUNCTION doctrina.invalidar_contexto_base() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS invalidar_contexto_base ON doctrina.documentos;
CREATE TRIGGER invalidar_contexto_base AFTER INSERT OR UPDATE OR DELETE ON doctrina.documentos FOR EACH STATEMENT EXECUTE FUNCTION doctrina.invalidar_contexto_base();
DROP TRIGGER IF EXISTS invalidar_contexto_base ON doctrina.versiones;
CREATE TRIGGER invalidar_contexto_base AFTER INSERT OR UPDATE OR DELETE ON doctrina.versiones FOR EACH STATEMENT EXECUTE FUNCTION doctrina.invalidar_contexto_base();
DROP TRIGGER IF EXISTS invalidar_contexto_base ON doctrina.textos_extraidos;
CREATE TRIGGER invalidar_contexto_base AFTER INSERT OR UPDATE OR DELETE ON doctrina.textos_extraidos FOR EACH STATEMENT EXECUTE FUNCTION doctrina.invalidar_contexto_base();
DROP TRIGGER IF EXISTS invalidar_contexto_base ON doctrina.llm_autorizaciones;
CREATE TRIGGER invalidar_contexto_base AFTER INSERT OR UPDATE OR DELETE ON doctrina.llm_autorizaciones FOR EACH STATEMENT EXECUTE FUNCTION doctrina.invalidar_contexto_base();
COMMIT;
