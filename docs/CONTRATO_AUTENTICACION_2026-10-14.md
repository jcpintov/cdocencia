# Contrato de autenticación aprobado — Cámara de Docencia
Fecha: 2026-10-14
Estado: APROBADO / IMPLEMENTACIÓN PENDIENTE

## Decisiones definitivas
- Sin invitaciones por correo.
- Únicamente dos perfiles: USUARIO y SUPERADMIN.
- Alta de usuarios a cargo del SUPERADMIN.
- Login habitual: correo y contraseña personal.
- En el login, opción «Obtener / Recuperar clave».
- Solicitar correo; respuesta pública uniforme para correos existentes e inexistentes.
- Si existe y está habilitado, emitir código temporal de un solo uso por canal de correo, nunca contraseña en texto claro.
- Código con caducidad de 15 minutos; almacenar solo verificador hash; invalidar tras uso; limitar solicitudes e intentos.
- Validar el código en el servidor y permitir definir nueva contraseña personal.
- No exigir comprobación de correo en cada acceso, ni rotación periódica de contraseña, ni MFA al usuario común.
- No revelar existencia de cuentas por mensajes, tiempos de respuesta o errores.
- No registrar códigos, contraseñas ni secretos en bitácoras.
- Mantener RLS y autorización del lado servidor; no confiar en roles declarados por el navegador.
- No habilitar Doctrina a usuarios hasta validación documental y de seguridad.

## Secuencia de trabajo
1. Inspeccionar autenticación existente y dependencias de recuperación.
2. Implementar emisión/verificación segura de códigos en backend y formulario accesible en frontend.
3. Probar correo existente, inexistente, código expirado, reutilizado, intentos excesivos y cambio de contraseña.
4. Validar USUARIO y SUPERADMIN, incluida recuperación del único SUPERADMIN.
5. Finalizar panel administrativo y luego Doctrina.

## Riesgos pendientes detectados
- app.js contiene cierre automático tras cinco minutos: revisar experiencia de lectura y acordar duración operativa razonable.
- Supabase security advisor identifica funciones SECURITY DEFINER ejecutables por authenticated: inspeccionar guardas de autorización antes de restringir o mantener.
- RLS habilitado no equivale a políticas correctas; validar permisos y RPC por separado.

## Criterio de liberación
No desplegar el nuevo flujo en producción hasta completar pruebas de extremo a extremo, revisión de permisos y rollback.
