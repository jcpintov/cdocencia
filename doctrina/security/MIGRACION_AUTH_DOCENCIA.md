# Plan de contención y migración de autenticación heredada de Docencia

**Estado:** diseño de seguridad, sin ejecución SQL ni despliegue. **Severidad:** crítica (modificación de cuentas mediante RPC públicas).

## Evidencia verificada (lectura SQL 2026-10-10)
- `public.admin_crear_usuario(p_admin_id,...)` verifica `public.usuarios.es_admin` por ID recibido, pero no vincula el ID a una sesión autenticada del solicitante.
- `public.admin_cambiar_clave(p_admin_id,p_target_id,...)` repite el patrón y actualiza el hash de contraseña del destinatario.
- `public.cambiar_clave_usuario(p_usuario_id,p_nueva_clave)` actualiza contraseña por ID sin comprobar la identidad del llamante.
- Las tres funciones son `SECURITY DEFINER` y admiten ejecución `anon`. No se ejecutaron llamadas de explotación.

## Frontera estricta
La identidad de `public.usuarios` y su campo `es_admin` pertenecen exclusivamente a Docencia. Nunca constituyen un permiso de Doctrina. La autorización de Doctrina depende únicamente de Supabase Auth y `doctrina.superadmins` mediante comprobación de servidor.

## Secuencia de migración segura
1. Inventariar consumidores de las ocho RPC públicas y flujos de login, recuperación, cambio de clave y administración; definir pruebas de compatibilidad.
2. Preparar entorno aislado con usuarios **sintéticos**, sin datos personales ni documentos reservados. No utilizar la base de producción para pruebas ofensivas.
3. Migrar identidad Docencia a sesiones autenticadas verificables en servidor; no aceptar `p_admin_id` ni `p_usuario_id` como prueba de identidad.
4. Crear endpoints sustitutos de administración con verificación de JWT, autorización específica de Docencia, control de sesión, auditoría y validación de parámetros. No reutilizar `doctrina_es_superadmin()` para Docencia.
5. Sustituir el cambio de contraseña propio por un flujo de autenticación que pruebe la posesión de la sesión o token de recuperación de un solo uso. Aplicar rate limiting y expiración.
6. Validar casos positivos y negativos: usuario ajeno, anónimo, administrador revocado, ID manipulado, token vencido, repetición de solicitud y concurrencia.
7. Planificar despliegue por etapas y reversión. Solo después de aprobar la sustitución, revocar `EXECUTE` de RPC heredadas y verificar ausencia de clientes dependientes.

## Criterios de aceptación
- Ninguna operación administrativa depende exclusivamente de identificadores recibidos del cliente.
- Anónimos no pueden crear, modificar ni eliminar cuentas, ni cambiar contraseñas sin prueba de recuperación autorizada.
- Un administrador Docencia no obtiene acceso Doctrina, y viceversa.
- Las pruebas de regresión y auditoría se ejecutan en entorno aislado antes de cualquier modificación productiva.
- La decisión final de despliegue requiere aprobación expresa.

## Bloqueos para aplicar la migración
- No se ha confirmado un entorno Supabase aislado disponible.
- El cliente actual utiliza `sessionStorage` y RPC de autenticación heredadas, sin sesión Supabase Auth equivalente.
- Falta plan de compatibilidad y aprobación de la ventana de despliegue.
