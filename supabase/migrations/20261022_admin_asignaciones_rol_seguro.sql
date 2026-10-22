-- Alcance: solo la RPC administrativa de asignaciones, invocada con service_role.
-- El invocador carece de SELECT sobre auth.users y la comprobación de identidad
-- falla con 42501. No conceder acceso a auth.users ni relajar RLS.
-- La función mantiene el chequeo interno auth.role()='service_role',
-- la verificación de auth.users y el search_path vacío preexistente.
ALTER FUNCTION public.admin_asignaciones_docentes(uuid, text, jsonb)
  SECURITY DEFINER;

-- Defensa en profundidad: ninguna función administrativa de asignaciones
-- debe ejecutarse por roles de navegador.
REVOKE ALL ON FUNCTION public.admin_asignaciones_docentes(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_asignaciones_docentes(uuid,text,jsonb) TO service_role;
