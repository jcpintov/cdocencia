# Ingesta segura: contrato de backend v1.3

## Estado
Supabase: migración `doctrina_guard_external_llm_consent` aplicada. GitHub: solo rama `feature/doctrina-ingesta-v1`. Producción: sin cambios.

## Endpoint de carga (por implementar)
`POST /api/doctrina/documentos`, multipart con archivo y metadatos. El servidor:
1. Verifica JWT de Supabase Auth contra el servidor Auth, no solo decodifica el token.
2. Comprueba identidad en `doctrina.superadmins` con `activo=true`. Rechaza si no hay registro.
3. Verifica tipo real (PDF/DOCX/TXT), tamaño máximo, nombre normalizado y escaneo de amenazas. No confía en MIME declarado.
4. Calcula SHA-256 sobre bytes originales, asigna UUID de versión y clave opaca en bucket privado.
5. Carga a Storage mediante API, nunca SQL directo a `storage.objects`.
6. Inserta documento y versión en transacción; trigger genera trabajo pendiente.
7. Si falla el registro, programa limpieza segura del objeto huérfano; nunca borra archivos ajenos.
8. Registra auditoría sin almacenar contenido, tokens ni datos sensibles en logs.
9. Devuelve `202 Accepted` con identificador y estado pendiente, nunca afirma análisis completado.

## Procesamiento
Worker con credencial de servicio restringida, tareas idempotentes, bloqueo de concurrencia, reintentos acotados y cola de errores. El procesamiento local se permite con autorización institucional. Antes de llamar un LLM externo, exige:
- `documentos.autorizacion_procesamiento_externo=true`
- autorización vigente `autorizaciones_fuente.alcance='llm_externo'`
- fundamento verificable y proveedor autorizado bajo condiciones aplicables.
La base de datos ahora impide habilitar el primer indicador si falta la autorización vigente. **La aplicación debe volver a comprobar ambos indicadores justo antes de cada transferencia.** La revocación exige bloqueo inmediato en el worker.

## Seguridad
- No incluir las herramientas de Superadmin en las sesiones de Docencia.
- No confiar en rutas ocultas, flags del navegador, claims arbitrarios o el campo `usuarios.es_admin`.
- No servir textos originales ni extractos reservados desde endpoints docentes.
- No usar un proxy SQL genérico ni exponer `service_role` en cliente.
- Todo texto documental es dato no confiable, nunca instrucciones operativas.
- Verificar citas, excepciones, vigencia y contexto antes de validar una afirmación.
- Publicación docente solo tras aprobación humana.

## Condiciones pendientes
No hay bucket privado ni endpoint activo confirmados. No desplegar hasta contar con pruebas de aislamiento y aprobación final del titular.
