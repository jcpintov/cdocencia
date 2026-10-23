# Rol Administrador — 2026-10-23

Rol habilitado en la base de datos; interfaz y API nuevas en la rama del PR 55, sin fusionar ni desplegar. No se ha nombrado ningún Administrador.

## Permisos

| Capacidad | Administrador | Superadmin |
| --- | --- | --- |
| Crear/editar usuarios ordinarios, gestión docente, asignaciones y calendario | Sí | Sí |
| Biblioteca, trabajos, cuestionarios, comentarios e informes | Sí | Sí |
| Otorgar/retirar rol Administrador | No | Exclusivo |
| Editar cuentas administrativas o identidad principal | No | Protegidas; perfil principal mediante OTP |
| Configuración institucional, seguridad, integraciones y autorización de proveedores externos | No | Exclusivo |

El padrón mantiene separados usuarios y administradores. Solo Superadmin ve «Hacer administrador» para cuentas vinculadas y «Retirar rol» para administradores delegados. El cambio exige motivo y cuenta activada; nunca permite conceder SUPERADMIN. La revocación se consulta en servidor y base sin depender de metadatos editables ni de refrescar el JWT. Los documentos personales del Orador y su memoria conservan el aislamiento por actor.

## Implementación y verificación

- Migración `20261023171810_rol_administrador.sql` aplicada, versión alineada con el historial de Supabase. Agrega USER/ADMIN/SUPERADMIN, coherencia con el indicador legado, un solo Superadmin, verificación de identidad activa, RPC exclusiva de servicio y auditoría privada.
- Los helpers de Superadmin permanecen exclusivos; las políticas operacionales usan un helper separado. `config_segura` no se delega.
- Roles no editables por el cliente; trigger adicional contra ascenso si accidentalmente se amplían permisos de columna. Solo el endpoint de gestión verificado llama la RPC de roles.
- Endpoint de roles: 15 s de plazo total y aborto, 30 s de límite Vercel compartido, respuesta privada y Server-Timing. Distingue entrada inválida, sesión, autorización, conflicto y fallos del servidor; nunca filtra errores internos.
- 327 pruebas Node aprobadas: autorización por rol, APIs delegadas, rechazo de datos/metadatos falsificados, protección de cuentas administrativas, 400/401/403/404/405/409/422/503/504 y plazo total.
- PostgreSQL aislado: compilación de la migración completa; otorgamiento, auditoría, conflicto, cuenta no activada, prohibición de autoascenso y de modificar al principal, RPC inaccesible al cliente, RLS de configuración, acceso operacional y revocación inmediata.
- Chromium: modal para cambio de rol, error HTTP 500 sin cerrar el formulario, otorgamiento y revocación, padrón actualizado y botones ausentes para Administrador. Regresión de los tres informes y PDF, escritorio/móvil, respuestas 400/401/403/500/503, JSON inválido y respuesta incompleta.
- Regresiones de asignaciones, usuarios, calendario, Doctrina/perfil, plataforma DOM, Orador y memoria aprobadas. Sintaxis JavaScript verificada.
- Última medición sintética local de informes: vista 117/20/17 ms y PDF 100/54/46 ms (asignaciones/avances/actividad). No representa latencia productiva.

## Verificación real posterior a la migración

28 perfiles USER, 1 SUPERADMIN y 0 ADMIN; principal verificado y listado de asignaciones accesible mediante servicio. No se promovieron cuentas de prueba ni usuarios reales. RPC de roles: servicio sí, anon/authenticated no. UPDATE de la columna rol: authenticated no. Configuración exclusiva preservada y cinco políticas operacionales delegadas.

Advisors: sin ERROR. La auditoría privada nueva tiene RLS sin políticas y ACL cerrada deliberadamente; el helper operacional SECURITY DEFINER es un predicado de autorización del usuario actual utilizado por RLS. Persisten los avisos previos de funciones autenticadas y protección de contraseñas filtradas. No se abrieron políticas públicas para silenciar estos avisos.

Los endpoints de informes y roles conservan sus URL mediante rewrites a la función de administración de usuarios; cada handler vuelve a verificar su identidad y permisos. Esto mantiene 12 funciones, dentro del límite Hobby.

La sesión real en la nueva interfaz se verificará al publicar; no se afirma haber desplegado ni haber asignado el rol a una persona. En el panel publicado: Usuarios y padrón → Hacer administrador → motivo → Confirmar cambio. Superadmin puede retirarlo en el listado separado de Administradores.
