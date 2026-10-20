# Asignaciones: modal, recordatorio y cronograma

- Cada asignación abre su modal de opciones desde Asignación de trabajos o el cronograma de KPIs (Resumen ejecutivo).
- Ambas fechas son editables. Cambiar la fecha comprometida recalcula el umbral del recordatorio: vencimiento + 7 días, a las 23:30, America/Santiago. No dispara correo al guardar.
- Solicitud inicial manual con vista previa. Recordatorio automático único mediante Vercel Cron diario a las 16:00 UTC (12:00/13:00 local según horario de verano). Se envía en la primera revisión posterior al umbral; no promete ejecución a las 23:30 exactas.
- El tema se considera publicado cuando su código coincide con unidad_codigo o modulos_temas de un módulo activo. La vinculación temática es necesaria al publicar. Un trabajo activo ya asociado al mismo tema también evita el recordatorio.
- Sin solicitud original confirmada al mismo integrante/tema/correo actual no hay recordatorio. La fecha citada es el primer envío confirmado para esa identidad; editar fechas no la altera.
- Plantillas sin «Chile» en el plazo. Recordatorio incluye la frase aprobada «Si ya envió su trabajo, agradeceré hacer caso omiso de esta comunicación.» inmediatamente después del agradecimiento.
- Todas las solicitudes y recordatorios llevan BCC fijo a jpintov@gmail.com. La aceptación SMTP de la copia se registra separada de la del destinatario; recibir una copia no prueba la entrega en el buzón del destinatario.
- Reserva única en PostgreSQL, bloqueo de asignación durante el envío, revisión de condiciones inmediatamente antes de SMTP y sin reintentos de resultados inciertos. No hay garantía de entrega ni de SMTP exactamente una vez ante interrupciones; se evita reenviar ciegamente.
- Servicio exclusivo de service_role, RLS forzada sin acceso cliente. Cron autenticado por CRON_SECRET exclusivo de producción. Previews no ejecutan envíos.
- Cronograma: asignados, pendientes (incluye vencidos), vencidos, publicados; orden por compromiso; filtros de próximas entregas, atrasados y publicados. Barras representan plazo transcurrido, no avance del contenido.

## Verificación

- tests/recordatorios-db.sql: pruebas bajo service_role, revertidas al terminar. Sin envío real; editar fecha, preservar solicitud, impedir anticipación y duplicados, bloqueo de modificación en curso y publicación entre reserva y SMTP.
- tests/asignaciones.test.mjs y tests/recordatorios.test.mjs: plantillas, BCC, autorización, idempotencia, fallos de SMTP y de persistencia.
- tests/browser/asignaciones-smoke.mjs: formularios reales con API sintética, modales en escritorio y móvil, fecha comprometida editable, vista previa sin envío, cronograma y 139 temas accesibles.

## Aviso al autor al publicar

Tercer correo breve con el texto aprobado y BCC a jpintov@gmail.com. Se registra al activar un módulo o vincular su tema a una asignación vigente cuyo responsable coincide inequívocamente con el autor del trabajo. El nombre se compara sin tratamiento, diferencias de mayúsculas, acentos ni espacios repetidos; si hay ambigüedad no se encola a otro usuario. Un aviso por módulo y autor, sin avisos retroactivos sobre los ocho trabajos existentes.

Al guardar desde Superadmin se procesa la cola; la revisión diaria actúa como respaldo. Publicación retirada, destinatario cambiado o autor que ya no corresponde cancelan el envío pendiente. Un resultado incierto no se reenvía. El modal y el cronograma muestran el resultado. El esquema privado contiene solamente el trigger que registra la cola; SMTP continúa exclusivamente en el servidor.
