# Doctrina — Ingesta documental (desarrollo)

Estado: **esquema privado aplicado en Supabase**, 2026-10-10. Migración `create_private_doctrina_ingestion_core` en proyecto `cmaestros-docencia`.

## Aislamiento
- Esquema PostgreSQL `doctrina`, no expuesto a PostgREST.
- Tablas: `documentos`, `versiones`, `trabajos`, `unidades`, `afirmaciones`, `relaciones`, `publicaciones`, `publicacion_fuentes`, `eventos`.
- RLS habilitada; sin políticas para roles web; permisos `anon` y `authenticated` revocados.
- No subir originales, extractos confidenciales, claves, tokens o credenciales al repositorio.

## Contratos
Docencia: solo derivados aprobados. Doctrina: acceso exclusivo Superadmin, con autorización en servidor y registro de auditoría. La bibliografía filosófica no sustituye el fundamento institucional de respuestas reglamentarias.

## Pendientes antes de cargar documentos
1. Crear bucket privado por API de Storage (no manipular tablas `storage` mediante SQL).
2. Implementar autenticación fuerte y autorización Superadmin en servidor, sin confiar en `es_admin` suministrado por cliente.
3. API PHP de carga, límites de tamaño/tipo, antivirus, hashing, transacciones y limpieza de cargas incompletas.
4. Worker Python para extracción PDF/DOCX, revisión OCR, segmentación, destilación y verificación de citas.
5. Integración LLM bajo política explícita de privacidad y autorización para tratamiento externo de documentos reservados.
6. Pruebas de aislamiento, recuperación, concurrencia, idempotencia y publicación con aprobación humana.

**No está habilitada la carga en producción.** Los documentos originales se conservan íntegros; el LLM propone análisis, nunca sanciones ni autoridad institucional.
