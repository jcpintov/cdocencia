# Procedimiento de provisión inicial de Superadmin (Doctrina)

**Estado:** diseño para revisión; no habilita acceso ni altera producción.

## Frontera de privilegios
- Docencia y Doctrina/Superadmin tienen autorizaciones independientes. Un administrador de Docencia no es Superadmin por herencia.
- Solo una identidad verificada de Supabase Auth puede ser candidata a Superadmin; el navegador, el correo declarado y los roles locales no acreditan autorización.
- El panel flotante es únicamente interfaz. Toda operación privilegiada exige autorización del servidor en cada solicitud.
- La lista positiva de Doctrina se mantiene cerrada hasta que exista una aprobación específica para el alta inicial.

## Evidencia previa al alta
1. Identificar al titular y la identidad Auth mediante canal administrativo seguro, sin registrar credenciales ni tokens en GitHub.
2. Documentar responsable de solicitud, aprobación independiente, fundamento, alcance y fecha.
3. Revisar permisos y controles de acceso de Doctrina; confirmar que la comprobación de elegibilidad deniega anónimos y que no existe lectura directa de la lista positiva.
4. Asegurar que la cuenta candidata tenga autenticación segura y un mecanismo de recuperación aprobado.
5. Ensayar con identidades sintéticas en un entorno aislado; actualmente no se ha verificado que exista una rama de Supabase para pruebas.

## Ejecución futura (requiere aprobación explícita)
- La provisión debe efectuarse por un operador autorizado desde un canal administrativo confiable; nunca desde JavaScript público ni mediante una función RPC anónima.
- Registrar un único alta justificada y verificar que su identidad corresponda a la cuenta Auth esperada.
- Validar una sesión activa y los escenarios de anónimo, usuario Docencia, usuario Auth no autorizado, cuenta inactiva, revocación y cambio de sesión.
- Auditar quién autorizó, quién ejecutó y cuál fue el resultado, sin almacenar secretos.
- Ante fallo, no ampliar permisos ni desactivar RLS: cerrar la operación y activar el procedimiento de revocación revisado.

## Criterios de aceptación
- La lista de Superadmin no se modifica sin autorización final.
- No hay transferencia de permisos desde Docencia.
- Se mantienen denegados los accesos anónimos y las lecturas directas de la lista.
- Las acciones administrativas verifican autorización independientemente de la visibilidad del panel.
- Pruebas y auditoría completas antes de conectar la interfaz o desplegar.

## Verificación observada (2026-10-10)
Proyecto Supabase `cmaestros-docencia`: activo y saludable; cero Superadmin registrados y activos; RLS habilitado en la lista, sin políticas; sin acceso directo para `anon` ni `authenticated`; comprobación de elegibilidad ejecutable por `authenticated` pero no por `anon`; función `SECURITY DEFINER` con `search_path` vacío y referencia a Supabase Auth. No existe rama de desarrollo Supabase.

Estas verificaciones se hicieron mediante consultas de solo lectura. No se ejecutó ningún alta, migración o despliegue.
