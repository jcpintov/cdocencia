# CONTRATO OPERATIVO — SUPERADMIN v1.0

**Proyecto:** Doctrina–Docencia, Cámara de Maestros OFL Nº146.  
**Estado:** especificación vinculante para desarrollo; no equivale a habilitación de seguridad.  
**Titulares:** exactamente un operador SUPERADMIN actualmente. Ninguna cuenta USER puede autoconcederse esta condición.

## 1. Identidad y privilegio

El rol SUPERADMIN se determina **en un servicio de confianza** después de autenticar la identidad: no se infiere del correo escrito por el cliente, `es_admin` en `sessionStorage`, un identificador `p_admin_id`, un parámetro HTTP o un botón. Toda acción administrativa deberá comprobar identidad y autorización **en servidor**, con denegación predeterminada, sin función `SECURITY DEFINER` invocable por anónimos para operar como administrador. Solo una identidad verificable, con sesión no caducada, puede ejecutar la operación. Cada operación importante produce un evento de auditoría.

## 2. Capacidades

| Capacidad | SUPERADMIN | Condición |
|---|---|---|
| Consola ejecutiva, padrón, métricas y auditoría | Sí | Autenticado y autorizado en servidor |
| Crear/editar USER y gestionar contraseñas | Sí | No rebajar accidentalmente su propio privilegio; controles de identidad |
| Administración de Doctrina y Docencia | Sí | Operaciones auditadas y segregadas |
| **Botón «Doctrina y Reglamentos»** | **Exclusivo** | Solo en consola SUPERADMIN, nunca en USER |
| Recibir nuevos originales PDF | Sí | **Fuentes oficiales de Gran Logia de Chile** o literatura REAA de procedencia confiable |
| Preingesta local y SHA-256 | Sí | PDF válido, procedencia declarada, autor/emisor, referencia y fundamento |
| Carga física al bucket privado | **No habilitada aún** | Requiere flujo servidor confiable, control de tamaño, MIME, hash, antirrepetición y registro de evento |
| Validar fuente, versión, correlación y derechos | Sí | Evidencia identificable para cada documento; no validación automática |
| Aprobar publicación y uso por IA | Solo con control separado | Cuatro revisiones verificadas, riesgos cerrados y acto de aprobación trazable |
| Procesamiento mediante modelo externo | Predeterminado NO | Permiso individual, informado, auditable y expresa habilitación técnica |
| Eliminar/restaurar documentos | Solo futuro flujo auditado | Preferir retiro/versionado antes que destrucción; reversión verificable |

## 3. Dominio documental permitido

- **Oficial:** constitución, reglamentos, decretos, circulares, instrucciones y programas cuya procedencia oficial de la **Gran Logia de Chile** haya sido comprobada. Una etiqueta `oficial` declarada por el operador no basta para demostrar la autoría.
- **Complementario confiable:** literatura histórica, filosófica, simbólica y docente relacionada con el **Rito Escocés Antiguo y Aceptado (REAA)**, con autor identificado, edición, editorial o institución, referencias de procedencia y análisis de compatibilidad doctrinal.
- **No admisible:** documentos apócrifos, versiones sin trazabilidad, material de origen dudoso o manifiestamente ajeno al ámbito acordado. Ante duda, retener en cuarentena y pedir investigación.
- **Derechos:** nunca asumir que la antigüedad de un texto permite distribuir una digitalización concreta. Registrar límites de reproducción, OCR, citas y envío a LLM.

## 4. Flujo de recepción obligatorio

1. **Seleccionar** PDF local de una fuente admitida (sin transferencia automática).
2. **Registrar procedencia**: emisor/autor, institución, referencia verificable, edición, fecha, fundamento de confiabilidad, derechos y relación REAA.
3. **Validar estructura e integridad**: cabecera PDF, tamaño, SHA-256, duplicados exactos, legibilidad y páginas.
4. **Cuarentena**: el registro permanece como `solo_catalogo` y `publicacion_autorizada=false`; Storage sin acceso anónimo; no indexar ni mostrar resultados a USER.
5. **Revisión documental**: cotejar título, edición, texto íntegro, procedencia oficial o bibliográfica, vigencia normativa, versiones anteriores y contradicciones. Documentar evidencias.
6. **Correlación**: relacionar fuentes con jerarquía y citas exactas. Si una fuente secundaria contradice una oficial vigente, prevalece la oficial para descripción normativa; señalar la discrepancia.
7. **Evaluación de respuestas**: pruebas adversariales de citas, páginas, exactitud, incertidumbre y negativa a inventar contenido; validación humana.
8. **Auditoría de seguridad**: pruebas efectivas de identidad, aislamiento, acceso directo, metadatos, descarga, consultas, logs, fuga de información y prompt injection.
9. **Aprobación expresa**: solo tras aceptación documental, jurídica/institucional según corresponda, operativa y de seguridad. La migración desde preingesta a catálogo autorizado será una operación distinta.
10. **Publicación controlada o retiro**: evento trazable; capacidad de revertir y volver a cuarentena.

## 5. «Doctrina y Reglamentos»

Uso exclusivo SUPERADMIN: investigación y comparación doctrinal/normativa con respaldo verificable y con indicación de página, texto, autor, versión y condición de vigencia. Las respuestas identifican hechos documentados, inferencias, posturas no concordantes y ausencia de fuentes. No adjudican sanciones, ni reemplazan a la Gran Logia o sus autoridades, ni afirman veracidad sin revisión. En fase inicial solo hay **búsqueda textual PDF local**, no consultor RAG ni servicio de decisión.

## 6. Seguridad y límites

- Nada de `service_role`/secretos en navegador, GitHub ni checkpoint.
- Las URLs y nombres de archivos no confieren autorización; validar en Storage/API.
- `USER` nunca puede alcanzar acciones de SUPERADMIN manipulando HTML/JS, sesiones o rutas.
- No crear botones doctinales en USER hasta la aprobación explícita de lanzamiento después de completar todos los controles.
- Se conservan logs, hashes, versiones y sustituciones; los filtros visuales de bitácora no borran evidencia.
- Registros de errores no exponen textos reservados ni credenciales.
- La interfaz de prueba comparte Supabase mientras no exista base aislada: ensayar sin datos sensibles.

## 7. Respuestas de operación

**Éxito:** operación aplicada, auditada, hash y destino verificados.  
**Falta autenticación:** `401` (ninguna mutación).  
**Sin privilegio:** `403` (ninguna mutación ni metadatos revelados).  
**Falta procedencia o aprobación:** `422` / `409` (cuarentena conservada).  
**Falla en Storage o hash:** registrar error, no crear versión activa, revertir o dejar objeto inaccesible en cuarentena.  
**Servicio no disponible:** falla cerrada: sin habilitación alternativa mediante sesión local.

## 8. Criterio de aceptación

El contrato se cumple solo si los controles **de servidor**, flujo de revisión, integridad, auditoría, pruebas de respuestas y pruebas negativas de acceso funcionan de extremo a extremo en un entorno aislado; todos los hallazgos críticos están resueltos y el titular valida el despliegue. Hasta entonces, la función de subir documentos permanece como **preparación local**.

**Versionado:** todo cambio a facultades o políticas requiere nueva versión del contrato, test y checkpoint.
