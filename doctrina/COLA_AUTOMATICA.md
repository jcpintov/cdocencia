# Cola automática de ingesta — 2026-10-10

Migración aplicada: `doctrina_enqueue_on_new_version`.

Al insertar una fila en `doctrina.versiones`, el trigger `trg_encolar_version_nueva` invoca `doctrina.encolar_version_nueva()` y crea un registro pendiente en `doctrina.trabajos`. El índice único `trabajos_ingesta_unica` impide duplicar la misma tarea de ingesta para una versión.

Verificación: `information_schema.triggers` confirmó trigger `AFTER INSERT` sobre `doctrina.versiones`.

Este mecanismo **solo encola**; no procesa documentos ni envía contenido a modelos externos. Requiere worker de servidor autenticado, autorización específica para tratamiento externo y validación humana para publicar derivados.

Regla de despliegue: no fusionar a main ni desplegar a producción sin aprobación final del titular. No subir documentos reservados al repositorio.
