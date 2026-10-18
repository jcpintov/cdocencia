# Checkpoint de producción — Docencia Masónica (2026-10-16)

## Identidad del proyecto
- Repositorio: `jcpintov/cdocencia` (independiente de proyectos históricos).
- Vercel: `cdocencia`, proyecto `prj_LwDjAmTKhzsCB73NsI9nYJxcw8de`, dominio verificado `https://cmaestros.ofl.cl`.
- Supabase: `pwnnpjygnviyzyyvfxnq`; NO usar otros proyectos Supabase sin verificación.

## Estado confirmado de producción
- GitHub: commit base comprobado `7c660790d4645ca3e436b802d3e9c8e8b6f8b2fa`.
- Despliegue Vercel luego de activar configuración de primer acceso: `dpl_73R1xismvdBK5KJhZ7gYgDdaCd7W` con estado `READY` y dominio `cmaestros.ofl.cl`.
- Variable `PRIMER_ACCESO_GENERAL_ENABLED=true` creada para **production solamente**, verificada por su nombre y destino. No es una variable pública del navegador.
- Integración GitHub → Vercel confirmada; cada commit en main produce despliegue.
- GitHub PR #5 y #6 integrados, CI antes de merge: https://github.com/jcpintov/cdocencia/actions/runs/38950645924, 16 pruebas aprobadas.
- Vercel: no se informaron errores runtime durante la última hora consultada.
- Archivos fuente del repositorio públicos; no subir secretos, credenciales ni documentación doctrinal reservada.

## Padrón y pruebas
- 28 perfiles en `public.usuarios`: **26 participantes**, **1 superadmin**, **1 Dummy**.
- 1 participante ordinario vinculado a Supabase Auth y 25 pendientes de autoservicio.
- Superadmin y Dummy están vinculados con Auth: **3 perfiles enlazados**. Hay una cuarta cuenta Auth sin perfil de Docencia; conservarla sin cambios.
- Dummy: OTP emitido 18:52:47 UTC, Auth creado/vinculado y correo confirmado 18:54:19 UTC; login Auth 18:54:46 UTC y un acceso documentado en bitácora. OTP pendiente: cero.
- La recepción SMTP se infiere del éxito de verificación, pero no se ha examinado visualmente la bandeja. No se envió correo masivo.
- En el backend se aplicaron pruebas SQL transaccionales con rollback; en CI los casos HTTP se simulan con dependencias falsas. No se alteraron las otras 26 identidades.

## Mejoras terminadas
- Control del piloto con habilitación explícita de primer acceso general desde Vercel producción.
- API creación de usuarios limitada a 26 participantes; Dummy y Superadmin excluidos del contador; API de activación obsoleta retirada.
- Panel: indicador `26/26`, botón Agregar desactivado cuando está lleno, validaciones de correo corregidas, funciones heredadas sin UI retiradas.
- Pruebas automatizadas de autorización, OTP, duplicados, cupos, errores SMTP y fallos de vinculación (16 casos).

## Backlog restante, sin sobredimensionamiento
1. Realizar una prueba de acceso con un integrante ordinario voluntario cuando use por primera vez el mecanismo ya habilitado; registrar fallos operativos sin exponer códigos ni contraseñas.
2. Auditar casos de error parcial en `createUser`/enlace Auth y documentar resolución de identidades huérfanas. No eliminar la cuarta cuenta Auth detectada.
3. Continuar mejoras de experiencia y funcionalidad del panel Superadmin (diseño, navegación, estados y acciones realmente implementadas).
4. Mantener Doctrina y Reglamentos solo en Superadmin hasta correlación documental y seguridad aprobadas.
5. Revisar avisos Supabase proporcionadamente: 24 SECURITY DEFINER ejecutables por authenticated, RLS en tablas privadas sin políticas, protección de claves filtradas inactiva. Evaluar límites antiabuso del endpoint si apareciera tráfico anómalo.

## Procedimiento de rollback de primer acceso
- Cambiar `PRIMER_ACCESO_GENERAL_ENABLED=false` en Vercel producción y volver a desplegar el mismo commit o el último validado.
- Confirmar `READY` y dominio; no revertir datos Auth legítimamente vinculados.
- Para revertir código, emplear commits/PR verificados en GitHub; no reescribir historial.

## Vínculos
- https://cmaestros.ofl.cl
- https://github.com/jcpintov/cdocencia
- https://github.com/jcpintov/cdocencia/pull/5
- https://github.com/jcpintov/cdocencia/pull/6
- Contrato fuente: `CONTRATO_PRIMER_ACCESO.md`

## Auditoría administrativa final de 2026-10-16
- SQL: migración Supabase `20261016190153_resumen_docencia_excluye_cuenta_dummy_20261016` aplicada y confirmada. La función de indicadores `maestro_admin_resumen_docencia()` excluye `dummy@ofl.cl`; ya no contabiliza 27 perfiles ordinarios sino 26 integrantes reales.
- UI: PR #7 `4edc795` corrige el checkbox de bitácora: al ocultar al administrador también oculta Dummy. Los eventos no se borran; solo se filtran en la vista.
- Pruebas PR #7: https://github.com/jcpintov/cdocencia/actions/runs/38951965656 — SUCCESS.
- Se confirmó Dummy vinculado con Auth y con ingreso exitoso y registro de acceso. La apertura general se realiza exclusivamente por autoservicio sobre direcciones del padrón, sin correo masivo.
- Avisos security advisor no se incrementaron con la migración: 21 informativos RLS de tablas sin políticas, 24 SECURITY DEFINER y una advertencia de contraseñas filtradas.
- Último commit de código funcional antes de este documento: `4edc795aed3df805afb3721f62f824c531236ebe`; CI y despliegue se revisan después de cada commit documental.


## Mejoras de sidebar de usuarios — 16/10/2026 (tarde)
- PR #8 integrado, commit de código `bad3aa4123c2de831e1829e64b2b93b2b76a4c79`; Vercel producción `READY` en `dpl_4bP3cw8DWpzGTESqYZZ9FLDk2znn`.
- Inicio y Catálogo: navegación lateral unificada con etiquetas legibles, iconografía tipográfica sobria, estado activo destacado, botones más grandes y menú móvil `details/summary` sin deslizamiento horizontal obligatorio.
- Estudio: tres botones de acción reunidos en un panel; selector de trabajos plegable en móvil, expandido en escritorio; enlaces de módulos convertidos en `button` nativos; indicador del trabajo actual y panel de metodología desplegable. Se preservan las acciones existentes y la condición de acceso al Muro (al menos un trabajo completado).
- Afecta exclusivamente `index.html`, `app.js`, `ui-v2.css`, `ui-v2.js` y prueba `tests/sidebar-usuario.test.mjs`. No cambian Auth, permisos, SQL ni pantalla Superadmin.
- Pruebas GitHub Actions: `https://github.com/jcpintov/cdocencia/actions/runs/38974232304` `SUCCESS`; no se reportaron errores de ejecución Vercel en la ventana consultada. La revisión visual autenticada en dispositivos reales sigue por realizar.
- El usuario confirmó que Dummy inició sesión exitosamente antes de estos cambios; no significa que su interfaz actual haya sido revisada visualmente después del despliegue.


## Menús users y superadmin — 2026-10-16
- PR #10 integrado y desplegado: código `be42091ed95e79f4e10b6c3578080c7e38f06c42`. Vercel `dpl_B6bWfmkMiF9e59QbDwsUVKHFWCKT` en producción `READY`, dominio `cmaestros.ofl.cl` asociado.
- Ambos sidebars users (Inicio y Catálogo): eliminado el encabezado redundante «Cámara de Docencia / Espacio de Maestros».
- Orden exacto de navegación: **Inicio → Mis avances → Trabajos de la Cámara → Foro Docente → Este Espacio**.
- «Foro Docente» reutiliza la función existente `mostrarMuroReflexionesUsuarios` y conserva sus restricciones. «Este Espacio» conserva `mostrarDocenciaParaMaestros`. No hay cambios en datos ni permisos.
- Superadmin: iconografía unificada con users mediante glifos tipográficos monocromáticos para encabezado, enlaces de GitHub/Supabase y nueve botones, sin emojis decorativos ni modificación de sus callbacks.
- Validación: CI del PR https://github.com/jcpintov/cdocencia/actions/runs/38979760578 SUCCESS y del merge https://github.com/jcpintov/cdocencia/actions/runs/38979796178 SUCCESS.
- Comprobación adicional en GitHub: dos listas de cinco entradas correctas y ningún `portal-nav-intro` en el HTML.
- La comprobación visual manual tras ingreso con Dummy sigue disponible para contrastar tamaño, espaciados y iconografía en navegadores reales.


## «Este Espacio» — mejora de experiencia de usuarios (2026-10-16)
- PR #11 integrado en main, código `b27fa21267e4ebb9a6100986df71a77492683cca`. Fuente: `index.html`, `app.js`, `ui-v2.css`, `ui-v2.js`.
- La antigua vista de bloques simples se reemplaza por una página editorial con introducción, tres pasos (lectura, cuestionario, reflexión), navegación hacia Trabajos/Mis avances, índice de fundamentos y presentación legible en escritorio/móvil.
- El sidebar users permanece visible en «Este Espacio», con el mismo menú aprobado de cinco entradas, «Este Espacio» como sección activa; menú móvil plegable mediante `ui-v2.js`.
- Se conserva la fuente documental del Superadmin `config_segura.clave='doctrina_docencia_maestros'`, así como los valores locales de respaldo; no se han reescrito contenidos ni modificado permisos, SQL, roles, Auth o cuentas.
- El índice de apartados se genera al leer los bloques vigentes; cada sección es navegable con teclado, los textos se asignan mediante `textContent` y se admite fallback cuando no hay configuración.
- Se agregaron pruebas `tests/este-espacio.test.mjs` con ejecución de la función mediante DOM simulado (estructura, editor dinámico, fallback, tratamiento de texto), y se amplió la prueba previa a los tres sidebars.
- CI previo al merge: https://github.com/jcpintov/cdocencia/actions/runs/38992054326 — SUCCESS.
- Falta constatar manualmente la estética en navegadores autenticados, especialmente la lectura en móvil. No se ha modificado la configuración del entorno ni el padrón de 26 usuarios.


## Incidencia de permisos del editor de trabajos — 2026-10-17
- Síntoma comunicado: consola Superadmin > «Auditoría y Edición», botón «Guardar Encabezado y Texto»: `Error al actualizar trabajo: permission denied for table modulos`. El mismo defecto afectaba `guardarTodasPreguntasAuditoria()`.
- Causa confirmada: la tabla `public.modulos` tiene RLS para lectura autenticada y edición Superadmin, pero `authenticated` solo contaba con permiso de UPDATE sobre `archivo_pdf_base64` por una corrección previa. Las columnas `numero_orden`, `titulo`, `autor`, `contenido_trazado` y `preguntas_json` seguían denegadas por PostgreSQL, antes de evaluar RLS.
- Migración Supabase **aplicada** `habilitar_edicion_segura_modulos_superadmin_20261017`: permiso de UPDATE por columna exclusivamente para esos cinco campos; política preexistente renombrada a `modulos_edicion_superadmin`, manteniendo `USING` y `WITH CHECK` basados en `maestro_identidad_actual().rol = 'SUPERADMIN'`. Los usuarios normales no adquieren facultad de editar y `anon` no obtiene UPDATE. DDL fuente en `sql/20261017_habilitar_edicion_segura_modulos_superadmin.sql`.
- Comprobaciones: `has_column_privilege` confirmó seis columnas editables solo bajo la condición RLS (las cinco de editor + PDF anterior), no `id`, `activo` ni otras columnas; se comprobó la política y se ejecutaron pruebas SQL de actualización reversible como Superadmin (1 fila) y Dummy (0 filas), sin dejar cambios en los datos.
- Trabajo N.º 6 `SIGNIFICADO DE LA EXALTACIÓN`: título, autor, ocho preguntas y PDF siguen presentes. La corrección es de base de datos: no requiere despliegue de frontend ni cierre de sesión.
- Instrucción operacional: si el usuario sigue con el formulario editado abierto tras el error, debe pulsar «Guardar Encabezado y Texto» nuevamente **sin refrescar** la página, para no perder modificaciones pendientes; guardar preguntas mediante su propio botón.


## Normalización de cierres de los seis trabajos — 2026-10-17
- Petición: corregir el editor de Superadmin que no preservaba saltos tras la última línea; todos los trabajos deben terminar con `S.·.F.·.U.·.`, una línea en blanco, nombre del autor sin el tratamiento `Q.·.H.·.` y un espacio final.
- Causa: `guardarEdicionModuloAdmin` utilizaba `.trim()` sobre todo el trazado y eliminaba líneas vacías al final. Además, `renderizarTrazadoEnriquecido` no diferenciaba una firma del texto normal.
- Corrección: `app.js` incorpora `normalizarCierreTrabajo` idempotente (respeta párrafos y puntuación del cuerpo, unifica CRLF y retira cierres duplicados); se aplica automáticamente al guardar. Nuevo botón `Aplicar cierre y firma al texto` permite previsualizarlo en el editor, con explicación visible. El renderer separa y escapa el nombre del autor al mostrar la firma; el CSS la presenta con espaciado propio y el textarea tiene 14 filas.
- Datos: ejecución controlada y verificada en Supabase de `sql/20261017_normalizar_cierre_trabajos.sql`. Los seis `modulos` tienen `cierre_correcto=true` con patrón `\n\nS.·.F.·.U.·.\n\nNombre\n\n`. Los trabajos 1–5 conservan su texto original con firma normalizada; el 6 incorpora `Hugo Adolfo Tapia Romero`, ausente en su versión anterior de plataforma.
- Se mantienen seis trabajos activos, cada uno con ocho preguntas y PDF asociado. No se modificaron documentos PDF, metadatos, evaluaciones, progreso ni usuarios.
- Pruebas Node en `tests/cierre-trabajos.test.mjs`: firmas de cinco casos previos y sexto sin autor al pie, idempotencia, CRLF, rechazo de autores vacíos y renderizado de firma; CI de rama en https://github.com/jcpintov/cdocencia/actions/runs/39006018139 SUCCESS.
- Interfaz móvil y escritorio: pendiente contraste visual final con sesión autenticada. La edición de los seis textos de producción se confirmó por lectura SQL de finales exactos.


## Clasificación por Unidad / Detalle / Código — 2026-10-17
- Solicitado: campos `Unidad → Detalle` (lista desplegable) y `Código` (alfanumérico autorrellenable) en el editor Superadmin; presentar `[CÓDIGO]` y `[UNIDAD]` en cada tarjeta de trabajo, más un segmento final de temas por unidad con enlaces a los trabajos existentes y tarjetas cuando hay varios.
- Arquitectura mínima aplicada a producción Supabase: nueva tabla `public.unidades_docencia(codigo, detalle, orden, activo)`, clave primaria `codigo` alfanumérica, RLS con lectura de autenticados exclusivamente; `public.modulos.unidad_codigo` opcional con FK a catálogo e índice. El rol `authenticated` recibe UPDATE únicamente de esa nueva columna, sujeto a la política existente `modulos_edicion_superadmin` (función `maestro_identidad_actual()`, USING y WITH CHECK). SQL fuente: `sql/20261017_unidades_docencia_catalogo.sql`. Migración Supabase `unidades_docencia_catalogo_v1_20261017` aplicada.
- Estado de datos: seis trabajos conservados, ninguno vinculado todavía a una unidad (`unidad_codigo IS NULL` en todos). Tabla de unidades vacía por diseño: **el usuario anunció que entregará la lista oficial**. No inventar códigos ni nombres; no asociar automáticamente por similitud de títulos.
- UI Superadmin: grupo Unidad con campo Detalle desplegable y Código de solo lectura. Código se llena al seleccionar el detalle; si falla la consulta del catálogo no se altera el vínculo del trabajo al guardar. Catalogar no edita el texto, PDF, preguntas ni progreso.
- UI users: cada tarjeta clasificada muestra `CÓDIGO` sobre `UNIDAD`, se elimina el autor duplicado. El segmento final solo aparece cuando hay unidades; lee las unidades y recorre `listaModulos` (trabajos activos) por `unidad_codigo`: muestra unidades sin trabajos como pendientes, temas publicados en negrita y con botón de apertura, y pequeños mosaicos de temas si hay 2 o más trabajos asociados a la misma unidad. Los enlaces validan los IDs contra el catálogo cargado.
- Tests nuevos: `tests/unidades-docencia.test.mjs` (RLS/esquema, campos, construcción de enlaces, varias tarjetas, protección de HTML y dropdown automático). Prueba real SQL reversible: Superadmin puede actualizar `unidad_codigo`; Dummy no puede alterar registros; Dummy puede leer el catálogo vacío; ningún dato se modificó en los tests.
- Próximo paso **obligatoriamente pendiente de insumo**: recibir la lista oficial de unidades con, idealmente, `Código | Detalle | Orden`, insertarla en `unidades_docencia`, y asignar los seis trabajos a su unidad correcta según clasificación del usuario. Hasta entonces ninguna tarjeta debe mostrar unidad inventada.


## Catálogo oficial de Docencia — Unidad, subunidad y tema (2026-10-17)
- Nómina textual entregada por el usuario con `CÓDIGO,DETALLE`: **112 entradas oficiales**, entre ellas dos unidades matrices `DOC100` «UNIDAD I: BASAMENTOS DOCTRINARIOS» y `DOC200` «UNIDAD II: CONOCIMIENTO SIMBÓLICO-INICIÁTICO»; diecisiete subunidades terminadas en `0` (`DOC110`, `DOC2A0`, `DOC2D0`, etc.) y noventa y tres temas. Último tema: `DOC2D8` «La Cámara del Medio».
- Fuente del catálogo: `sql/20261017_carga_catalogo_oficial_docencia.sql` en GitHub (112 INSERT/UPSERT, títulos respetados, orden correlativo). No se añaden títulos inventados.
- Segmento final de Trabajos de la Cámara: índice por unidad y subunidad, con encabezados prominentes/plegables y temas de lectura; solo códigos ligados a módulos activos generan negrita y botón de entrada al trabajo. Cuando varios trabajos tienen el mismo código aparecen tarjetas de cada uno. Temas sin trabajo no son enlaces.
- Editor Superadmin: selector Detalle agrupado por las subunidades oficiales con código de solo lectura auto-completado; permite vincular trabajo a un tema o a una subunidad/unidad completa, sin modificar su contenido ni sus preguntas.
- Los seis trabajos ya cargados conservan `unidad_codigo=NULL` hasta la asignación editorial autorizada: no inferir correspondencias por similitud de título. La relación código-trabajo no se encuentra en el CSV de unidades.
- Tests: archivo `tests/unidades-docencia.test.mjs` ampliado para comprobar 112 códigos y su orden, clasificación 2/17/93, enlace único, varias tarjetas, temas no publicados, XSS, selector agrupado y pruebas previas de acceso.
- PR #15: https://github.com/jcpintov/cdocencia/pull/15. Tras su despliegue corresponde aplicar SQL versionado a Supabase, verificar recuentos y registrar resultados.


## Estado operativo del catálogo oficial — 2026-10-17 (despliegue bloqueado)
- El PR #15 se fusionó a `main` con SHA `5d360805278d91dc6eeb388a7dd8cf8576d1ec49`. GitHub CI fue `SUCCESS` (workflow https://github.com/jcpintov/cdocencia/actions/runs/39008089837). El código de índice jerárquico está versionado, pero **NO está desplegado al dominio de producción**.
- Intento explícito de despliegue Vercel API falló `HTTP 402 payment_required`, recurso `api-deployments-free-per-day`, cuota **más de 100 despliegues gratuitos en 24 h**, sugerencia `Retry-After 86400`. No modificar el plan/cobro sin orden. No hay CLI Vercel instalado ni credenciales locales verificadas para reintentar por esa vía. El último despliegue productivo comprobado previo al bloqueo es `dpl_FqWEtABN4aKzT6nCrd2HoYAiEEca`, SHA `801f07cd5e5e7a210be025706cb9cbcdf35d1401`.
- Se cargaron en Supabase los 112 pares `codigo,detalle`, con `orden` de 1 a 112, **`activo=false` para todos** (el insert SQL versionado se adaptó en la ejecución de staging). Verificación SQL: 112 en total, 2 unidades, 17 subunidades, 93 temas, 0 activos. No se modificaron los 6 registros de `modulos` ni sus PDF; siguen con `unidad_codigo=NULL`.
- Motivo del staging: la versión productiva anterior representa cada unidad como tarjeta plana; activar los 112 registros antes del despliegue jerárquico provocaría un catálogo extenso y desordenado. Mantener `activo=false` evita ese defecto.
- **Próxima ejecución obligatoria cuando se restablezca la cuota:** comprobar Vercel y publicar `main` en producción; confirmar alias `cmaestros.ofl.cl`, `READY`, y commit de PR #15 o descendiente; entonces ejecutar `sql/20261017_activar_catalogo_oficial_tras_deploy.sql` para activar los 112, verificar conteos y probar navegación en sesión autenticada. El script es idempotente y exige estado completo.
- Asignaciones editoriales: se requiere elegir `unidad_codigo` de los seis trabajos; no crear correspondencias especulativas entre títulos y temas. El CSV suministrado define temas, **no la relación trabajo–código**. Hasta que se asignen, ninguno aparece en negrita enlazado en el índice jerárquico.


## Formato de tarjetas users: CÓDIGO - UNIDAD / SUBUNIDAD — 2026-10-17
- Solicitud posterior al catálogo oficial: en **cada tarjeta de trabajo de usuarios clasificado** mostrar, en este orden, la línea `[CÓDIGO] - [UNIDAD PRINCIPAL]` y debajo `[SUBUNIDAD]`. No mostrar el nombre del tema como si fuera la Unidad.
- Implementación: `construirClasificacionTarjetaDocencia(codigoAsignado, unidadesPorCodigo)` en `app.js`. Para `DOC12B`, resuelve `DOC100` (UNIDAD I: BASAMENTOS DOCTRINARIOS) y `DOC120` (1.2 LA EXALTACIÓN). Para `DOC2A5`, resuelve `DOC200` y `DOC2A0`. Los códigos de subunidades sin tema usan la propia subunidad. En códigos de unidad matriz, no se inventa una subunidad.
- Se presentan nombres literales del catálogo y se escapan textos para prevenir inyección HTML; trabajos sin clasificación no muestran datos inventados. El título, autor, estado, PDF y navegación de la tarjeta se mantienen intactos.
- CSS `ui-v2.css`: primera línea destacada con código y unidad; segunda línea separada para la subunidad, diseño responsivo.
- Nuevos tests de regresión en `tests/unidades-docencia.test.mjs`: jerarquía, `DOC2A5`, casos sin unidad y contenido HTML escapado. CI de PR #17 comprobado en https://github.com/jcpintov/cdocencia/actions/runs/39008634522 (SUCCESS).
- Producción y datos: al comenzar este cambio, los 112 registros oficiales estaban en staging `activo=false` y los seis trabajos sin códigos asignados; el despliegue del catálogo oficial PR #15 seguía bloqueado por la cuota Vercel 100/24h. Este PR **no modifica Supabase** ni activa el catálogo. La visibilidad real depende de publicar la versión en Vercel y asignar códigos de los trabajos en Superadmin.


## Presentación de tarjetas y navegación por código — 2026-10-17 (mock y desarrollo)
- Aprobación editorial de la estructura de cada tarjeta de trabajo de usuario, sin cambiar colores, marco ni acciones previas: fila superior `Trabajo N.º / fecha`; imagen, título y autor; debajo bloque `UNIDAD`, `SUBUNIDAD` y `CÓDIGO` al final; pie original de progreso y botón `Ir`.
- PR #18: nueva función `abrirProgramaDocencia(codigo)` y botón `.grid-card-codigo-enlace`. El código no abre directamente el trabajo: desplaza y enfoca su ficha temática dentro de `catalogoDirectorioUnidades` tras desplegar su Unidad y Subunidad. Se valida contra el catálogo cargado; cuando el módulo no tiene `unidad_codigo` no aparece un vínculo inventado.
- En la sección «Docencia · Unidades y temas» ya no se muestran 112 líneas planas: dos tarjetas matrices plegables, subunidades como tarjetas y temas en un mosaico responsivo. Los temas con trabajo enlazan a su lectura; dos o más trabajos del mismo código se muestran en tarjetas individuales.
- Se preservan íntegros los 112 detalles de la tabla oficial, el número, título, autor y estado de cada módulo, la autenticación, los permisos y las funciones de lectura/evaluación existentes. No se modifica Supabase ni se asignan códigos sin validación editorial.
- Tests `tests/unidades-docencia.test.mjs` ampliados para comprobar presentación de tarjetas, mosaicos, navegación al tema y prevención de vínculos falsos. Workflow PR: https://github.com/jcpintov/cdocencia/actions/runs/39047384112 — SUCCESS.
- El mock visual entregado en el chat es una referencia conceptual, **no es una captura fiel de producción** y cualquier código asociado a un trabajo en él es ilustrativo. La UI productiva conserva los estilos actuales de las tarjetas.
- Estado previo al PR: Vercel producción aún usaba `801f07cd`; catálogo oficial de 112 entradas staged `activo=false` hasta poder desplegar. Revisar estado de cuota/producción antes de activar catálogo mediante `sql/20261017_activar_catalogo_oficial_tras_deploy.sql`.


## Publicación efectiva de Docencia en tarjetas y catálogo oficial — 2026-10-17
- PR #18 integrado al branch `main`, commit `24ea2bbcd45c0e55128f15da5ada5815a68a3f04`. GitHub CI: https://github.com/jcpintov/cdocencia/actions/runs/39047472234, `SUCCESS`.
- Vercel producción `dpl_AX8UCnwtFPLgtBZBjGf3Vo81wBf7`: `READY`; alias verificado `cmaestros.ofl.cl` apuntando a SHA `24ea2bbc...`, sin error de alias. Límite de despliegues anterior ya no impide esta versión.
- Supabase: ejecutado el script versionado `sql/20261017_activar_catalogo_oficial_tras_deploy.sql` tras verificar el SHA y alias de producción. Recuentos SQL posteriores: **112 activos de 112**, con **2 unidades, 17 subunidades y 93 temas**.
- UI de tarjetas users conserva marco, icono, número/fecha, título/autor y pie de progreso/entrada. Entre autor y pie muestra clasificación **UNIDAD → SUBUNIDAD → CÓDIGO**; el código es botón hacia el directorio de Docencia, con apertura automática de unidad/subunidad y foco en el tema.
- Directorio Docencia al final de Trabajos: tarjetas plegables de unidades, subunidades y temas, en grillas responsivas; un tema con trabajo tiene enlace, dos o más muestran tarjetas individuales; los no publicados no fingen disponibilidad. La captura mock generada en el chat es exclusivamente ilustrativa y NO fija asignaciones concretas.
- Integridad verificada: seis trabajos activos, seis PDF originales presentes y seis cuestionarios de ocho preguntas completos. **0 trabajos clasificados** a esta fecha: faltan las vinculaciones explícitas `modulos.unidad_codigo`. En consecuencia, la clasificación todavía no aparece en las seis tarjetas y el programa no ofrecerá enlaces de trabajo hasta asignar esos códigos.
- Monitoreo Vercel: ninguna excepción de ejecución registrada en la hora consultada. Pendiente QA visual autenticada en escritorio y móvil.


## Programa docente de cuatro áreas — migración y tarjetas de trabajos — 2026-10-17
- Se sustituye la nomenclatura antigua de 112 códigos `DOC` por la tabla XLSX aprobada: 175 códigos únicos de `INCI`, `INST`, `FILO`, `ETIC`, organizados en cuatro áreas, ocho unidades, veinticuatro subunidades y ciento treinta y nueve temas. La SQL fuente `sql/20261017_reemplazo_programa_cuatro_areas_y_asociaciones.sql` contiene las transcripciones y objetivos íntegros del PDF entregado por el usuario.
- Correspondencias editoriales de los seis trabajos por número y título exacto: 1 → `INCI013A` + `INCI013B` + `INCI013C`; 2 → `INCI025E`; 3 → `INCI012A`; 4 → `INCI028C`; 5 → `INCI028B`; 6 → `INCI012B`. Cada trabajo tiene un código principal en `modulos.unidad_codigo`, y la tabla adicional `modulos_temas` contiene ocho vínculos sin replicar trabajos, evaluaciones ni avances.
- Nuevo esquema: `areas_docencia(codigo,objetivo_general,paginas_fuente)` con los cuatro objetivos del programa; `modulos_temas(modulo_id,codigo)`. Ambas tablas con RLS lectura autenticada; `anon` sin acceso; escritura no concedida a roles de cliente. La migración exige precisamente 112 entradas previas, seis módulos sin clasificar y títulos concordantes; una divergencia provoca rollback.
- En las tarjetas de Trabajos de la Cámara se preservan encabezado, imagen, título, autor, progreso y acceso, agregando bajo el autor la Unidad, Subunidad y los códigos vinculados (múltiples cuando corresponda). Cada código localiza el tema en el programa.
- Docencia: cuatro tarjetas de área con objetivos documentales originales; unidades, subunidades y temas en tarjetas responsivas; enlaces solo donde exista trabajo vinculado, sin enlaces ficticios; tema pendiente distinguido del publicado. «Este Espacio» se mantiene independiente.
- El editor de Superadmin presenta áreas y unidades agrupadas y permite elegir únicamente temas reales; Código continúa siendo de solo lectura y autocompletado.
- Tests `tests/unidades-docencia.test.mjs`: taxonomía 175=4+8+24+139, jerarquía alfanumérica `INCI02A0`, textos escapados, objetivos y vínculos múltiples. CI del PR #19 https://github.com/jcpintov/cdocencia/actions/runs/39052912263 SUCCESS.
- **Orden de release obligatorio:** PR aprobado y merge → Vercel `READY` en `cmaestros.ofl.cl` con commit de release → aplicar SQL versionada → verificar 175 códigos, cuatro objetivos, seis trabajos con ocho vínculos, conservación de PDF/preguntas/progreso y estado de RLS → comprobación del frontend. Nunca aplicar la migración mientras esté sirviéndose frontend antiguo compatible solo con códigos `DOC`.


## Release verificado — clasificación y nueva Docencia — 2026-10-17
- PR #19 integrado a main, commit `9ef646eaa1758f9dfcd77e3685d33b3d247ae17b`. CI del merge https://github.com/jcpintov/cdocencia/actions/runs/39053024768 **SUCCESS** (41 pruebas).
- Vercel producción `dpl_3YRFo2HQzAXxUFCvSNzjGQkDuBiA` **READY**, alias `cmaestros.ofl.cl` verificado sin error, apuntando a la revisión correcta antes de migrar Supabase.
- Migración SQL `sql/20261017_reemplazo_programa_cuatro_areas_y_asociaciones.sql` aplicada a Supabase `pwnnpjygnviyzyyvfxnq` con nombre `programa_docencia_cuatro_areas_175_y_seis_trabajos_20261017`. Resultado: **175/175 activos**, 4 áreas, 8 unidades, 24 subunidades, 139 temas, 0 códigos `DOC` antiguos, orden 1–175.
- Tabla `areas_docencia`: objetivos íntegros y páginas de fuente para `INCI000`, `INST000`, `FILO000`, `ETIC000`, con permiso SELECT autenticado y RLS.
- Trabajos `modulos` siguen siendo seis; códigos principales: N.º 1 `INCI013A`; N.º 2 `INCI025E`; N.º 3 `INCI012A`; N.º 4 `INCI028C`; N.º 5 `INCI028B`; N.º 6 `INCI012B`. Tabla `modulos_temas`: ocho relaciones (trabajo 1 en `INCI013A`, `INCI013B`, `INCI013C`). No se clonó ningún trabajo.
- Integridad SQL confirmada: seis PDF originales presentes y 8 preguntas en cada módulo, 8 relaciones, todos con código principal. Los contenidos y avances no se alteraron.
- Prueba de acceso: simulación SQL con identidad `Dummy` (`authenticated`) verificó lectura de 4 objetivos, 175 códigos, 8 relaciones y 6 módulos mediante RLS. `anon` sin permiso SELECT de objetivos ni vínculos y clientes autenticados sin permiso INSERT en `modulos_temas`.
- UI en el dominio: tarjetas actuales ahora muestran Unidad, Subunidad y códigos enlazables debajo del autor. Docencia presenta cuatro tarjetas de áreas con objetivos generales, seguido de la jerarquía de ocho unidades y sus 139 temas en tarjetas de estudio; solo los publicados tienen enlace. «Este Espacio» no se modificó.
- Vercel no reportó excepciones de ejecución en la última hora consultada. **Pendiente de validación manual visual y funcional en sesión real con Dummy/Superadmin**, escritorio y móvil.
- Nota para edición posterior: al cambiar el código principal de un trabajo con múltiples vínculos en `modulos_temas`, revisar sus vínculos adicionales; el editor actual selecciona un código principal y los múltiples vínculos se mantienen en la tabla complementaria.


## Encabezado Workspace de usuarios y validación de tarjetas — 2026-10-17
- Se conserva la marca `DOCENCIA MASÓNICA DE TERCER GRADO`; únicamente en sesión ordinaria autenticada aparece a continuación `— WORKSPACE DEL Q.·.H.·. [Nombre del perfil]`. Se utiliza `usuarios.nombre` validado por la sesión Auth; no se duplica el tratamiento fraternal ni se muestra el nombre en login, Superadmin o después del logout.
- UI `index.html` dispone de `encabezadoWorkspaceUsuario` oculto de manera predeterminada y nombre mediante `textContent`. La función `sincronizarEncabezadoWorkspaceUsuario()` se ejecuta en `configurarEntornoUsuario()` y `cerrarSesion()`; aplica tanto a ingreso nuevo como a recuperación de sesión. Estilos responsivos únicamente para el encabezado en `ui-v2.css`, sin modificar la paleta de tarjetas.
- Disposición vigente de las tarjetas de «Trabajos de la Cámara» cotejada contra el código: metadatos, imagen/título/autor, **bajo ellos** Unidad/Subunidad/Códigos y pie original con avance/Ir. Se mantienen imágenes, colores y la ruta de códigos hacia Docencia. No se ha hecho rediseño de tarjetas.
- Se agregó `tests/encabezado-workspace-usuario.test.mjs` con cinco controles para encabezado, normalización del nombre, ausencia de identidad en login/Superadmin, limpieza en logout y orden de los elementos de tarjeta. PR #20: https://github.com/jcpintov/cdocencia/pull/20. CI https://github.com/jcpintov/cdocencia/actions/runs/39054858160 — SUCCESS.
- Sin cambios SQL, RLS, roles, fuentes documentales, preguntas ni avances. Pendiente revisión visual en sesión ordinaria autenticada.


### Publicación pendiente — encabezado Workspace (2026-10-17)
- PR #20 fusionado: `658c1a7b57dae1d61ed8d6c83f1c2870435727eb`. GitHub CI del merge: https://github.com/jcpintov/cdocencia/actions/runs/39054949843 **SUCCESS**. Código fuente y cinco pruebas de encabezado conservadas.
- Personalización solo para users: cabecera `DOCENCIA MASÓNICA DE TERCER GRADO — WORKSPACE DEL Q.·.H.·. [Nombre]`; campo perfil autenticado de Supabase, `textContent`, sin duplicar tratamiento, se oculta durante login, logout y sesión de Superadmin.
- Confirmación editorial posterior: el ejemplo de tarjeta fijaba **orden**, no paleta. Las tarjetas mantienen los colores e imágenes originales, y la Unidad, Subunidad y Código enlazado siguen **debajo del título y el autor**. Test automatizado confirma el orden.
- **Bloqueo real de producción:** intento explícito Vercel `create_deployment` para el commit `658c1a7...` devolvió `HTTP 402 api-deployments-free-per-day` (100 despliegues gratuitos en 24 h, `Retry-After: 86400`). No se cambió plan ni facturación. No se encontró CLI local de Vercel como alternativa. Último alias de producción verificado `cmaestros.ofl.cl` servía SHA `ea414f3bbe4b212686ad461e9e85f84a97c9243a` (anterior al PR #20), `READY`.
- **Acción futura imprescindible:** cuando se libere la cuota, verificar/publicar versión de main que incluya PR #20, comprobar `READY`, alias, CI y sesión user en desktop/móvil. No afirmar que Workspace está actualmente visible en producción.


## Separación de Contenido Docente / Trabajos — corrección de alcance (2026-10-17)
- Aprobación visual del mock: separar la pantalla «Contenido Docente» de «Trabajos de la Cámara». El programa completo (cuatro áreas, objetivos documentales, ocho unidades, subunidades y temas) ya **no se presenta bajo las tarjetas de trabajos**; ocupa `#seccionContenidoDocente`, con su propia navegación lateral, hero ancho y diseño editorial azul/dorado, títulos claros y tarjetas de contenido. No se altera el catálogo ni sus seis módulos.
- Sidebar users en las cuatro vistas principales, en orden: **Inicio, Mis avances, Trabajos de la Cámara, Muro Docente, Contenido Docente, Este Espacio**. El menú `Contenido Docente` está antes de «Este Espacio». Se agregó además acceso desde el sidebar del lector de trabajos. Menús móviles adaptados en `ui-v2.js`.
- Los códigos `INCI/INST/FILO/ETIC` de las tarjetas de Trabajos abren la vista independiente `Contenido Docente`, expanden área/unidad/subunidad y enfocan el tema exacto; desde un tema vinculado se accede a su trabajo existente. El muro mantiene el requisito de progreso completado y no se altera RLS.
- **Corrección editorial explícita:** el anterior punto 4 («quitar importancia visual») se refiere al **bloque de clasificación en las tarjetas de Trabajos de la Cámara, dentro del punto 2**, *NO* al encabezado global de usuario. Se deja `DOCENCIA MASÓNICA DE TERCER GRADO — WORKSPACE DEL Q.·.H.·. [Nombre]` sin modificaciones. Título, autor e icono de trabajo conservan protagonismo; Unidad/Subunidad/Código son metadatos más discretos debajo, con los colores institucionales ya aprobados.
- Fuentes cambiadas: `index.html`, `app.js`, `styles.css`, `ui-v2.css`, `ui-v2.js`; pruebas en `tests/sidebar-usuario.test.mjs`, `tests/unidades-docencia.test.mjs`, `tests/encabezado-workspace-usuario.test.mjs`. No requiere migraciones SQL, cambios de permisos ni alteración de los 175 códigos o enlaces.
- PR #21: https://github.com/jcpintov/cdocencia/pull/21. CI aprobado https://github.com/jcpintov/cdocencia/actions/runs/39057886539. Próximo paso: fusionar y verificar estado real Vercel/alias/domino. Validación visual con sesión autenticada aún pendiente.


## Superadmin — reparación del editor protegido (2026-10-18)
- «Este Espacio» queda editorialmente **en pausa**, por indicación del usuario. No se han modificado sus cuatro fundamentos ni el texto conservado en Supabase.
- Diagnóstico real: el frontend guardaba `modulos` mediante `sbApp.from('modulos').update(...)` pese a que el rol `authenticated` solo dispone de SELECT. Causa probable directa del error `permission denied for table modulos` en edición de trabajo y preguntas.
- Solución PR #26: API serverless `api/admin-trabajos.js`, método POST, Bearer Auth validado con `auth.getUser`, identidad de correo de la cuenta Superadmin única y perfil autenticado `es_admin=true`; clave `SUPABASE_SERVICE_ROLE_KEY` únicamente del lado servidor. Datos validados por acción (título, autor, orden, cierre/texto y exactamente ocho preguntas). Los clientes ordinarios mantienen **cero permisos directos de modificación**.
- `guardarEdicionModuloAdmin` y `guardarTodasPreguntasAuditoria` pasan a POST autenticado; rechazos/error muestran mensaje, sin declarar éxito; preguntas se clonan para evitar mutación local antes de confirmar persistencia. Cambiar un código principal procura conservar vínculos temáticos adicionales en `modulos_temas`.
- Nuevas pruebas `tests/admin-trabajos-seguro.test.mjs`; CI PR https://github.com/jcpintov/cdocencia/actions/runs/39107632082 `SUCCESS`. **No se editaron filas reales de módulos ni cuestionarios en Supabase durante esta implementación**.
- Pendiente QA en sesión Superadmin real de la operación de escritura y consolidación de enlaces, sin usar documentos de producción como pruebas destructivas.
- Resto de backlog: revisar todos los controles de Superadmin que aún realizan escrituras directas sobre tablas sin privilegios (p. ej., renumerar y borrar trabajos) y trasladarlos a rutas protegidas, siempre tras verificar alcance y mantener flujos actuales.
