# DOCTRINA — Política funcional para Cámara de Maestros

**Decisión vigente:** 2026-10-12. **Ámbito:** Doctrina–Docencia, RL OFL Nº146. **Estado:** normativa de diseño; controles técnicos en desarrollo.

## Objetivos, destinatarios y alcance

| Nº | Objetivo | Destinatarios | Uso |
|---|---|---|---|
| 1 | Preservación del patrimonio documental | Usuarios Maestros y Superadmin | Consulta del corpus aprobado; custodia, sustitución y auditoría exclusivas de Superadmin |
| 2 | Organización del conocimiento | Usuarios Maestros y Superadmin | Navegación temática, fuentes, relaciones y referencias |
| 3 | Investigación y búsqueda inteligente | Usuarios Maestros y Superadmin | Recuperación de documentos aprobados con citas verificables; sin facultad de publicar |
| **4** | **Análisis normativo y doctrinal** | **Solo Superadmin** | **Botón «Doctrina y Reglamentos»**; contraste normativo, estudio de casos e interpretaciones sin carácter vinculante |
| 5 | Apoyo a la docencia | Usuarios Maestros y Superadmin | Estudio, reflexión, preparación de trabajos y formación de la Cámara |
| 6 | Seguridad y gobierno documental | Solo Superadmin administra | Autenticación, revisión, aprobación, reserva, registros y control de publicación |

## Regla de usuarios

- Existen **dos roles funcionales:** `SUPERADMIN` (único titular actual) y `USER`.
- **Todos los `USER` son Maestros.** No se solicitan ni verifican grados inferiores al ingresar.
- **No hay partición A/C/M del catálogo** para establecer permisos o visibilidad.
- Los contenidos **reservados, no aprobados, confidenciales o sujetos a restricciones documentales** permanecen fuera de la consulta ordinaria por su estado y autorización, **no por grado**.
- El usuario común consulta fuentes ya aprobadas, sin modificaciones, publicación, autorización externa ni análisis reservado del punto 4.
- La interfaz «Doctrina y Reglamentos» se monta únicamente en la consola Superadmin. La ocultación por JavaScript es provisional; la futura API de búsqueda debe validar la identidad Superadmin **en el servidor**, no confiar en `usuarioActual.es_admin` de `sessionStorage` ni `p_admin_id` del navegador.

## Grados como contexto semántico, nunca permiso

Identificar el grado relacionado **solo cuando sea pertinente a la consulta**, sin afectar el conjunto de documentos autorizados:

- **Iniciación, Aprendiz, primer grado, piedra bruta** → contexto Primer grado / Aprendiz.
- **Aumento, Compañero, segundo grado** → contexto Segundo grado / Compañero.
- **Exaltación, Maestro, tercer grado, Cámara del Medio** → contexto Tercer grado / Maestro.
- Consultas mixtas → mencionar todos los contextos relevantes, **sin filtrado automático por grado**.
- Temas generales de ética, filosofía o normativa → no asignar grado forzadamente.
- Las etiquetas son **orientativas**, deben poder ser corregidas en revisión; palabras aisladas no autorizan ni prohíben ningún documento.

## Compatibilidad con tablas existentes

Los campos heredados `doctrina.documentos.grado_minimo` y `doctrina.ingesta_documental.grado_propuesto` **no son criterios de control de acceso**. Para mantener el contrato legado sin inducir filtros no deseados, su valor futuro será `M` (audiencia institucional completa). Las referencias de grado temático se almacenan separadamente como `contexto_grado` cuando la estructura lo admita. Las etiquetas previas se conservan para auditoría.

**No crear políticas RLS, filtros REST ni condicionantes de búsqueda según A/C/M.** La política deberá distinguir `USER` / `SUPERADMIN`, estado aprobado o pendiente y reserva, validando la identidad confiable en servidor.

## Estado y límites actuales

- Existe una consola Superadmin en rama de desarrollo con botón «Doctrina y Reglamentos», búsqueda local de términos en PDF y referencias a la página; la herramienta no interpreta ni analiza mediante IA.
- La búsqueda local usa PDFs escogidos por el operador; no accede a `doctrina.ingesta_documental` desde el navegador.
- Los originales del primer lote siguen pendientes de carga física a Supabase Storage privado; únicamente los metadatos están en cuarentena.
- Antes de publicar el corpus: autorización fiable, RLS, auditoría, pruebas negativas de `USER`, no autenticado y una sesión manipulada, y verificación de huellas.

**Principio:** el grado explica la materia estudiada; el rol determina la facultad; la aprobación y clasificación regulan la disponibilidad del documento.
