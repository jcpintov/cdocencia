# Coordinador privado de ingesta: contrato de ejecución

Estado: prototipo en rama feature. **No desplegar ni activar** sin autorización.

`runner.run_once(connection_factory, fetch_private_object, worker_id, authorize_local_analysis)` ejecuta a lo sumo un trabajo.

## Integraciones obligatorias

- `connection_factory` debe devolver un contexto transaccional real. Su salida confirma al terminar correctamente y revierte ante excepciones. No usar autocommit para las transiciones.
- `fetch_private_object` debe leer bytes únicamente del bucket privado autorizado y nunca aceptar URLs arbitrarias o redirecciones externas. El backend debe comprobar el ámbito de Storage del documento y la versión.
- El backend debe aplicar permisos de servicio mínimos, sin credenciales en frontend y sin privilegios de Superadmin.
- Verificar SHA-256, tamaño y MIME mediante `integrity.verify_and_extract` antes de escribir unidades.
- Los fallos se registran con textos constantes y no contienen material de fuentes ni mensajes crudos.
- Una extracción correcta termina en `revision`, no en `listo` ni `publicado`.

## Limitaciones y riesgos pendientes

1. Las pruebas del runner usan mocks: falta validación real de commit/rollback, `SKIP LOCKED`, aislamiento y reservas vencidas en PostgreSQL.
2. El proceso actual es síncrono. Si la descarga o extracción excede diez minutos, la reserva vence; debe existir renovación periódica supervisada o cuarentena segura.
3. La captura genérica de excepciones clasifica errores no previstos como fallos controlados. Si el guardado de un error falla, el supervisor recibe una excepción; no reintentar sin inspección.
4. Los bytes de Storage no deben guardarse en logs, respuestas API ni servicios externos.
5. No existe todavía conexión desplegada a Storage ni programador autorizado.
6. La validación de autorización por fuente para análisis local debe resolverse antes de habilitar el procesamiento, además de la autorización separada para LLM externo.

## Criterio de aceptación

Pruebas unitarias, integración transaccional con PostgreSQL aislado, almacenamiento privado de prueba, auditoría de privilegios, verificación de consentimiento y revisión humana documentada.

## Autorización de análisis local (obligatoria)

- `authorize_local_analysis(job)` debe consultar la fuente de verdad privada, vinculando `job.version_id` al documento y comprobando autorización activa `analisis_local`. Nunca inferir permiso de una bandera de procesamiento externo.
- Solo el valor booleano exacto `True` autoriza. `False`, `None` y respuestas indeterminadas deniegan. Las excepciones de la comprobación se propagan y deben ser atendidas por el supervisor; nunca se permite la lectura.
- Se comprueba antes de Storage y antes de persistir unidades. La denegación intenta cerrar la reserva inmediatamente como error sujeto a revisión; si perdió la reserva, se propaga el fallo y no se fuerza ninguna transición.
- **Control implementado, pendiente de prueba real:** `finish_extraction` comprueba `analisis_local` y bloquea con `FOR SHARE` la autorización activa dentro de la misma transacción de inserción. Es obligatorio que la revocación actualice la misma fila y que las conexiones usen commit/rollback reales. Faltan pruebas PostgreSQL concurrentes, auditoría de permisos y tratamiento de cambios de clasificación documental.
- **No es un servicio operativo:** falta adaptador autenticado y pruebas de revocación concurrente reales.
