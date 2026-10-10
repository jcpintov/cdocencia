# Seguridad y ciclo documental — Doctrina v1.1

## Aplicado a Supabase (2026-10-10)
Migraciones: `create_private_doctrina_ingestion_core`, `doctrina_add_consent_review_and_dependency_controls`.

**12 tablas privadas:** documentos, versiones, trabajos, unidades, afirmaciones, relaciones, publicaciones, publicacion_fuentes, eventos, validaciones, dependencias_conocimiento, autorizaciones_fuente.

**Comprobación SQL:** todas tienen RLS habilitada; los roles `anon` y `authenticated` carecen de privilegio SELECT. El aviso de RLS sin políticas es intencional en esta fase cerrada; NO agregar políticas abiertas para silenciarlo.

## Modelo de autorización
- Acceso a Doctrina solo mediante API de servidor autenticada y autorización Superadmin comprobada en cada solicitud.
- Las credenciales privilegiadas nunca llegan al navegador, al repositorio ni a los logs.
- `documentos.autorizacion_procesamiento_externo` comienza en false; además se requiere una autorización vigente `autorizaciones_fuente.alcance='llm_externo'` y verificación de derechos/condiciones del proveedor.
- Un documento no equivale a una conclusión aprobada. Extracción, destilación, interpretación, validación y publicación son estados separados.
- No se enviará ningún original reservado al LLM sin autorización específica.
- Ningún usuario de Docencia recibe las herramientas, instrucciones o datos del Superadmin.
- No se habilitan rutas de carga ni despliegue a producción hasta completar las pruebas.

## Próximos criterios de aceptación
1. Storage privado configurado mediante API, sin lectura pública.
2. Autenticación del Superadmin ligada a identidad del servidor y prueba negativa de usuario ordinario.
3. Validación MIME real, tamaño, antivirus, SHA-256, idempotencia y limpieza de cargas fallidas.
4. Python con extracción fiel y referencias verificables de página y posición.
5. LLM con esquema de salida restringido, pruebas de inyección de instrucciones y citas comprobables.
6. Aprobación humana antes de publicar derivados.
7. Prueba de restauración y plan de reversión antes de cambios riesgosos.
