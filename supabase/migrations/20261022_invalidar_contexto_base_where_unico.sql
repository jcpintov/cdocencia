-- Corrección del bloqueo 400/503 al reclasificar originales.
-- La invalidación contextual usa la llave primaria booleana, evitando
-- DELETE sin WHERE rechazado por el proxy/entorno de Supabase.
-- Se conserva el disparador, sin cambiar permisos ni datos documentales.
CREATE OR REPLACE FUNCTION doctrina.invalidar_contexto_base()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $sql$
BEGIN
  DELETE FROM doctrina.contexto_base WHERE unico IS TRUE;
  RETURN NULL;
END;
$sql$;
