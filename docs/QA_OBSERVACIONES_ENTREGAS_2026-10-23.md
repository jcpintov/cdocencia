# Observaciones y entregas manuales — SIN PUBLICAR

- Observación privada de 500 caracteres por usuario, con versión y auditoría; editar y borrar desde el padrón de Asignación de trabajos. No modifica disponibilidad ni KPI ni correos.
- Entrega recibida por asignación: fecha efectiva, nota, actor y registro temporal; reapertura explícita conservando vencimiento. Publicado sigue contando como entregado y no se puede reabrir desde esta opción.
- KPI, filtros, color y orden consideran entrega manual o publicación; Publicados conserva su significado específico.
- Informe de asignaciones agrega estado y recepción; comentario bajo el nombre. Progreso de lectura conserva su significado.
- Recordatorio reservado se cancela bajo bloqueo de la asignación; un envío ya autorizado requiere revisión antes de registrar recepción. Reabrir puede recuperar un aviso cancelado antes de SMTP y no repite avisos enviados/inciertos.
- Migración local 20261023205630, pendiente de aplicación. No hubo modificaciones a la base real, envío de correos, push, fusión ni despliegue.

Validación: 337 pruebas Node aprobadas; Chromium para observación, entrega, reapertura, KPI, filtros, modales y tres PDF; PostgreSQL/PGlite con roles service_role/anon/authenticated, concurrencia de versiones, historial, suspensión antes de SMTP, reapertura sin duplicación y publicación con aviso. PDF de 1/2/2 páginas revisados, sin recortes; sintaxis y diff correctos.
