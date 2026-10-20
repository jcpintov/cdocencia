# Asignación de trabajos — Superadmin

Solicitud aprobada: selector de integrantes del padrón, selector de temas, Asignar, Modificar, Eliminar y Correo. Fecha de asignación editable. Plazo inicial: 21 días calendario, entrega a las 23:30 de Chile. Al modificar, se conserva el plazo salvo edición explícita o Recalcular 21 días.

## Datos y seguridad

Migración `docencia_asignaciones_superadmin_20261020` aplicada. Tabla principal `public.docencia_asignaciones`, historial y registro de intentos de correo separados. Tema único entre asignaciones vigentes; anulación lógica libera el tema. Control optimista de versión evita sobrescribir cambios de otra pestaña. Historial conserva fechas anteriores y posteriores. RLS forzada, sin permisos de cliente; API verifica Auth y perfil de la cuenta Superadmin, y la RPC vuelve a verificar el actor. Ninguna cuenta fue modificada.

## Correo manual

Crear, modificar, anular y abrir vista previa no envían correos. Enviar exige acción explícita desde el diálogo, con versión vigente e identificador de intento. El destinatario sale del padrón, no del cuerpo de la solicitud. Reserva atómica e idempotencia impiden reintentos automáticos y duplicados del mismo intento. Modificaciones bloqueadas durante envío. Reenvío exige confirmación explícita. Un intento sin confirmar puede cerrarse manualmente pasados dos minutos, sin enviar otro mensaje. Aceptación SMTP no equivale a lectura ni entrega definitiva.

Plantilla aprobada: V.·.M.·., nombre en mayúsculas, tema en mayúsculas y negrita, espacios entre bloques, lineamientos íntegros y firma «Julio César Pinto,» / «ORADOR - RL OFL 146». Versión texto y HTML conservadas por intento.

## Contenido Docente

175 entradas activas: cuatro áreas, ocho unidades, 24 subunidades y 139 temas. Se retiran las restricciones de altura de la vista y el desplazamiento anidado. El programa usa desplazamiento vertical del documento y ofrece Mostrar todos los temas / Contraer programa. Los datos del catálogo y sus códigos no se modifican.

## Verificación

Pruebas SQL bajo `service_role` y rollback: actor, fechas editables, plazo, unicidad, versiones, anulación, historial y ausencia de correo automático PASS. Segunda prueba: reserva de correo, idempotencia, bloqueo de cambios y reenvío explícito PASS. Cero asignaciones y correos de prueba conservados. Diez pruebas Node de plantilla y API PASS localmente. Pruebas de navegador aisladas en CI con 139 temas; sin identidades ni SMTP reales. Consultar CI del commit final para resultado completo. No se ejecuta envío real durante esta implementación.
