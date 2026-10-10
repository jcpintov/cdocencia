# Superadmin Doctrina — contrato de integración (no productivo)

La pestaña flotante en `doctrina/superadmin/floating-tab.js` es un prototipo oculto por defecto. No se incorpora a `index.html` hasta que exista un endpoint privado verificado.

## Requisitos de servidor

1. Validar el JWT con Supabase Auth en cada petición privilegiada; no aceptar IDs o roles aportados por el cliente como prueba de autorización.
2. Comprobar `auth.uid()` contra `doctrina.superadmins.auth_user_id` y `activo = true`, en contexto de servidor confiable, con permisos mínimos. No relacionar privilegios con `public.usuarios` ni con el rol administrativo de Docencia.
3. El endpoint de elegibilidad devuelve solo `{\"authorized\": true|false}`, sin filas ni identificadores de Superadmin. Denegar por defecto ante error o sesión ausente.
4. Cada acción administrativa requiere su propia comprobación de autorización, además de RLS y registro de auditoría; mostrar la pestaña nunca concede permisos.
5. No exponer `service_role`, secretos, tokens ni datos reservados en HTML/JS público. No enviar documentos a LLM externos sin consentimiento individual.
6. No crear Superadmins automáticamente; alta inicial mediante procedimiento administrativo separado y aprobado.

## Pruebas obligatorias antes de conectar

- Sesión anónima: denegada; usuario Docencia administrador: denegado.
- Usuario Auth no registrado: denegado; Superadmin inactivo: denegado.
- Superadmin activo: autorizado únicamente con sesión válida y verificación de servidor.
- Revocación, expiración y cambio de sesión: se vuelve a comprobar en cada operación.
- No se leen documentos reservados en pruebas; usar identidades sintéticas en entorno aislado.

**Estado:** contrato de implementación, sin endpoint creado ni cambio en Supabase o producción.
