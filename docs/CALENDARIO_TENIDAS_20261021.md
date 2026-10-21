# Calendario de trabajos de tenidas

Acceso: Administración → Calendario de tenidas, exclusivamente Superadmin.

Cada registro contiene fecha de tenida, grado (1 Aprendiz, 2 Compañero, 3 Maestro), tema y autor. El autor admite sugerencias del padrón y nombres libres. Puede haber varios trabajos en la misma fecha. Vista mensual con navegación y selección de mes, filtro por grado y agenda de mes o día; adaptación móvil. Agregar trabajo abre el formulario; pulsar un día sin trabajos propone su fecha. Los registros existentes se modifican desde calendario o agenda. Eliminar requiere confirmación y conserva el registro con activo=false.

Los datos se guardan en calendario_tenidas. RLS forzada y sin privilegios para anon/authenticated; acceso servidor con service_role. API admin-tenidas verifica Auth y el perfil del único Superadmin antes de leer o escribir. No se envían correos, no se crean asignaciones docentes ni se publica contenido para USERS.

Alta con UUID estable por formulario para reintentar sin duplicados; edición con versión para evitar sobrescrituras entre pestañas y eliminación lógica idempotente. No se anuncia guardado sin fila confirmada. Plazo de solicitud de veinte segundos con conservación de datos ante errores. Las respuestas de consultas obsoletas y de sesiones cerradas se descartan. Hoy y mes inicial usan la fecha de Santiago; los registros guardan fechas sin conversiones horarias.

Verificación: 153 pruebas Node aprobadas localmente; API cubre permisos, validación, reintento, edición, conflictos, eliminación lógica y listado. SQL real con rollback aprobó inserción, modificación, restricción de grado, anulación y ausencia de privilegios USER/anónimo, sin conservar registros sintéticos. Chromium prueba calendario y formulario en escritorio/móvil, creación con confirmación interrumpida, edición, conflicto, filtros, meses, eliminación y salida. Las pruebas de navegador usan datos aislados.
