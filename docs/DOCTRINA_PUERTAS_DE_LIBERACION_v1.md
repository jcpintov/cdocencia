# DOCTRINA — Puertas de liberación y control de calidad (v1.0)

**Regla general:** el botón doctrinal para USER se mantiene **inexistente** hasta superar todas las puertas y recibir aprobación explícita del Superadmin. "100% seguro" se traduce operativamente en **100% de controles críticos cumplidos en el conjunto de pruebas acordado, cero fallos críticos conocidos, revisión humana y aprobación formal**, no una promesa de perfección absoluta.

| Puerta | Resultado exigido | Evidencia | Estado actual |
|---|---|---|---|
| G0 Dominio del corpus | Solo GL Chile oficial comprobada o bibliografía REAA confiable; autor, edición, procedencia y derechos | Expediente por documento | PENDIENTE |
| G1 Integridad y versiones | PDF original en Storage privado, SHA-256 verificado, páginas, versión, reemplazos auditados, backup recuperable | Hash origen vs Storage | PENDIENTE: 19 metadatos, cero originales |
| G2 Autenticidad y vigencia | Contrastar documentos con originales del emisor/editorial; identificar normas sustituidas y textos incompletos | Verificación con enlaces o constancias | PENDIENTE |
| G3 Correlación | Cada unidad/pasaje vinculado a documento, edición, página; contradicciones y jerarquías identificadas | Matriz documentada, revisión humana | PENDIENTE |
| G4 Calidad de respuestas | Preguntas de referencia, multi-documento, contradictorias, sin respuesta, adversariales; citas exactas y abstención sin evidencia | Batería de tests y acta | PENDIENTE; búsqueda local no es IA |
| G5 Seguridad | Revisión/solución de RPC `SECURITY DEFINER`, identidad servidor, RLS, Storage, BOLA/IDOR, prompts maliciosos, filtración indirecta | Suite negativa USER/anónimo/sesión falsa | BLOQUEO CRÍTICO |
| G6 Derechos y LLM | Permiso de uso institucional y autorización individual para procesamiento externo | Documento de consentimiento y políticas | PENDIENTE |
| G7 Autorización de lanzamiento | Firma del único Superadmin, rollback y monitoreo | Acta de go/no-go y checkpoint | NO APROBADO |

## Pruebas mínimas G4

- Preguntas con **respuesta documentada**: respuesta correcta y referencia comprobable (documento, versión, ubicación exacta).
- Preguntas sin respuesta: reconocer insuficiencia, no "completar" desde memoria general sin autorización.
- Fuentes en conflicto: mostrar discrepancias y su diferente nivel de autoridad, no ocultarlas.
- Documento sustituido: no citar su versión obsoleta como vigente.
- Texto escaneado: detectar ausencia de OCR y abstenerse de inventar contenido.
- Consulta sobre iniciación/aumento/exaltación: etiqueta temática pertinente sin filtro A/C/M.
- Intentos de extraer texto reservado o inducir respuestas por prompt injection: denegación y registro.

## Pruebas mínimas G5

- USER nunca ve botón «Doctrina y Reglamentos» ni rutas análogas.
- USER no puede consultar tabla de ingesta, historial, objetos ni respuestas reservadas incluso por petición HTTP manual.
- Cambiar `sessionStorage.es_admin`, `p_admin_id`, `usuario_id`, querystring, email o cabeceras del cliente no eleva privilegios.
- `anon` y JWT caducado no leen metadatos ni binarios.
- Solo el servidor puede determinar autorización del Superadmin. No revelar secretos en HTML/JS/logs.
- Storage cerrado por defecto, descargas privadas temporales solo tras autorización, sin URL pública persistente.
- Correos administrativos de pruebas se pueden ocultar en reporte estadístico **sin destruir bitácora**.

## Criterios de cierre

Para cada puerta: responsable de comprobación, fecha, versión del corpus, script o evidencia, incidencias abiertas, acción correctiva, firma del Superadmin. Ningún resultado positivo simulado suplanta prueba real en navegador/servidor. Si cambia un documento o una política crítica después de la aceptación, repetir los controles afectados antes del despliegue.

**Publicación a producción:** requiere mandato separado; el código en rama `fix/roles-enter-20261012` no está autorizado para merge/despliegue público hasta cierre de G0–G7.
