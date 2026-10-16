# Checkpoint de producción — Cámara de Docencia
**Fecha:** 2026-10-16 (America/Santiago)  
**Alcance:** únicamente `jcpintov/cdocencia`, proyecto Vercel `cdocencia` y Supabase `pwnnpjygnviyzyyvfxnq`. No mezclar con otros proyectos.

## Estado comprobado
- GitHub: rama `main`, commit `ce49114d3ca4f7680c2fe8e2a2bbb89d134d8233`.
- Vercel: despliegue `dpl_7ewsN3PCqq2Au5aZLGEuqbiSGc3t`, entorno `production`, estado `READY`, dominio `cmaestros.ofl.cl` asignado.
- GitHub Actions: ejecución `38938845829`, conclusión `success`; pasos de sintaxis JavaScript y pruebas aisladas de primer acceso satisfactorios.
- Supabase: 28 perfiles (26 ordinarios, un superadmin, un Dummy). Dos perfiles enlazados con Auth. Tres registros Auth, uno sin perfil asociado. No hay emails de Auth duplicados en perfiles pendientes.
- OTP: dos funciones `primer_acceso_emitir` y `primer_acceso_verificar` son exclusivas de `service_role`; migración `primer_acceso_verificacion_recuperable_20261016` aplicada.
- Pruebas SQL reversibles realizadas con Dummy: emisión, limitación 60 segundos, error de código, intento contado, verificación correcta, preservación hasta enlace, límite de 5 intentos y expiración. Ningún dato de las 26 cuentas se modificó.
- Repo GitHub es público. Inventario de Git actual: código y recursos gráficos, sin documentos doctrinales completos como archivos versionados. Las tablas y documentos reservados deben seguir protegidos en Supabase.
- Vercel Runtime Errors: sin errores reportados en la última hora consultada. No equivale a una prueba end-to-end.

## Pendientes ordenados
1. **BLOQUEO DE VALIDACIÓN — E2E primer acceso:** comprobar envío real a la casilla Dummy, recepción del código, confirmación, creación en Auth, vinculación y primer inicio de sesión. No se tiene acceso a dicha bandeja ni mecanismo para invocar la API privada desde este entorno.
2. **PILOTO INCOMPLETO:** el endpoint de primer acceso es accesible para perfiles pendientes que conozcan su email; no se ha aplicado la limitación temporal solo a Dummy. Intento anterior de modificación bloqueado por controles de la herramienta. No declarar la activación general liberada.
3. **Recuperación de fallos:** ensayar caída SMTP y error tras crear Auth; una cuenta Auth sin perfil está detectada y requiere clasificación antes de modificar datos.
4. **Medidas proporcionales:** evaluar un límite simple de solicitudes por origen/correo desconocido solo si se confirma necesidad; no añadir servicios ni infraestructura corporativa.
5. **Panel administrativo:** revisar acción antigua `activar` del endpoint `admin-usuarios` (responde 501), cuya interfaz actualmente solo usa `crear`. Evitar falsos mensajes de activación.
6. **Doctrina:** continuar exclusivamente para superadmin hasta revisión documental y acceso.
7. **Advertencias Supabase:** RLS sin políticas en tablas privadas (esperado para tablas de bloqueo), 24 funciones SECURITY DEFINER accesibles para autenticados (revisar guardas caso a caso), y protección de contraseñas filtradas desactivada. No revocar indiscriminadamente RPC necesarias.

## Condición de liberación
No declarar terminada la activación masiva hasta que funcionen las pruebas reales de correo, Auth y sesión y se documente cómo manejar un fallo parcial. No usar credenciales personales ni tocar los 26 perfiles en pruebas.

## Enlaces
- Repositorio: https://github.com/jcpintov/cdocencia
- Pipeline: https://github.com/jcpintov/cdocencia/actions/runs/38938845829
- Contrato de primer acceso: CONTRATO_PRIMER_ACCESO.md
- Código API: api/primer-acceso.js
