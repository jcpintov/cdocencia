# Trabajos nuevos y cuestionarios — preparado, SIN PUBLICAR

Ubicación: botón «Subir trabajo nuevo» en Trabajos y Cuestionarios. Archivos originales conserva la asociación y descarga del original de los trabajos publicados.

## Flujo

1. PDF con texto o Word DOCX de hasta 2 MB. Extracción limitada a 60.000 caracteres; PDF hasta 80 páginas. Los escaneos requieren OCR previo. Se conserva el original íntegro con su hash, nombre y tamaño.
2. Limpieza determinista, sin reescribir las ideas: espacios/saltos, números marginales, encabezados/pies repetidos, bibliografía final y notas identificables. Todo fragmento separado queda a la vista. Citas dentro del argumento se conservan; las notas PDF dudosas requieren revisión humana.
3. Ficha y texto editables. Borrador privado por administrador, recuperable desde la misma sección, sin insertarlo aún en el catálogo público del grupo.
4. Autorización explícita de envío del texto revisado a Groq. Mismo modelo de la integración vigente: openai/gpt-oss-120b. Siete preguntas de comprensión/aplicación y una octava de dilema ético. Cuatro alternativas, una respuesta, retroalimentación y sustento literal verificable por pregunta. Rechazo de respuestas incompletas, repetidas, sin sustento o con etiquetas HTML.
5. Guardar conserva el borrador. Cambiar el texto invalida las preguntas. La publicación requiere revisión y confirmación expresas; agrega módulo, original y vínculo temático en una transacción, con control de orden e idempotencia. Reutiliza las reglas de entrega por publicación y el aviso al autor ya establecido.

## Protección y alcance

- Auth y perfil administrativo verificados antes de llamar al nuevo procesador. Actor fijado en servidor, borradores ajenos rechazados en la RPC.
- Nuevas tablas con RLS forzada, sin permisos para anon/authenticated; RPC solo service_role. Se habilita para service_role únicamente el uso del esquema doctrina y la ejecución de rol_verificado necesarios para SECURITY INVOKER. Verificados los permisos reales de INSERT en modulos/modulos_temas mediante lectura de catálogo, sin cambios productivos.
- Original inmutable por las acciones del flujo. Protección ante DOCX expansivo; extracción PDF sin evaluación de código. Texto y cuestionarios se renderizan de forma segura.
- Revisión concurrente por número de versión; límite de 100 borradores, diez intentos IA por hora y treinta diarios por administrador. Reserva por generación, sin reintentos de publicación automáticos. Fallos/429/JSON inválido conservan el borrador.
- Sin nueva función Vercel: se amplía api/admin-trabajos.js. Se configura duración y empaquetado de unpdf para la futura publicación.
- Migración 20261023210254 creada con CLI, probada únicamente en PostgreSQL local. No aplicada a producción. Tampoco se aplicó la migración de entregas manuales. Sin push, fusión ni despliegue.

## Validación

- 346 pruebas Node aprobadas; sintaxis JS y git diff --check correctos.
- DOCX real con notas, encabezado/pie y bibliografía; PDF real de dos páginas. Preservación del original byte a byte.
- Chromium: carga, extracción, borrador, recuperación, descarga original, consentimiento, ocho preguntas editables, pregunta ética, cambio de texto, fallos IA/500/JSON inválido, móvil, publicación explícita de fixture, asociación original y limpieza de sesión.
- PostgreSQL/PGlite ejecutando las dos nuevas migraciones: privilegios, propietario, versiones, invalidación, cuota, publicación atómica/idempotente, observaciones y entrega/reapertura sin duplicar recordatorios.
- Regresión de Asignaciones e informes (tres PDF y modales), Doctrina/perfil, plataforma y memoria DOM aprobada. Vista móvil inspeccionada y corregida sin desbordes.
- Respuestas IA simuladas. No se enviaron originales reales a Groq. La calidad semántica de las preguntas sigue sujeta a revisión editorial y la primera prueba real tras la futura aplicación de la migración.
