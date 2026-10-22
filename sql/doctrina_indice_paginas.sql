-- Índice privado por página. No publica documentos ni cambia permisos de consulta.
BEGIN;
CREATE TABLE IF NOT EXISTS doctrina.indice_paginas (
 version_id uuid NOT NULL REFERENCES doctrina.textos_extraidos(version_id) ON DELETE CASCADE,
 pagina integer NOT NULL CHECK(pagina BETWEEN 1 AND 600),
 sha256 text NOT NULL,
 texto text NOT NULL,
 requiere_ocr boolean NOT NULL DEFAULT false,
 busqueda tsvector GENERATED ALWAYS AS (to_tsvector('spanish'::regconfig,texto)) STORED,
 PRIMARY KEY(version_id,pagina)
);
ALTER TABLE doctrina.indice_paginas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON doctrina.indice_paginas FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS doctrina_indice_paginas_busqueda ON doctrina.indice_paginas USING gin(busqueda);
CREATE OR REPLACE FUNCTION doctrina.sincronizar_indice_paginas() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $func$
BEGIN
 INSERT INTO doctrina.indice_paginas(version_id,pagina,sha256,texto,requiere_ocr)
 SELECT NEW.version_id,(p->>'numero')::integer,NEW.sha256,coalesce(p->>'texto',''),coalesce((p->>'requiere_ocr')::boolean,false)
 FROM jsonb_array_elements(NEW.paginas) p
 ON CONFLICT(version_id,pagina) DO UPDATE SET sha256=excluded.sha256,texto=excluded.texto,requiere_ocr=excluded.requiere_ocr;
 DELETE FROM doctrina.indice_paginas i WHERE i.version_id=NEW.version_id
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.paginas) p WHERE (p->>'numero')::integer=i.pagina);
 RETURN NEW;
END $func$;
REVOKE ALL ON FUNCTION doctrina.sincronizar_indice_paginas() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS sincronizar_indice_paginas ON doctrina.textos_extraidos;
CREATE TRIGGER sincronizar_indice_paginas AFTER INSERT OR UPDATE OF paginas,sha256 ON doctrina.textos_extraidos
FOR EACH ROW EXECUTE FUNCTION doctrina.sincronizar_indice_paginas();
INSERT INTO doctrina.indice_paginas(version_id,pagina,sha256,texto,requiere_ocr)
SELECT t.version_id,(p->>'numero')::integer,t.sha256,coalesce(p->>'texto',''),coalesce((p->>'requiere_ocr')::boolean,false)
FROM doctrina.textos_extraidos t CROSS JOIN LATERAL jsonb_array_elements(t.paginas) p
ON CONFLICT(version_id,pagina) DO UPDATE SET sha256=excluded.sha256,texto=excluded.texto,requiere_ocr=excluded.requiere_ocr;
ANALYZE doctrina.indice_paginas;
COMMIT;
