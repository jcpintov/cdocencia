# Doctrina y Reglamentos — cierre técnico de implementación, 2026-10-19

## Alcance
Biblioteca privada exclusiva de la cuenta Superadmin ya autorizada. Independiente del editor de contenidos de «Este Espacio». No se habilita a participantes, no publica contenidos ni envía documentos a servicios de IA. Implementación en el PR #32; producción sin publicar.

## Diagnóstico real
- Esquema `doctrina` existente y bucket `doctrina-originales-privados` privado.
- 19 registros en `ingesta_documental`.
- Cero objetos Storage, cero documentos, cero versiones.
- Los 19 registros tienen grado, derechos y autorización de publicación pendientes. Un inventario no es un original cargado.

## Implementación
- Acceso real desde el menú Superadmin y pantalla propia.
- API `api/admin-doctrina.js`: sesión Auth verificada en servidor, perfil administrativo y correo de la cuenta única comprobados.
- Carga directa al bucket privado mediante autorización temporal, con ruta aleatoria, sin sobrescritura. PDF hasta 50 MiB.
- SHA-256 calculado en navegador y recomputado por el servidor a partir de bytes descargados. Comprobación de tamaño y cabecera PDF antes de registrar.
- Registro atómico en tablas existentes, idempotente por objeto. Documento en borrador reservado, versión en revisión. No cambia el inventario ni sus validaciones editoriales.
- Descarga verifica bytes/SHA y emite enlace firmado de 60 segundos con disposición de descarga.
- RPC `doctrina_gestion_superadmin` aplicada mediante migración `doctrina_gestion_superadmin_privada_20261019`: solo service_role, comprobación adicional de actor en SQL. Sin acceso directo anon/authenticated a tablas documentales.
- Búsqueda local y separación visual de originales e inventario. Render mediante textContent; vaciado del estado al cerrar sesión. Reintento de registro tras carga exitosa sin duplicar archivos.

## Evidencia
Pruebas Node de API: sin sesión, usuario ordinario, identidad ajena, bucket público, tamaño, rutas, listado, registro/hash, descarga/hash, método y acción de publicación. Pruebas UI de aislamiento, integridad y representación segura. Pruebas SQL transaccionales revertidas: listado de 19 registros, rechazo de actor ajeno y rechazo de original ausente sin insertar documentos. ACL: anon=false, authenticated=false, service_role=true. RLS activo y SELECT cliente denegado en documentos/versiones/ingesta. Advisor sin aviso que mencione la nueva RPC.

## Límites que impiden declarar la biblioteca documental terminada
No se han cargado ni validado los 19 originales. No se inventan fuentes ni se aprueban derechos o grados de forma automática. No se probó una carga/descarga completa desde una sesión Superadmin real; pruebas HTTP de lógica usan dobles, SQL real solo caminos que no requieren archivos. QA visual autenticada pendiente. Una prueba positiva de Storage requiere un archivo real y sesión autorizada; no se crearon credenciales ni se recuperaron secretos para simularla.

El circuito técnico queda implementado para incorporar y revisar originales. La biblioteca no puede recibir estatus «COMPROBADA» mientras falten los originales y la comprobación positiva. Este documento no acredita publicación ni validación doctrinal.
