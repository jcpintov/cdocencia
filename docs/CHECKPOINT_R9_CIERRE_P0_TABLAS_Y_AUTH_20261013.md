# CHECKPOINT R9 — CORTE P0 DE EXPOSICIONES DIRECTAS

**Fecha:** 2026-10-13, horario de Chile. **Estado:** MIGRACIONES SQL APLICADAS Y COMPROBADAS en Supabase compartido, frontend nuevo aún en rama laboratorio.  
**GitHub:** `jcpintov/cdocencia`, rama `fix/roles-enter-20261012`. **Supabase:** `pwnnpjygnviyzyyvfxnq`. **Vercel laboratorio:** `cdocencia-seguridad-lab`. **Portal público:** `cmaestros.ofl.cl` (**NO se publicó nuevo frontend**).

## 1. Mandato vigente

- Solo dos tipos de cuenta: `SUPERADMIN` (**jpintov@gmail.com**, único) y `USER/Maestro` (piloto **jpintov@hotmail.com**).
- El Superadmin **administra, supervisa y audita**, pero NO participa en Docencia como alumno. La restricción existe en RPC y triggers, no solo en UI.
- Los grados A/C/M son etiquetas semánticas, no permisos.
- `Doctrina y Reglamentos` es **exclusivo Superadmin**. NO crear botón para USER antes de aprobar G0–G7.
- Corpus REAA Gran Logia de Chile: solo fuentes oficiales contrastadas y literatura confiable; 19 PDFs originales en custodia privada, **0 PDF en Storage, 0 publicados**, 19 metadatos en cuarentena y 2 sustituciones.
- Gemini histórico está obsoleto. No reintroducir claves ni integrar LLM externo con documentos no expresamente autorizados.

## 2. Medidas P0 aplicadas — migraciones R9

Las siguientes migraciones se APLICARON en el mismo proyecto Supabase que consume el portal existente. **No reejecutar automáticamente**:

1. `r9_cierre_acl_rls_directo_progresos_comentarios_auth_rpc_solo`: REVOCADOS permisos directos para `PUBLIC,anon,authenticated` y eliminadas las cuatro políticas de cada tabla en `public.progreso_maestro` y `public.comentarios_muro`. Los datos permanecen; solo funcionan RPC verificadas.
2. `r9_catalogo_editorial_docente_exclusivo_superadmin_auth`: nueva RPC `public.maestro_admin_trabajos_editor()` que devuelve cinco trabajos editoriales solo con JWT SUPERADMIN verificado, sin PDF binario ni secretos. USER recibe cero filas; anónimos no tienen EXECUTE.
3. `r9_cierre_lectura_anon_directorios_modulos_usuarios_solo_rpc`: retirados permisos de lectura **por tabla y por columna** (incluidos correo, respuesta correcta y PDF embebido) de `public.usuarios` y `public.modulos` a `anon/authenticated`; eliminadas políticas antiguas. Alternativas: `maestro_padron_superadmin`, `maestro_admin_trabajos_editor`, `maestro_modulos_activos`, `maestro_trabajo_estudio`.
4. `r9_registro_ingresos_auth_identidad_verificada_limitada`: nueva RPC `maestro_registrar_ingreso_auth()`, audita la identidad derivada de `auth.uid()`, nunca acepta identificador ni IP declarados por navegador, y limita duplicados del mismo usuario a una entrada por 60 segundos.
5. `r9_bloqueo_insercion_anonima_registro_accesos`: bloqueadas inserciones anónimas en bitácora y retiradas sus políticas; consulta autorizada para Superadmin por `maestro_admin_bitacora`.
6. `r9_cierre_configuracion_institucional_directa_anon`: retirados SELECT y políticas públicas de `public.config_segura`, incluida la lectura temporal. Configuración y credenciales no recuperables directamente desde el navegador.
7. `r9_rol_unico_superadmin_restringir_concesion_privilegios`: revocado EXECUTE de `doctrina_admin_cambiar(text,boolean,text)` a `PUBLIC,anon,authenticated` y creado índice único parcial `doctrina.superadmins_solo_uno_activo_idx`. Solo **un** Superadmin activo en la tabla. La consulta de rol sigue disponible.

**Verificación posterior:** las seis tablas `usuarios`, `modulos`, `progreso_maestro`, `comentarios_muro`, `registro_accesos` y `config_segura` reportaron **cero SELECT/INSERT/UPDATE directos** para `anon` y `authenticated`, **cero políticas RLS** y ningún dato suprimido. Ausencia de políticas con RLS habilitado significa **denegar**, no desproteger.

## 3. Pruebas de roles (JWT simulado en PostgreSQL, transacciones ROLLBACK)

- SUPERADMIN: lectura de 27 perfiles por `maestro_padron_superadmin`, 5 trabajos editoriales, supervisión de 26 Maestros, sin catálogo ni progreso como alumno.
- USER/Hotmail: 5 trabajos visibles, 5 progresos propios, sin padrón, sin editor ni supervisión.
- `maestro_trabajo_estudio`: 5 trabajos, 8 preguntas por trabajo y cero campos `respuesta_correcta` o `retroalimentacion`.
- `maestro_registrar_ingreso_auth()`: llamada válida por Gmail y Hotmail en transacciones revertidas; cero cambios permanentes de estas pruebas.
- Antes del corte: en los últimos 14 días hubo 51 registros de acceso correspondientes a solo dos cuentas y ambas estaban vinculadas a Auth. Esto **no acredita** uso cero de las otras 25 cuentas fuera de esa ventana.
- Auditoría Supabase después del corte: 1 WARN sobre función SECURITY DEFINER anónima (`autenticar_usuario`); 22 advertencias sobre SECURITY DEFINER accesibles por `authenticated` (requieren comprobación individual de autorización); 1 WARN de protección de contraseñas filtradas, 24 INFO de RLS sin policy intencionales.

## 4. CÓDIGO desplegado y NO desplegado

**GitHub rama de laboratorio solamente**:
- `qa/auth-roles.html`: el editor Superadmin usa `maestro_admin_trabajos_editor`, sin `.from('modulos')`; el inicio de sesión registra la auditoría mediante `maestro_registrar_ingreso_auth` y cierra sesión ante fallo de rol o de registro.
- `tests/seguridad-r9-sin-rest-directo.test.cjs`: regresión contra llamadas a tablas protegidas en QA.
- `api/security/session.js`: perfil desde JWT y `maestro_identidad_actual`, sin SERVICE_ROLE_KEY en el navegador.
- **No asumir que Vercel ya publicó el último commit.** Último despliegue READY consultado anteriormente corresponde al commit `46a7a400`, anterior al editor/auditoría R9. Se requiere un nuevo preview READY del SHA actual y prueba real Gmail/Hotmail.

**Advertencia operacional inequívoca:** el proyecto Supabase es compartido. Estos cambios de SQL **ya afectan al portal antiguo** aunque `main` y el frontend de producción no hayan sido actualizados. Sus pantallas que hacen `.from('usuarios'/'modulos'/'progreso_maestro'/'comentarios_muro'/'registro_accesos'/'config_segura')` directamente pueden fallar. El login legacy `autenticar_usuario` permanece funcional a nivel permiso RPC, pero la docencia de la interfaz antigua NO está validada ni garantizada. Redirigir usuarios activos al entorno autenticado nuevo tras su prueba.

## 5. Riesgos pendientes que NO deben ocultarse

**P0 residual crítico:** `public.autenticar_usuario(text,text)` sigue ejecutable por `anon`, `SECURITY DEFINER`, para evitar cortar irreversiblemente el login de **25 cuentas aún no migradas**. Revocarla es el corte final; antes debe completarse transición o existir autorización explícita para dejar fuera de servicio el acceso heredado.

**P0 operacional:** 27 perfiles legacy, 3 identidades Auth, 2 vinculadas, **25 pendientes de invitación/confirmación**. NO enviar invitaciones masivas sin validar el padrón y confirmar el envío; nunca copiar hashes a Auth.

**P1:** comprobar con **sesiones reales** de Gmail y Hotmail las funciones R9 (no solo SET LOCAL ROLE), QA del flujo completo y restauración de experiencias del portal en Auth.
**P1:** revisar 22 funciones `SECURITY DEFINER` accesibles a authenticated y sus predicados de autorización; nunca asumir vulnerabilidad solo por el aviso del linter ni marcar como seguros sin pruebas.
**P1:** activar detección de contraseñas filtradas en Supabase Auth si el plan lo permite; verificar configuración.
**P2:** carga segura de originales a bucket privado, derechos documentales, correlación exacta por páginas, respuesta verificable y aprobación G0–G7. No activar botón USER.

## 6. Recuperación sin sandbox

1. Clonar `jcpintov/cdocencia` rama `fix/roles-enter-20261012`; leer R7, R8 y este R9, y contratos de SUPERADMIN/USER.
2. Comprobar las migraciones R9 en Supabase e inspeccionar las ACL RLS mediante consultas de SOLO LECTURA. No reaplicar SQL por defecto.
3. No restaurar permisos públicos de las seis tablas para “arreglar” las pantallas: sustituir interfaz por RPC autenticadas. **Deshacer el cierre R9 reabre la vulnerabilidad.**
4. Verificar Gmail/SUPERADMIN y Hotmail/USER en entorno QA con Supabase Auth, sin enviar credenciales al chat.
5. Ejecutar `node --check app.js`, `node --check api/security/session.js`, `for file in tests/*.test.cjs; do node "$file"; done` en clon.
6. Corpus original de 19 PDF solo en ZIP privado, contrastar SHA-256; no publicar los originales en GitHub ni Vercel.
7. No fusionar `main`, no desplegar `cmaestros.ofl.cl`, no habilitar Doctrina USER hasta validar todo y recibir aprobación.
8. Cualquier necesidad de recuperar el portal antiguo requiere una decisión de continuidad vs confidencialidad; priorizar/Auth con autorización real y no reabrir RLS anónima.

**Estado:** P0 de tablas expuestas cerrado; P0 de login legacy y migración de identidades pendientes.


## ADENDA R9.1 — identidad Auth vinculada por UUID, 2026-10-13

**Aplicado en la base compartida, con pruebas positivas/negativas:**

- Migración `r9_enlace_auth_uuid_perfiles_confirmados_fail_closed`: se escribió `public.usuarios.auth_user_id` exclusivamente en los dos perfiles piloto ya confirmados por correo y rol; se creó el índice único parcial `usuarios_auth_uuid_unico_idx`. Los demás 25 perfiles permanecen sin vínculo. **Nadie recibió una nueva cuenta ni invitación**.
- `public.maestro_identidad_actual()` ahora exige asociación exacta `public.usuarios.auth_user_id = auth.uid()`, correo coincidente y confirmado, relación coherente con el único Superadmin y exclusión de identidades suspendidas/eliminadas. Ya no admite una mera coincidencia de correo como prueba de pertenencia institucional.
- Migración `r9_migracion_auth_indicadores_uuid_verificado_no_email`: el padrón Superadmin y el resumen de migración consideran `auth_vinculada` únicamente si el UUID asociado está realmente confirmado. **Resultado comprobado:** SUPERADMIN 27 perfiles y 2 vinculados/25 pendientes; USER cero filas.
- Regresión en transacciones revertidas: Gmail conserva SUPERADMIN y 5 trabajos de editor/0 avances propios; Hotmail conserva USER y 5 avances propios/0 funciones de editor.
- Las nuevas invitaciones **NO deben conceder Docencia automáticamente por coincidencia de email**. La asociación `auth_user_id` es un acto de activación institucional a registrar luego de identidad confirmada, y se hará desde un servicio Superadmin seguro; no actualizar desde navegador ni restaurar escritura pública.

Esta adenda prevalece sobre cualquier indicación anterior de que el correo por sí solo habilita un USER/Auth nuevo.
