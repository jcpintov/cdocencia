# DOCTRINA — Protocolo de recepción documental (borrador operativo)

**Estado:** preparación local implementada; importación a Supabase pendiente de controles de acceso.
**Ámbito:** Doctrina–Docencia, rama `fix/roles-enter-20261012`.
**Objetivo:** recepción ordenada, reproducible y trazable de originales doctrinales, sin publicación accidental.

## 1. Principio de custodia

- Conservar el **original íntegro**; no sustituirlo por OCR ni por fragmentos procesados.
- Calcular SHA-256 del original, registrar nombre, bytes, MIME y versión.
- Nunca guardar contenidos doctrinales en GitHub ni en archivos públicos de Vercel.
- Nunca usar un bucket público para documentos reservados o confidenciales.
- La clasificación de reserva y el estado de aprobación se verifican por documento. El grado se registra únicamente como **contexto temático** de consulta y nunca como autorización de acceso.
- `autorizacion_procesamiento_externo` inicia en **false**. Una marca local no sustituye aprobación documental explícita y auditable.
- **Ningún archivo pasa a estado visible/publicado automáticamente.**

## 2. Contrato compatible con Supabase existente

`doctrina.documentos`: `titulo`, `clase` (`normativa|doctrina|ritual|tradicion|bibliografia|docencia`), `grado_minimo`, `clasificacion_acceso` (`reservado|confidencial|publicable`), `estado` (`borrador|vigente|sustituido|retirado`), `autorizacion_procesamiento_externo`, `autorizacion_referencia`.

`doctrina.versiones`: `documento_id`, `numero`, `sha256`, `objeto_storage`, `mime`, `bytes`, `estado`. Las versiones se enlazan **después de subir el original a almacenamiento seguro**, nunca se inventa `objeto_storage`.

`doctrina.unidades`: texto fiel, orden, páginas, offsets y huellas; extracción posterior, autorizada y auditada, nunca requisito para custodiar el original.

**Todos los usuarios de consulta son Maestros**. Los campos heredados `grado_minimo` y `grado_propuesto` conservarán valor técnico `M` por compatibilidad, sin intervención en políticas de acceso. Las etiquetas `aprendiz`, `companero` y `maestro` sirven para relacionar iniciación, aumento, exaltación y temas afines. Véase `docs/DOCTRINA_POLITICA_MAESTROS_20261012.md`.

## 3. Estados de recepción

1. **Seleccionado localmente**: el archivo sigue solo en el navegador; no existe en Supabase.
2. **Verificado localmente**: formato y tamaño admisibles; SHA-256 calculado; manifiesto JSON exportable, sin contenido.
3. **Pendiente de ingestión**: clasificación y permiso validados por Superadmin; almacenamiento seguro por configurar.
4. **Custodiado**: archivo subido a bucket *privado*, hash contrastado, enlace interno y versión creada.
5. **Revisión doctrinal**: control de fidelidad, clasificación, acceso y eventuales extracciones.
6. **Aprobado/publicable**: requiere acto de aprobación separado; podrá servirlo la interfaz de consulta de **usuarios Maestros**, según publicación y reserva autorizadas. **El análisis normativo-doctrinal del punto 4 es exclusivo de Superadmin**.

Actualmente solo existen los estados locales **1 y 2** en la interfaz de laboratorio. Los demás son objetivos futuros.

## 4. Bloqueos previos a carga reservada

- Implementar y probar identidad confiable del Superadmin; no confiar en `p_admin_id` provisto por JavaScript ni en `sessionStorage`.
- Bucket privado `doctrina-originales-privados` creado; mantiene denegación predeterminada, sin originales transferidos todavía. Antes de habilitar carga/descarga, completar controles y pruebas de identidad autorizada.
- Revisar RLS y permisos de tablas `doctrina`, con autorización `USER` / `SUPERADMIN` y validación por estado de aprobación, sin filtros A/C/M.
- Asegurar que un usuario ordinario no pueda leer metadatos ni originales en cuarentena o no publicados ni acceder al análisis administrativo «Doctrina y Reglamentos».
- Confirmar auditoría de carga, descarga, autorización, rechazo y versión.
- Pruebas negativas: anónimo, USER frente a contenido no publicado y herramientas Superadmin, sesión caducada, URL conocida, cambio de metadatos del cliente, descarga directa.
- Probar restauración y recuperación de originales.

## 5. Criterios de aceptación de la etapa actual

- [x] Formulario con clasificación, clase, **contexto temático no restrictivo**, referencia y casilla de autorización desmarcada.
- [x] SHA-256 calculado localmente para originales admitidos.
- [x] Exclusión local de formato o tamaño incompatible.
- [x] Exportación JSON de metadatos sin contenido ni transferencia.
- [x] Limpieza de selección y estado del lote.
- [x] Bucket privado creado en Supabase (sin objetos).\n- [ ] Autorización robusta, pruebas de RLS e incorporación física de originales.
- [ ] Carga física a Supabase y verificación hash del objeto almacenado.
- [ ] RLS, autorización cruzada, auditoría e integración con el catálogo.
- [ ] Tests de integración en navegador con sesiones reales.

## 6. Recepción de documentos aportados en ChatGPT

Los archivos aportados por el titular pueden revisarse individualmente en la conversación antes de enviarlos al sistema. Los documentos con distintos **contextos temáticos** pueden separarse por lotes para facilitar su catalogación, pero **no existen grupos de usuarios por grado**. No inferir que una obra es pública por su título, antigüedad o procedencia. Revisar duplicados por SHA-256 antes de cargar cualquier versión.

**No importar originales reservados hasta que el circuito de seguridad esté validado.** El botón «Doctrina y Reglamentos» es exclusivo del Superadmin. No confundir grado temático con autorización de acceso.
