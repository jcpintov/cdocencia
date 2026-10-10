# Control de seguridad antes de integrar a producción

**Estado:** propuesta en rama feature. No ejecutar migraciones ni desplegar servicios sin aprobación final.

## Invariantes
1. Original en Storage privado; Docencia nunca recibe URL ni contenido.
2. Reserva de cola transaccional mediante FOR UPDATE SKIP LOCKED.
3. Extracción termina en revisión, no publicación.
4. Reserva vencida pasa a cuarentena; no reintento automático.
5. Publicación exige superadministrador activo, unidades validadas, afirmaciones aprobadas y versiones listas.
6. SQL de control de publicación guardado como propuesta, sin aplicar.

## Pendientes críticos
- Probar concurrencia con dos conexiones PostgreSQL en entorno aislado.
- Implementar worker de Storage y credenciales privadas.
- Añadir heartbeat y comprobar vigencia del arrendamiento antes de confirmar unidades.
- Probar PDF/DOCX adversariales y bombas ZIP; OCR supervisado.
- Invalidar derivados publicados ante revocación de fuentes.
- Verificar consentimiento LLM externo en cada invocación.
- Revisar separación de funciones entre autor y aprobador.
- Auditar control de publicación frente a revocaciones y cambios concurrentes.

## Criterio de salida
CI aprobado, concurrencia real, Storage privado, permisos mínimos, prueba de no filtración a Docencia y aprobación final de producción.