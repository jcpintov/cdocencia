# Doctrina – Superadmin | Contrato de integración de consola v3

**Estado: interfaz implementada en rama de desarrollo; no aprobada para producción.**
Actualizado: 2026-10-12.

## Arquitectura presente

- `index.html` carga `admin-console-v3.css`, `doctrina/superadmin/floating-tab.js`,
  `doctrina/superadmin/bootstrap.js` y `doctrina/superadmin/auth-login.js`.
- La consola de **Docencia Admin** reside en `#seccionAdmin`. La hoja v3 no redefine el acceso ni los permisos.
- El componente conservó su nombre histórico `floating-tab.js` por compatibilidad, **pero ya no dibuja una pestaña flotante**:
  su botón `#doctrina-superadmin-tab` se inserta en `#seccionAdmin .admin-menu-list`.
- Al pulsarlo abre `#doctrina-superadmin-panel` como diálogo modal con fondo real, Escape, cierre,
  foco controlado, bloqueo temporal de desplazamiento y restauración al cerrar.
- El botón empieza **oculto**. Sólo aparece tras `auth.getUser()` y la respuesta positiva de
  `doctrina_es_superadmin()`, con segunda comprobación de identidad. Error, revocación o falta de sesión: denegar.
- Cuando hay sesión Supabase Auth vigente y autorizada, el botón de identidad de la consola
  reutiliza esa sesión tras volver a comprobar la RPC; no solicita otro OTP innecesariamente.
- En la política actual hay **una identidad titular autorizada**, y la interfaz de Doctrina sólo
  permite consultar los registros y la auditoría. No presenta acciones para dar privilegios a terceros.

## Restricciones de seguridad

1. **Separación estricta:** `public.usuarios.es_admin` de Docencia no concede privilegios Doctrina.
2. La autorización no depende de correos, variables del navegador, perfiles locales ni del hecho de ver el diálogo.
3. Las RPC administrativas deben volver a comprobar identidad y permiso en servidor en cada operación.
4. No exponer secretos, `service_role`, contraseñas ni documentos reservados en el frontend.
5. Nunca enviar documentos reservados a LLM externos sin autorización específica.
6. No activar usuarios administrativos adicionales sin una nueva política aprobada.

## Estado de pruebas y limitaciones

- Pruebas automáticas de navegación, foco, Escape, diálogo, roles y ausencia de delegación en UI:
  <https://github.com/jcpintov/cdocencia/actions/runs/38199556535> (satisfactorio).
- Última comprobación agregada de Supabase: **1** Superadmin activo titular, **0** terceros activos.
- **No certificado aún:** QA visual y funcional real en Chrome/Brave y dispositivo móvil con sesión institucional.
- **Pendiente servidor:** la función `public.doctrina_admin_cambiar` permite delegar privilegios
  a otra identidad confirmada; la UI nueva no la invoca, pero debe restringirse mediante migración revisada.
  Borrador no aplicado: `migrations/20261012_titular_unico_NO_APLICAR.sql`.
- Continúa pendiente el corte seguro de recuperación heredada de Docencia.
- No fusionar a main ni aprobar despliegue operativo sin conformidad final del titular.
