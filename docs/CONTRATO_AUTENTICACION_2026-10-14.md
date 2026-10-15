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

## Regla adicional aprobada: correo no registrado
- Nunca generar ni devolver token para correos ausentes del padrón.
- Para correo registrado: entregar código temporal por correo y permitir establecer contraseña personal.
- Para correo no registrado: enviar, sujeto a controles antiabuso, «Su dirección de correo electrónico no se encuentra registrada. Póngase en contacto con el administrador».
- La respuesta de la interfaz será indistinguible en ambos casos: «Solicitud recibida. Si la dirección ingresada es válida, recibirá un correo electrónico con las instrucciones correspondientes».
- Enviar correos exclusivamente desde el servidor; límites por dirección e IP; nunca permitir enumeración desde el navegador.
- No activar este flujo hasta disponer de infraestructura de correo y pruebas de extremo a extremo.

## Comprobación de infraestructura 2026-10-14
- Vercel cdocencia (producción): no se observaron variables de entorno configuradas.
- Vercel cdocencia-seguridad-lab: variables SMTP presentes para entorno preview, sin comprobar contenido ni entrega.
- Supabase: no existen Edge Functions desplegadas.
- El flujo actual de recuperación está deshabilitado preventivamente en el frontend porque el RPC heredado devuelve un token directamente al cliente.
