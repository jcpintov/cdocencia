# Administración y DOCTRINA · avance preparado el 21 de octubre de 2026

Estado: implementado y probado sin desplegar ni aplicar migraciones productivas. Base de producción: e20ebfc8ea76e87b2e861a664b6094e70f82d35a.

## Cambios

- Calendario: horario editable, 20:00 por defecto para nuevos y existentes; orden y agenda incluyen la hora. Aviso privado a jpintov@gmail.com cinco días antes del evento, programado a las 08:00 de Santiago. Ventanas diarias UTC independientes para verano e invierno, con verificación de hora local y reserva durable anterior a SMTP. Un envío incierto no se repite automáticamente.
- Alta de usuarios: nombre y correo inicialmente vacíos; campos diferenciados del ingreso y exclusión de autocompletado por gestores conocidos.
- Perfil Superadmin: nombre/correo modificables tras código al correo anterior; código almacenado mediante HMAC, 10 minutos, cinco intentos y límite de solicitudes. Propuesta inmutable durante la validación. Identidad Auth y permisos se conservan por UUID y marcador protegido en app_metadata; nunca por user_metadata. Las operaciones parcialmente confirmadas se recuperan de forma idempotente, sin revertir Auth ante una respuesta SQL incierta.
- Dummy: edición del nombre y eliminación exclusiva de Superadmin. El correo de prueba se conserva mientras exista la cuenta. La eliminación revoca Auth y desvincula/archiva el perfil conservando historial; el primer acceso queda bloqueado para el perfil archivado. La cuenta real no se ha modificado.
- DOCTRINA: extracción local por página, texto original separado de correcciones y trazabilidad de revisiones. Cada página exige revisión; las páginas vacías deben contrastarse y marcarse explícitamente. Aprobar el original y aprobar su extracción son procesos distintos. Búsqueda en español únicamente sobre extracciones aprobadas de documentos vigentes y su última versión, con página PDF, versión, huella y acceso al original. No se realizan llamadas a servicios externos de IA ni OCR automático.

## Validación

- 198 pruebas automatizadas aprobadas, incluido motor PDF real sobre un documento sintético.
- Pruebas de navegador en escritorio/móvil de asignaciones, USERS, calendario, visor, extracción por página, revisión, contraste con PDF, búsqueda citada, perfil y alta vacía.
- Pruebas DOM de datos conservados, bloqueo de página incorrecta, resultados seguros y limpieza de sesión.
- Migraciones ejecutadas en PostgreSQL aislado mediante PGlite: OTP/código erróneo/caducidad/cinco intentos, recuperación, identidad estable, revisión obligatoria, auditoría, búsquedas con referencias, retiro, reserva sin duplicación, bloqueo de reactivación de Dummy y permisos de ejecución.
- Extracción local comprobada sobre dos originales. Las páginas con poco texto quedan pendientes de contraste; no se confunden con una extracción completa ni se aprueban automáticamente.

Las pruebas de correo, interfaz y base aislada usan cuentas, eventos y datos sintéticos. La extracción local también se comprobó sobre originales protegidos, sin enviarlos a servicios externos. No se enviaron correos reales ni se cambiaron usuarios productivos. No se incorporan originales privados al repositorio.

## Activación futura

1. Verificar que el próximo despliegue incluya el conjunto acordado y que su activación esté autorizada.
2. Aplicar, en este orden, las migraciones nuevas: calendario_horarios_recordatorios.sql; dummy_archivo_cuenta.sql; superadmin_identidad_estable.sql; superadmin_perfil_codigo.sql; doctrina_extraccion_paginas.sql.
3. Ejecutar CI y comprobaciones de navegador sobre el commit exacto, y revisar dependencias fijadas.
4. Verificar la precisión del programador del plan antes de comprometer las 08:00 al minuto: Vercel Hobby admite ejecución dentro de la hora; Pro ofrece precisión por minuto. No se ha cambiado el plan ni contratado servicios. Referencia: https://vercel.com/docs/cron-jobs/usage-and-pricing
5. Publicar el commit probado y comprobar API/cron, correo institucional e identidad sin modificar la cuenta principal como prueba automática.

Se conserva el cron docente existente. Las nuevas migraciones agregan estructura y no aprueban textos, eliminan Dummy ni cambian el perfil por sí solas. La activación queda pendiente por instrucción del usuario.

## Reanudación: cobertura de búsquedas

La búsqueda informa cuántos originales vigentes tienen texto aprobado y cuántos siguen pendientes. Una extracción con huella distinta queda excluida y contabilizada como pendiente. Los documentos retirados quedan fuera de ambos recuentos. La ausencia de coincidencias no se presenta como ausencia del tema en originales todavía no revisados. Verificado en PostgreSQL aislado y DOM; las 198 pruebas automatizadas siguen aprobadas. Sin despliegue ni cambios productivos.

## Agente de consultas: circuito documental local

Se incorpora `agente_consultar`, formulario privado, informe estructurado y referencias contrastables. Ver `docs/AGENTE_CONSULTAS_DOCTRINA.md`. 203 pruebas aprobadas, PostgreSQL aislado, DOM y navegador escritorio/móvil. El motor generativo no está conectado: requiere identificar proveedor/modelo y autorizaciones por documento y servicio. No confundir este informe local con un agente de interpretación mediante LLM. Sin despliegue ni migraciones productivas.
