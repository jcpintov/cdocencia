# Revisión final de Docencia — 21 de octubre de 2026

## Correcciones para publicación

- Catálogo: estado de carga visible, error recuperable y botón Reintentar. Una respuesta tardía no devuelve al usuario a una pantalla abandonada ni reabre contenido después de cerrar sesión.
- Ingreso: bloqueo de solicitudes simultáneas, limpieza del campo de contraseña después del acceso y protección frente a restauraciones tardías. Un rechazo de red al restaurar la sesión mantiene el ingreso disponible.
- Recuperación: errores controlados al comprobar el enlace y actualizar la contraseña; el botón vuelve a estar disponible y los datos se conservan si no se pudo confirmar el cambio. Enlace visible de regreso al ingreso y requisitos congruentes con primer acceso.
- Estudio: el muro del trabajo se muestra al completar la reflexión y se oculta al abrir un trabajo pendiente. Una escritura terminada en una sesión o trabajo anterior no contamina la caché actual.
- Navegación: Este Espacio abre directamente. Los accesos diferidos desde Inicio y al Muro Docente respetan el resultado de la carga y la pantalla elegida.

## Evidencia de integridad en producción

Consultas de solo lectura y comprobación de permisos en transacción con rollback, sin cambiar cuentas ni avances:

- 8 trabajos activos con título, texto y batería de 8 preguntas cada uno.
- 0 preguntas con alternativas incompletas o respuesta correcta inválida.
- Programa actual: 4 áreas, 8 unidades, 24 subunidades y 140 temas (176 códigos). El programa es dinámico; no se limita a los 139 temas de la muestra histórica de pruebas.
- 0 avances duplicados, avances huérfanos, vínculos huérfanos, temas sin subunidad y subunidades sin unidad.
- Todos los perfiles vinculados a Auth tienen una cuenta existente. Los perfiles aún sin vínculo corresponden al flujo de primer acceso; la cifra por sí sola no acredita activación ni entrega de correo.
- Bajo rol de participante autenticado: 8 trabajos visibles, programa completo, solamente el perfil propio y 0 avances ajenos visibles.
- RLS habilitada en todas las tablas públicas. Los avisos de funciones SECURITY DEFINER y tablas sin políticas corresponden a rutas privilegiadas que requieren control específico, no acreditan acceso público por sí solos. Sigue deshabilitada la protección adicional de contraseñas filtradas en Auth.

## Verificación

- 140 pruebas Node de lógica, permisos, correos y regresión.
- Pruebas de navegador aisladas de asignaciones, contraste 4,5:1, programa completo y móvil.
- Nuevo recorrido de participante: ingreso, sigilo, Inicio, Este Espacio, Contenido Docente, trabajo, lectura, ocho preguntas, reflexión, muro, pérdida de conexión, reintento, navegación concurrente, cierre de sesión y recuperación.
- Formularios públicos revisados en navegador real de producción, sin enviar códigos ni correos. La única entrada de consola observada en esa revisión provenía de una extensión del navegador, no de la aplicación.

## Límite de aceptación antes de convocar a todos los usuarios

Las pruebas aisladas usan un servicio de datos simulado. La comprobación SQL verifica datos y políticas reales, pero no sustituye una sesión real completa desde el navegador. Falta comprobar con una cuenta de prueba el primer acceso por correo, el ingreso, la recuperación y la llegada del mensaje a una bandeja real. No se enviaron correos ni se modificaron contraseñas reales durante esta revisión. Los PDF exportados y los adjuntos privados requieren una comprobación visual con sesión iniciada; no se acredita su generación real mediante las pruebas aisladas.

La publicación técnica debe comprobarse como READY y servida desde el dominio, después de aprobar CI. No se debe interpretar READY como garantía absoluta de ausencia de fallos.
