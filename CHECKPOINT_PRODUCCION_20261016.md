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
