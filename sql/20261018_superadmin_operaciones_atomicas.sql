-- Operaciones atómicas para Superadmin, llamadas exclusivamente por servicio privado.
-- No exponer ejecución a clientes autenticados/anon.
CREATE OR REPLACE FUNCTION public.admin_eliminar_modulo_seguro(p_modulo_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE n integer; afectadas integer;
BEGIN
 IF p_modulo_id IS NULL THEN RAISE EXCEPTION 'Módulo requerido'; END IF;
 PERFORM pg_advisory_xact_lock(146, 20261018);
 DELETE FROM public.modulos WHERE id=p_modulo_id;
 GET DIAGNOSTICS afectadas=ROW_COUNT;
 IF afectadas<>1 THEN RAISE EXCEPTION 'Trabajo inexistente o ya eliminado'; END IF;
 -- Fase temporal lejos del rango definitivo para respetar UNIQUE(numero_orden).
 UPDATE public.modulos SET numero_orden=numero_orden+1000000;
 WITH ordenado AS (
   SELECT id, row_number() OVER(ORDER BY numero_orden,id)::integer AS nuevo
   FROM public.modulos
 )
 UPDATE public.modulos m SET numero_orden=o.nuevo
 FROM ordenado o WHERE m.id=o.id;
 SELECT count(*) INTO n FROM public.modulos;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.admin_eliminar_modulo_seguro(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_eliminar_modulo_seguro(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_configurar_temas_modulo(
 p_modulo_id uuid,p_principal text,p_codigos text[]
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE n integer; total integer;
BEGIN
 IF p_modulo_id IS NULL OR p_codigos IS NULL THEN RAISE EXCEPTION 'Parámetros requeridos'; END IF;
 PERFORM pg_advisory_xact_lock(147, 20261018);
 IF NOT EXISTS(SELECT 1 FROM public.modulos WHERE id=p_modulo_id FOR UPDATE) THEN
   RAISE EXCEPTION 'Trabajo inexistente';
 END IF;
 IF cardinality(p_codigos)>30 OR array_position(p_codigos,NULL) IS NOT NULL THEN
   RAISE EXCEPTION 'Cantidad o contenido inválido';
 END IF;
 SELECT count(DISTINCT c) INTO n FROM unnest(p_codigos) AS c;
 IF n<>cardinality(p_codigos) THEN RAISE EXCEPTION 'No se permiten códigos repetidos'; END IF;
 IF p_principal IS NOT NULL AND NOT (p_principal=ANY(p_codigos)) THEN
   RAISE EXCEPTION 'El código principal debe formar parte de los temas vinculados';
 END IF;
 IF p_principal IS NULL AND n>0 THEN
   RAISE EXCEPTION 'Elija un código principal antes de vincular temas';
 END IF;
 SELECT count(*) INTO total FROM public.unidades_docencia u
 WHERE u.codigo=ANY(p_codigos) AND u.activo=true
 AND u.codigo ~ '^(INCI|INST|FILO|ETIC)[0-9]{2}[0-9A-Z][A-Z]$';
 IF total<>n THEN RAISE EXCEPTION 'Uno o más códigos no corresponden a temas vigentes'; END IF;
 UPDATE public.modulos SET unidad_codigo=p_principal WHERE id=p_modulo_id;
 DELETE FROM public.modulos_temas WHERE modulo_id=p_modulo_id;
 INSERT INTO public.modulos_temas(modulo_id,codigo)
 SELECT p_modulo_id,codigo FROM unnest(p_codigos) codigo;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.admin_configurar_temas_modulo(uuid,text,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_configurar_temas_modulo(uuid,text,text[]) TO service_role;
