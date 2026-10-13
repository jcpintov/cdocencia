# CHECKPOINT R10 — CORTE AUTORIZADO DEL LOGIN HEREDADO

**Fecha:** 2026-10-13, Chile. **Autorización explícita del titular:** suspender inmediatamente la función de inicio de sesión legacy `public.autenticar_usuario(text,text)`, aun si se interrumpe el portal antiguo de los perfiles no migrados.  
**Repositorio:** `jcpintov/cdocencia` · **rama de desarrollo:** `fix/roles-enter-20261012` · **Supabase compartido:** `pwnnpjygnviyzyyvfxnq`.

## 1. EJECUTADO Y COMPROBADO — no es una propuesta

Migración aplicada con éxito: `r10_retiro_definitivo_rpc_legacy_autenticar_usuario_corte_autorizado_20261013`.

PostgreSQL conserva la función como objeto `SECURITY DEFINER` para recuperación técnica administrativa, pero sus permisos EXECUTE son:
- `anon`: **false**.
- `authenticated`: **false**.
- `service_role`: **true**.

La transacción validó antes del corte el censo (27 perfiles), dos vínculos UUID Auth confirmados, el único Superadmin y la presencia de la función antigua; posteriormente comprobó revocación efectiva, que la RPC Auth `maestro_identidad_actual()` sigue disponible a usuarios autenticados y que no se borraron perfiles. No se alteraron claves históricas.

**Impacto operacional inmediato:** el formulario antiguo `app.js → sbApp.rpc('autenticar_usuario')` deja de iniciar sesión en el portal que usa el proyecto Supabase compartido. No restaurar permisos públicos como atajo. Las 25 cuentas aún no vinculadas no tienen acceso a Docencia hasta invitación, verificación y vinculación institucional por UUID.

## 2. PERFILES PILOTO — PRUEBAS SQL CON JWT SIMULADO

- `jpintov@gmail.com`, cuenta confirmada y enlazada por UUID: **SUPERADMIN**, 27 registros por consulta administrativa, 5 trabajos en editor, **0** actividades como alumno.
- `jpintov@hotmail.com`, cuenta confirmada y enlazada por UUID: **USER**, 5 trabajos en catálogo y 5 avances propios, **0** registros de padrón/editor.
- UID sin perfil vinculado: **cero filas** en identidad y funciones protegidas.
- Estas pruebas simularon `request.jwt.claim.sub` como usuario `authenticated` mediante transacciones **ROLLBACK**. **NO equivalen a una prueba de contraseña/sesión real desde el navegador**.

## 3. AUDITORÍA DESPUÉS DEL CORTE

Asesor Supabase SECURITY:
- Advertencia `anon_security_definer_function_executable`: **0** (ya no aparece).
- `authenticated_security_definer_function_executable`: **21 funciones** protegidas por permisos EXECUTE, que deben mantener validación de identidad y rol; el aviso no implica por sí mismo acceso irregular.
- `auth_leaked_password_protection`: **1 advertencia**; evaluar activar protección de claves comprometidas en ajustes Supabase Auth.
- `rls_enabled_no_policy`: **24 tablas INFO**, cerradas por defecto; las seis tablas públicas de aplicación ya carecen de grants directos para los roles cliente y RLS sigue activa.

Integridad posterior: 27 perfiles tradicionales; 3 cuentas Auth; **2** vinculadas y confirmadas; **1** Superadmin activo; 5 trabajos; 6 progresos; 3 comentarios; 19 metadatos documentales en cuarentena; 2 sustituciones; **0 PDF Storage**.

## 4. LO QUE TODAVÍA NO ESTÁ OPERATIVO

- La nueva aplicación de laboratorio `qa/auth-roles.html` y `api/security/session.js` existe en GitHub, pero el último `READY` encontrado en Vercel era una versión anterior (commit `46a7a400`); la última versión R9/R10 **no está confirmada como desplegada**. Vercel respondió error `402 api-deployments-free-per-day` al intentar nuevo preview.
- El frontend de `cmaestros.ofl.cl` no fue fusionado/desplegado; el backend **sí** fue cambiado y el formulario de login legacy ya no autentica.
- **No existen invitaciones enviadas** a los 25 Maestros pendientes y ninguno debe vincularse solo por coincidencia de email.
- Los 19 PDF reservados no se publicaron, no están en Storage y no se envían a LLM externos.

## 5. ARCHIVOS DURADEROS

- `docs/sql/R10_CORTE_LEGACY_AUTENTICAR_USUARIO_APLICADO_20261013.sql` — registro del cambio, sin reactivación.
- `docs/sql/R10_DIAGNOSTICO_SEGURIDAD_SOLO_LECTURA.sql` — auditoría reproducible.
- `docs/CHECKPOINT_R9_CIERRE_P0_TABLAS_Y_AUTH_20261013.md` — migraciones y adenda R9.1, permisos y vinculación UUID.
- `docs/PLAN_P0_MIGRACION_25_MAESTROS_R9_1.md` — plan de invitaciones con autorización y verificación.
- `docs/CONTRATO_FUNCIONAL_SUPERADMIN_v1.md` y `docs/CONTRATO_FUNCIONAL_USER_MAESTRO_v1.md`.
- `qa/auth-roles.html` — laboratorio de Auth/UI (requiere despliegue R9).
- ZIP de originales `DOCTRINA_ORIGINALES_VIGENTES_LOTE01_20261012.zip`, conservado PRIVADAMENTE, comprobar SHA-256 con manifiesto. Jamás subir a GitHub/Vercel público.

## 6. ORDEN OPERATIVO PARA REINICIAR EL TRABAJO

1. Auditar el estado real de la rama, Supabase y Vercel con referencias exactas; no asumir que una nueva sesión de chat dispone de los archivos ni despliegues.
2. Comprobar en base de datos que `autenticar_usuario` es inaccesible para `anon/authenticated`; no volver a concederlo.
3. Comprobar Auth en navegador para Gmail Superadmin y Hotmail USER con sus contraseñas privadas, sin pegarlas en ChatGPT.
4. Cuando Vercel permita nuevos despliegues, lanzar SOLO `cdocencia-seguridad-lab` rama `fix/roles-enter-20261012`, verificación de preview, QA integral con ambas cuentas, pruebas negativas de privilegios y de tablas.
5. Activar acceso de inicio seguro de usuario y panel Superadmin sobre Supabase Auth; sustituir el login antiguo en el portal solo tras comprobar que ese frontend está listo y aprobado.
6. Revisar protocolos de invitación individual y asociación UUID para 25 pendientes; nunca exportar/clonar hashes de contraseñas.
7. Verificar condiciones G0–G7 y derechos/procedencia/correlación de fuentes. **No habilitar Doctrina USER**.
8. Mantener el concepto **solo dos roles**, Superadmin único y Maestros todos USER, sin control de acceso por A/C/M.
9. No modificar políticas de factura Vercel ni crear nuevos proyectos de pago sin intervención del usuario.

**Estado inequívoco:** la exposición anónima del inicio de sesión legacy está cerrada; la disponibilidad completa de la aplicación y la migración de usuarios están PENDIENTES. La plataforma NO está certificada extremo a extremo.
