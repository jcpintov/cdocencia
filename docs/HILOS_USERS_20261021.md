# Comentarios con hilos — USERS, 21 de octubre de 2026

Último punto funcional acordado para el cierre de DOCENCIA de participantes. La aceptación con Dummy del recorrido anterior permanece aprobada por Julio César. DOCTRINA y las herramientas exclusivas de SUPERADMIN quedan fuera de este alcance.

## Comportamiento

- Cada comentario admite Responder; cada respuesta admite nuevas respuestas. Se identifica a quién se responde y se conserva el orden de la conversación.
- Misma experiencia en el muro del trabajo y el Muro Docente general. Formularios con identificadores independientes para evitar cruces entre las dos vistas.
- Edición propia mediante RPC con confirmación. Se incorpora el diálogo de edición que faltaba en el HTML anterior.
- Publicación con botón bloqueado durante el envío, mensaje accesible y plazo de confirmación de 20 segundos. El texto y la solicitud se conservan en un resultado incierto; repetir esa solicitud no crea otra respuesta.
- Borradores conservados al cancelar y reabrir, editar otro comentario o actualizar el muro. Las consultas fallidas no destruyen el contenido ya visible.
- Sangría visual acotada en escritorio y móvil. No hay límite artificial de respuestas a respuestas; el recorrido iterativo tolera conversaciones extensas y datos inconsistentes sin ciclos infinitos.
- Si un comentario anterior fue retirado, sus respuestas disponibles se conservan con aviso, sin revelar el texto retirado.
- Cada respuesta publicada es un registro de comentario y aporta una unidad al KPI existente, igual que cada comentario raíz y cada reflexión visible.

## Datos y permisos

Ampliación aditiva de comentarios_muro con comentario_padre_id y solicitud_id. Los comentarios previos conservan padre nulo. Clave foránea compuesta garantiza mismo trabajo y reflexión. Trigger impide trasladar comentarios, cambiar autor, formar ciclos o insertar respuestas sin completar el trabajo.

maestro_responder_comentario valida la identidad institucional USER, la disponibilidad del comentario, el trabajo activo y el progreso completado del actor. Mantiene límite temporal de cinco publicaciones por minuto e idempotencia por usuario/solicitud. La RPC no es ejecutable por anon ni por PUBLIC; Superadmin es rechazado como participante. La función SECURITY DEFINER es intencional para verificar la reflexión ajena sin exponer avances privados; mantiene search_path vacío y comprobaciones explícitas del actor.

muro_docente_autorizado incorpora solamente el identificador del padre a su proyección existente, sin correos, respuestas de evaluación ni solicitudes privadas. No se envían notificaciones por correo.

## Verificación

- Suite Node ampliada: jerarquía, compatibilidad con raíces, escape de contenido y atributos, edición propia, controles USER, padres retirados, duplicados, ciclos, 1800 comentarios, KPI y tiempo máximo de confirmación.
- SQL real transaccional aprobado con rollback: respuesta, respuesta a respuesta, idempotencia, edición propia, rechazo de edición ajena, cruces, cambios de parentesco, origen inactivo, progreso incompleto, inserción directa y Superadmin. Cero datos sintéticos persistentes.
- Chromium: recorrido completo del participante ampliado con ambas vistas, fallo antes de guardar, confirmación interrumpida después de guardar, reintento sin duplicado, edición, preservación de otro borrador e integridad móvil.

La prueba de navegador usa datos aislados; la prueba SQL verifica las funciones reales y permisos del servidor. No se han enviado comentarios de prueba permanentes con la cuenta Dummy.
