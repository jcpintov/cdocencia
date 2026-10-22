-- Ajuste mínimo para restaurar filtros del padrón desde sesión autenticada.
-- La RLS existente continúa decidiendo qué filas puede consultar cada usuario.
-- NO conceder SELECT de tabla completa ni exponer clave_hash/token_recuperacion.
GRANT SELECT (cuenta_eliminada) ON TABLE public.usuarios TO authenticated;
