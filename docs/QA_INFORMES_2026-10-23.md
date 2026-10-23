# Informes ejecutivos y padrones separados — 2026-10-23

Estado: preparado para revisión, sin fusionar ni desplegar. La activación posterior del rol Administrador se documenta en `QA_ROL_ADMINISTRADOR_2026-10-23.md`; sustituye la propuesta de roles al final de este documento.
Base: cd730bfa4ac8ce10a937241cc71cc25e7b57a88e.

## Cambios

- Listado general de usuarios docentes en Asignación de trabajos, incluidos quienes no tienen asignaciones y quienes tienen varias; asignar con usuario precargado, editar y anular cada asignación conservando su historial.
- Tres informes bajo los KPI del Resumen Ejecutivo: trabajos asignados (nombre, código, trabajo, fechas de asignación y entrega), avance de maestros y actividad de acceso (con/sin ingresos registrados).
- Todos los informes se abren en modal, muestran vista previa y permiten descarga directa en PDF A4 horizontal, con texto seleccionable, tipografía embebida, filas completas y cabeceras de tabla repetidas.
- Endpoint privado de solo lectura `admin-informes`: comprueba identidad y perfil Superadmin; no entrega correos, tokens ni IP; lee todas las páginas y rechaza respuestas parciales. No modifica permisos ni necesita migraciones.
- Plazo de servidor 20 s, función Vercel 30 s y aborto de petición cliente a los 25 s. Respuestas con Cache-Control no-store y Server-Timing.
- Padrón de usuarios excluye Superadmin; listado independiente de administradores debajo del primero. No se activa un rol nuevo.
- Botón de cambio voluntario de clave oculto solo para Superadmin; permanece para usuarios. El cambio obligatorio de primer acceso conserva su flujo.
- Textos solicitados eliminados de Doctrina; memoria sigue funcionando sin anuncios de recuperación.
- Acción especial antigua de archivo de Dummy retirada del panel y del endpoint.

## Evidencia de QA

- Suite Node: 314 pruebas aprobadas, sin fallos ni omitidas (~1,1 s local).
- HTTP + Chromium: tres informes, modal y descarga PDF real, móvil/escritorio, cierre sin navegación, datos tardíos descartados, 26 usuarios, múltiples asignaciones, acciones asignar/editar/eliminar, separación de administradores y visibilidad de clave por rol.
- Errores cliente: 400/401/403/500/503, JSON inválido, respuesta incompleta; no se habilita descarga ni se confunden errores con ausencia de actividad.
- API: 400/401/403/405/422/503/504, autorización antes de datos privados, timeout global con proveedor que no responde, no entrega informes parciales.
- Historial sintético de 1101 accesos: recupera tres páginas, no aplica el límite de 100 de la pantalla de bitácora.
- PDF: descarga de los tres archivos; extracción de texto, nombres y acentos; renderizado y revisión visual de tablas, saltos y pies. Tipografía DejaVu Sans (licencia incluida) embebida para independencia del visor.
- Última medición local sintética: asignaciones 98 ms vista / 110 ms PDF; avances 29 / 73 ms; actividad 17 / 47 ms. No representan latencia de producción.
- Regresiones aprobadas: asignaciones-smoke, usuarios-smoke, tenidas-smoke, doctrina-smoke, plataforma-dom, orador-dom, memoria-casos-dom, avance-smoke y memoria-casos-smoke.
- Lecturas reales bajo `service_role` verificadas con ROLLBACK: padrón vigente, módulos, progreso e ingresos accesibles con las columnas utilizadas. Sin escrituras de prueba en la base real.

## Retiro real de la cuenta de prueba (autorizado expresamente)

La operación anterior de panel había revocado y archivado Dummy, no borrado físicamente. Por eso quedaba el perfil y Auth conservaba una baja lógica. No existía una acción de eliminación general de usuarios ordinarios en ese endpoint: no se confirmó un fallo general.

Se verificaron dependencias y una eliminación transaccional reversible antes de aplicar la baja definitiva, exclusivamente sobre los dos identificadores verificados. Después, por instrucción de eliminar la distorsión de prueba, se borraron sus 34 accesos. Verificación final: cero perfiles, cero cuentas Auth y cero accesos Dummy. Sin trabajos, comentarios, asignaciones ni archivos asociados; ningún usuario real eliminado.

## Rol Administrador — propuesta pendiente de definición

| Capacidad | Administrador propuesto | Superadmin |
| --- | --- | --- |
| Usuarios ordinarios y gestión docente | Gestión delegada | Total |
| Trabajos, asignaciones, calendario, biblioteca, comentarios e informes | Gestión delegada | Total |
| Crear administradores y cambiar roles/permisos | No | Exclusivo |
| Modificar, eliminar o restablecer credenciales de Superadmin | No | Exclusivo |
| Claves de integración, infraestructura y configuración de seguridad | No | Exclusivo |

Implementar con rol almacenado y comprobado en servidor, autorización por capacidad y controles de base de datos; impedir escalamiento, acceso por ID a cuentas administrativas y cambios de rol mediante metadatos editables. Auditar operaciones administrativas. No basta ocultar botones ni reutilizar `es_admin=true` para delegar privilegios. Esta propuesta no está activada en este cambio.

## Límite de validación

Nuevas rutas y UI verificadas localmente con datos sintéticos, lecturas de estructura/permisos reales y suites de regresión. La prueba con la sesión real Superadmin en el despliegue definitivo sigue correspondiendo al ciclo de publicación; no se afirma haber ejecutado esa sesión desde la rama local.
