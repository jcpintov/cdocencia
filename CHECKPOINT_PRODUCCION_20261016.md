# CHECKPOINT DE PRODUCCIÓN — CÁMARA DE DOCENCIA
Fecha: 2026-10-16 · Santiago de Chile
Alcance único: GitHub `jcpintov/cdocencia`, Vercel `cdocencia`, Supabase `pwnnpjygnviyzyyvfxnq`. No mezclar con otros desarrollos.

## Estado verificado
- Repo GitHub `main`: commit funcional `0b379d6d8f629e20e02e1b5d34a0c86ee36eb160`, integrado desde PR #6.
- Vercel: despliegue `dpl_GGxVxAZC1LzFkLdj3VhcCPULkF95`, estado `READY`, objetivo producción, dominio `cmaestros.ofl.cl`.
- CI: https://github.com/jcpintov/cdocencia/actions/runs/38950645924 — resultado `SUCCESS`, 16 casos de pruebas aisladas y sintaxis JS correcta.
- Supabase: 28 perfiles = 26 integrantes + 1 superadmin + 1 Dummy. Dos perfiles vinculados a Auth; tres cuentas Auth en total; una de estas últimas carece de perfil de Docencia (identificada, no eliminada). Se verificó ausencia de inconsistencias en los perfiles vinculados.
- Código del primer acceso: limitación del piloto a `dummy@ofl.cl` desde PR #5 `84f039c`. La variable de apertura `PRIMER_ACCESO_GENERAL_ENABLED` no está configurada en Vercel; por defecto no se envían códigos a los otros 26.
- Registro de OTP: se observó una emisión Dummy a las 18:52:47 UTC del 16-10-2026. El código vence automáticamente; la existencia del registro NO prueba entrega SMTP ni activación.
- Admin: PR #6 `0b379d6` impone cupo 26 en API, muestra 26/26 en panel, deshabilita «Agregar usuario» con padrón lleno, elimina acción de activación obsoleta y funciones heredadas; corrige validación regex de correo.
- Dos PR con comprobación de CI previa a publicación: #5, #6.
- No se modificaron los datos individuales de los 26 integrantes durante estas tareas.

## Pruebas efectuadas
- SQL transaccional para Dummy, con rollback: emisión, un minuto de espera, intentos, código correcto e incorrecto, caducidad, conservación de OTP hasta vinculación.
- CI con mocks de autenticación, SMTP y base de datos: casos positivos y negativos de emisión/verificación, denegación piloto, permisos admin, cupos, duplicados y acceso sin invitaciones.
- Consulta de errores de Vercel durante la última hora: ninguno reportado.
- El deploy READY y los mocks NO acreditan éxito del correo real ni de inicio de sesión.

## Pendientes por prioridad
1. E2E real solo con Dummy: validar recepción de email, código, creación Auth, asociación de perfil y primer inicio de sesión. Requiere comprobar la bandeja `dummy@ofl.cl` y la sesión final. **No abrir PRIMER_ACCESO_GENERAL_ENABLED** antes del cierre.
2. Evaluar recuperación ante fallo parcial entre createUser y vinculación; pruebas con mocks ya aprobadas, no hay transacción HTTP+Auth completamente atómica.
3. Continuar mejoras funcionales y visuales del Superadmin, sin habilitar controles administrativos que no estén implementados.
4. Revisar las advertencias Supabase caso a caso: 24 funciones SECURITY DEFINER accesibles para authenticated, RLS sin políticas deliberado en tablas privadas y protección de claves filtradas desactivada. Evitar restricciones masivas que rompan consultas.
5. Doctrina y Reglamentos permanece solo para Superadmin hasta validación documental y de seguridad.

## Decisiones y resguardos
- Exactamente 26 integrantes ordinarios; un único Superadmin; una cuenta de prueba separada.
- Sin invitaciones ni claves provisionales; activación individual por OTP de 8 dígitos y contraseña definitiva.
- No eliminar la tercera cuenta Auth sin perfil; puede servir a otros usos de la cuenta Supabase.
- Mantener repositorio público libre de documentos y secretos reservados.
- Próximos cambios: rama de corrección, pruebas de PR, merge y confirmación de estado READY.

## URLs
- Producción: https://cmaestros.ofl.cl
- Repositorio: https://github.com/jcpintov/cdocencia
- Pull requests: https://github.com/jcpintov/cdocencia/pull/5 y https://github.com/jcpintov/cdocencia/pull/6
- Contrato: CONTRATO_PRIMER_ACCESO.md
- Pruebas: tests/primer-acceso.test.mjs y tests/admin-usuarios.test.mjs
