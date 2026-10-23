# Cambios preparados — sin publicar

Mandato: no publicar hasta nuevos avances significativos.

- Retiradas las leyendas sobre exclusión de administradores/cuentas eliminadas y formato de fechas/hora de entrega, en vista previa y PDF. El filtrado de datos y las reglas de entrega permanecen vigentes.
- Columnas de nombres ampliadas en vista previa y PDF; salto entre palabras en pantalla y desplazamiento de tabla independiente en móvil.
- Botón «Eliminar registro» con confirmación irreversible. DELETE en servidor limitado por id y actor de la sesión verificada; rechaza registros ajenos/inexistentes (404), solicitudes sin permisos y confirmación inválida. Refresca listado y memoria local tras borrar. No modifica la biblioteca documental.
- Sin migraciones ni cambios en datos reales. Sin push, fusión o despliegue.

Validación: 334 pruebas Node; DOM de aprobación/retiro/eliminación, cancelación, fallo y sesión vencida; Chromium con tres PDF reales, móviles, 4xx/5xx, JSON inválido, respuestas incompletas y flujos de asignaciones/roles. PDF de 1/2/2 páginas revisados visualmente; nombre largo completo en informe de avances, sin desbordes. Sintaxis JS y git diff --check correctos.

Tiempos de fixture local: vistas 87/19/16 ms; PDF 419/329/301 ms. No equivalen a latencia de producción.
