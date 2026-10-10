# Verificación de esquema y límites de prueba — 2026-10-10

## Inspección directa (solo lectura)

Proyecto Supabase: pwnnpjygnviyzyyvfxnq.

- 14 tablas en el esquema doctrina; todas reportan RLS habilitado.
- doctrina.trabajos: 0 registros.
- doctrina.superadmins activos: 0.
- doctrina.permisos_servicio activos: 0.
- El esquema real incluye arrendado_hasta, procesador_id, iniciado_en, actualizado_en y finalizado_en en trabajos.
- Los estados admitidos en versiones son pendiente, procesando, listo, error y revision.
- Los estados de unidades son pendiente, validado y observado.
- Los estados de afirmaciones son pendiente, aprobado y rechazado.
- La tabla superadmins utiliza auth_user_id, no user_id.
- La tabla publicaciones utiliza aprobado_por y publicado_en.
- No se aplicó la migración propuesta de protección de publicaciones.

## Pruebas

- Ejecución local de extractor anterior: 5/5 (no cubre la versión actual).
- Pruebas del adaptador, renovación y recuperación: incorporadas a la rama; CI no confirmado.
- No se realizó una prueba de concurrencia con dos conexiones PostgreSQL.
- No se activó worker ni conexión a Storage.
- No se introdujeron documentos reservados.

## Riesgos de salida

1. Comprobar los privilegios reales por rol y el acceso a Storage en entorno aislado.
2. Probar transacciones concurrentes y bloqueos con dos conexiones independientes.
3. Auditar la migración de publicación contra revocaciones posteriores, validaciones y permisos.
4. Validar la extracción DOCX frente a ZIP bombs y PDF adversarial.
5. Obtener aprobación final antes de desplegar o habilitar privilegios.

La revisión de esquema y la ejecución de consultas de conteo no equivalen a una certificación de seguridad.
