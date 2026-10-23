# Conversaciones aprobadas y Administrador antes del primer acceso

Estado: NO PUBLICAR por instrucción del propietario. Cambios locales en `feat/conversaciones-aprobadas-admin-pendiente`, sin fusionar ni desplegar.

- Se retira «Tu consulta» de la interfaz; el campo conserva una etiqueta accesible.
- Doctrina incluye la subsección «Conversaciones del chat · revisión y memoria», con filtros, diálogo archivado, referencias, aprobación, retiro y descarga JSON exclusiva de casos aprobados.
- Cada respuesta generativa guarda una instantánea del diálogo disponible, pendiente por defecto. Las instantáneas anteriores no se reescriben ni se aprueban automáticamente. Los dos casos anteriores mantienen pregunta y respuesta; no se puede recuperar retrospectivamente un diálogo que no se había archivado.
- La memoria sirve como antecedente recuperable del agente, con comprobación de fuentes vigentes; no modifica pesos del modelo. Las conversaciones sin referencias quedan archivadas y pueden revisarse, pero no se reutilizan como fuente normativa.
- Cada administrador consulta y aprueba únicamente sus propios casos. Se preserva el aislamiento de actores, RLS y la denegación de acceso directo del cliente.
- Exportación paginada y sin resultados parciales ante errores; límite explícito para evitar superar el tamaño de respuesta de Vercel. La memoria de sesión conserva resúmenes, sin cargar todo el diálogo en cada inicio.
- Superadmin puede asignar ADMIN a perfiles activos del padrón aunque no estén vinculados a Auth. No crea cuentas Auth ni envía invitaciones al conceder el rol. Los permisos solo son utilizables después de la activación normal por correo; primer acceso, verificación y cancelación del OTP admiten USER/ADMIN y excluyen SUPERADMIN.

## Pruebas

332 pruebas Node aprobadas. PostgreSQL aislado verifica asignación previa a Auth, ausencia de permisos antes de activar, emisión/verificación/cancelación del OTP, rol posterior a la vinculación y protección de Superadmin. Chromium verifica cuentas sin Auth, archivo de diálogo, aprobación y retiro, descarga real JSON con solo casos aprobados y encuadre móvil. DOM comprueba XSS, limpieza de sesión, respuestas tardías y memoria. Regresiones de informes PDF, asignaciones, usuarios, calendario, Doctrina/perfil, Orador y memoria aprobadas.

## Migración aplicada antes de la orden de detener la publicación

`20261023190542_conversaciones_admin_pendiente.sql` ya aplicada y verificada en Supabase. Agrega el diálogo JSON y ajusta las funciones de roles y primer acceso. Dos casos existentes preservados; cero roles concedidos y cero conversaciones aprobadas por este trabajo. Se mantienen 28 USER y 1 SUPERADMIN; acceso directo del cliente a casos y a la RPC de roles denegado.

La publicación de la interfaz y handlers nuevos queda pendiente de una nueva instrucción. No se ha enviado esta rama a Vercel ni se ha creado un despliegue nuevo.

## Encabezado de informes según referencia adjunta

Se incorpora el membrete institucional a los tres informes ejecutivos: identificación de la plataforma, R.·.L.·. OFL 146 y Talagante a la izquierda, emblema dorado original al centro y tipo de informe/fecha de emisión de Santiago a la derecha, con línea separadora oscura. Se adapta a móvil y se repite en todas las páginas PDF. Se conserva texto seleccionable y fuentes embebidas; se ajusta el espaciado de filas para evitar una página huérfana en el conjunto de prueba.

Validación local: 332 pruebas Node aprobadas; tres descargas PDF reales; extracción de texto de todas sus páginas con comprobación del membrete repetido; revisión visual de márgenes, logo, tablas y continuidad. Con 26 usuarios sintéticos: asignaciones una página; avances y actividad dos páginas cada uno. Sin fusión, push ni despliegue.
