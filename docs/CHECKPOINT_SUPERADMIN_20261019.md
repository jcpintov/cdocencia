# Superadmin — 2026-10-19

PR #32, sin fusionar ni publicar producción. Menú agrupado en Vista general / Gestión docente / Participación y seguimiento. Herramientas GitHub y Supabase al final. Menú móvil plegable, foco y aria-current, encabezado de sección.

Segunda iteración: búsqueda de trabajos por número, título, autor o código, tolerante a tildes/mayúsculas. Contador y estado vacío diferenciados de error. Consultas fallidas conservan lista previa; respuestas antiguas no sobrescriben consultas nuevas; botón de actualización bloqueado durante carga. Títulos y autores mediante textContent, acciones mediante eventos DOM, sin interpolación HTML.

Verificación local: 70/70 pruebas Node, sintaxis JS y diff correctos. CI primera iteración SUCCESS (run 39261189956). QA visual autenticada pendiente; Chromium local no disponible y descarga fallida. Las pruebas funcionales de navegación/consulta usan DOM y servicios simulados; no equivalen a revisión visual.

No se modificó base de datos, contenido docente ni cuentas en esta iteración. Funciones de eliminar/renumerar y adjuntar originales conservan backend existente y requieren auditoría posterior: no afirmar que sus escrituras estén validadas. No se ejecutaron eliminaciones. Doctrina conserva estado pendiente de comprobación final. Producción continúa sin esta versión hasta ciclo de publicación autorizado.
