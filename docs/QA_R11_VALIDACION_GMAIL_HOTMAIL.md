# R11 — Matriz de aceptación de la nueva interfaz Auth (solo laboratorio)

**NO ingresar credenciales en GitHub, ChatGPT ni capturas.** Ejecutar estas pruebas únicamente en una preview `READY` cuyo SHA coincida con el commit reciente de la rama `fix/roles-enter-20261012`. El backend de laboratorio utiliza la **misma base Supabase compartida**: las acciones de guardar, publicar, editar y registrar avances pueden modificar datos reales. En este protocolo **no ejecutar ninguna operación de escritura salvo el ingreso, que registra bitácora**.

## Preparación
1. Comprobar en Vercel que el último commit de `acceso-seguro.html`, `acceso-seguro.js`, `acceso-seguro.css`, `vercel.json` y `api/security/session.js` está desplegado. No probar contra una URL de preview anterior.
2. Abrir `https://<preview-verificado>/acceso-seguro.html` en ventana privada con HTTPS.
3. Revisar cabeceras HTTP: `Content-Security-Policy` (con `frame-ancestors 'none'`), `Cache-Control: no-store`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
4. Verificar que el navegador carga `acceso-seguro.js` y `acceso-seguro.css` sin fallas de CSP; nunca desactivar seguridad del navegador para que funcione.
5. Abrir `/api/security/session` sin token en pestaña nueva: debe devolver 401, sin información de usuarios.

## Caso A — Gmail SUPERADMIN
- Ingresar exclusivamente la contraseña personal de Supabase Auth para `jpintov@gmail.com`.
- Debe aparecer `SUPERADMIN`, comprobación de identidad y auditoría.
- Debe mostrarse padrón institucional, editor y supervisión. `Mi Docencia` como participante debe estar oculto.
- Consulta de solo lectura del padrón: 27 perfiles; vínculo Auth confirmado para los dos pilotos.
- Indicadores: 27 perfiles, 2 vinculados, 25 pendientes, un Superadmin, cero duplicados.
- Editor: 5 trabajos, sin pulsar Guardar ni modificar preguntas.
- La gestión de fuente doctrinal sigue reservada al Superadmin y en cuarentena, sin publicar corpus.
- Cerrar sesión y verificar que el panel deja de ser visible.

## Caso B — Hotmail USER
- En nueva ventana privada, ingresar con `jpintov@hotmail.com` y su contraseña de Supabase Auth.
- Debe aparecer `USER`, registro de auditoría e interfaz de `Mi Docencia`.
- **NO** debe aparecer gestión de padrón, editor Superadmin ni otras capacidades administrativas.
- Consultar avances: los 5 trabajos esperados del perfil piloto, sin escrituras.
- Seleccionar un trabajo y pulsar `Leer trabajo y preguntas, sin soluciones`: texto docente y 8 preguntas con opciones, sin `respuesta_correcta` ni `retroalimentacion`.
- No marcar lectura, no enviar comentarios, no consagrar reflexión durante esta primera prueba.
- Cerrar sesión, recargar, confirmar que se solicita ingresar otra vez.

## Caso C — Sin vínculo y fallos negativos
- No usar ni pedir contraseñas de terceros. Utilizar únicamente una cuenta propia legítimamente no vinculada cuando exista y la autorice el titular.
- Supabase Auth puede aceptar una cuenta confirmada, pero `/api/security/session` debe responder 403 si no existe vínculo UUID institucional.
- Simular un fallo de auditoría solo en pruebas unitarias, NO cambiando funciones de la base compartida. Resultado esperado: limpieza de sesión.
- Correo inválido: formulario no debe llamar a Auth y debe vaciar el campo contraseña.
- Sin token: `/api/security/session` responde 401 y nunca datos personales.

## Criterios de liberación
- Todos los casos observados con evidencias sin contraseñas/JWT.
- Ausencia de errores críticos CSP, consola, endpoint Auth o permisos.
- No hay lectura/escritura REST directa a las seis tablas protegidas; solo RPC con token.
- Sin cambios de rol por correo enviado desde navegador, ni SUPERADMIN como alumno.
- No habilitar Doctrina USER ni promocionar a `cmaestros.ofl.cl` por el mero éxito del login: requiere aprobación técnica completa y pruebas adicionales de flujos de escritura.
- Fallo de cualquiera: bloquear promoción, conservar logs de ERROR sin tokens, corregir en rama y repetir.
