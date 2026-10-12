# CONTRATO OPERATIVO — USER / MAESTRO v1.0

**Proyecto:** Doctrina–Docencia, Cámara de Maestros OFL Nº146.  
**Estado:** política funcional acordada y barrera de seguridad a implementar y certificar antes de publicación doctrinal.

## 1. Identidad y alcance

Solo existen los roles `SUPERADMIN` y `USER`. Todos los usuarios ordinarios `USER` son **Maestros**. La aplicación no solicita grados de Aprendiz o Compañero ni impone divisiones A/C/M en la biblioteca o la consulta. La admisión y revocación de usuarios son atribuciones del SUPERADMIN, validables en servidor.

`USER` inicia sesión con credenciales propias, cambia su clave cuando sea obligatorio y acepta los compromisos institucionales de uso. Las sesiones caducadas o inválidas no deben permitir acceder a material protegido.

## 2. Funcionalidad autorizada

| Capacidad | Estado del USER |
|---|---|
| Docencia de Cámara: trabajos asignados, estudio, reflexiones y mural | Permitido conforme a funciones y permisos actuales |
| Lectura de materiales institucionales ya publicados para Maestros | Permitida cuando esté habilitada y verificada |
| Buscar en doctrina **aprobada** y obtener citas | **FUTURO**; no exponer botón antes de autorización final |
| Relacionar iniciación/aprendiz/aumento/compañero/exaltación con grados | Contexto semántico, **nunca filtro de acceso** |
| Consultar original o fragmento reservado / en cuarentena | Prohibido |
| Leer catálogos privados de preingesta, hashes internos, bitácora admin | Prohibido |
| Cargar, editar, reclasificar, retirar o aprobar documentos | Prohibido |
| Autorizar procesamiento externo de documentos | Prohibido |
| Usar botón **«Doctrina y Reglamentos»** (análisis normativo) | **Prohibido y no visible** |
| Obtener roles administrativos por ID/email o edición de sesión | Prohibido; servidor deniega |

## 3. Estado de publicación doctrinal

**Ningún botón ni acceso a consulta doctrinal para USER** hasta certificación y habilitación **explícita** del Superadmin. Mientras esté cerrado, el usuario trabaja solo con la Docencia operativa existente. La navegación USER no incluirá rutas ocultas, API de consulta habilitada ni campos que permitan inferir contenidos en cuarentena.

## 4. Contrato de las futuras respuestas doctrinales

Cada respuesta habilitada a USER debe:

- Recuperar solo fuentes confiables **aprobadas**, oficiales de Gran Logia de Chile o literatura REAA pertinente, con autorización de uso.
- Identificar claramente título, emisor/autor, edición, artículo o página y documento fuente.
- Distinguir cita fiel, paráfrasis, interpretación y divergencia entre fuentes.
- No inventar artículos, frases, autores, páginas, decretos ni resoluciones.
- No tratar una opinión de literatura complementaria como disposición normativa oficial.
- Indicar si no existe evidencia suficiente; abstenerse de pronunciamientos concluyentes.
- Respetar el ámbito de derechos y no enviar documentos reservados a terceros sin autorización individual.
- No resolver asuntos disciplinarios ni reemplazar autoridades; derivar al SUPERADMIN cuando corresponda.

Los grados se identifican solo si el tema alude pertinentemente a **iniciación/Aprendiz**, **aumento/Compañero**, **exaltación/Maestro** o conceptos correlacionados. Si no corresponde, la consulta permanece transversal. Las etiquetas no agregan ni quitan permisos.

## 5. Límites de seguridad

`USER` no consulta directamente el bucket privado, tablas de cuarentena, funciones administrativas ni rutas internas no habilitadas. No se autoriza con `usuarioActual.es_admin`, `sessionStorage`, correo declarado ni cadenas `p_admin_id`. Los servicios deben autenticar y autorizar antes de recuperar texto, embeddings, citas, hashes o metadatos.

Operaciones prohibidas deben fallar en servidor con `401/403`, incluso si se modifican el DOM, almacenamiento local, URL, cuerpo HTTP o tokens inválidos. Toda consulta y fallo pertinente es auditable sin revelar texto secreto en logs.

## 6. Activación futura: condiciones acumulativas

1. Corpus documental aprobado y cotejado con originales: procedencia, integridad, edición, vigencia y derechos.
2. Correlación verificable entre obras, capítulos, páginas, citas y jerarquía normativa; divergencias documentadas.
3. Respuestas evaluadas con pruebas positivas, negativas y adversariales, cero citas fabricadas y mecanismos de abstención.
4. Seguridad comprobada con USER, anónimo, sesión adulterada/caducada y acceso directo al bucket/API, sin filtración.
5. Revisión institucional y aprobación expresa del Superadmin.
6. Despliegue gradual y reversible, con seguimiento de resultados y retiro ante error.

**Hasta completar los seis hitos, no desarrollar entrada visible de doctrina en USER ni habilitar backend de consulta a ese rol.**

## 7. Garantías de experiencia

Interfaz profesional, sobria y accesible; estados comprensibles ante error; sin promesas de respuesta cuando no hay fuentes validadas. Se comunica el motivo de las restricciones sin revelar existencia o ubicación de documentación no autorizada.
