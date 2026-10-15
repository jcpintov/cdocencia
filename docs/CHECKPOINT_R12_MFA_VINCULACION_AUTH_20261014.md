# CHECKPOINT R12 — MFA Y VINCULACIÓN AUTORIZADA DE MAESTROS

**Fecha:** 2026-10-14 (Chile). **Rama:** `fix/roles-enter-20261012` · **Repositorio:** `jcpintov/cdocencia`. **Base compartida:** `pwnnpjygnviyzyyvfxnq`.  
**Estado:** lógica R12 en GitHub, migración SQL aplicada, pruebas simuladas y negativas comprobadas, pruebas con Auth/MFA reales PENDIENTES. No es certificación de producción.

## Contrato de seguridad inalterable

- Solo **SUPERADMIN** (cuenta institucional Gmail verificada y vinculada) y **USER**, todos los USER son Maestros.
- SUPERADMIN administra, supervisa y audita; no cursa Docencia como alumno.
- El conocimiento simbólico del grado A/C/M es **contexto**, nunca control de acceso.
- **Doctrina y Reglamentos** exclusivamente SUPERADMIN. USER sigue sin acceso al corpus ni ruta de consulta documental hasta aprobación formal G0–G7.
- Los 19 PDF originales se custodian PRIVADAMENTE, sin repositorio Git ni despliegue; 19 registros en cuarentena, 0 PDFs subidos a Storage, 2 sustituciones históricas.
- Continúan los cierres de seis tablas públicas y del login legacy `autenticar_usuario`. PROHIBIDO restablecer GRANT anónimo para resolver problemas de UX.

## R12 SQL aplicado y verificado

Migración ejecutada: `r12_vinculacion_auth_mfa_aal2_superadmin_auditada_sin_invitar`.

- Creada tabla privada `doctrina.migracion_auth_auditoria`: RLS habilitada y forzada, sin SELECT/INSERT/UPDATE/DELETE para `anon` ni `authenticated`.
- Creada `public.maestro_admin_vincular_auth(uuid,text)`, `SECURITY DEFINER` con `search_path=''`, solo EXECUTE para `authenticated`; `anon` denegado.
- Autoriza la operación ÚNICAMENTE cuando `maestro_identidad_actual()` confirma SUPERADMIN, `auth.jwt()->>'aal' = 'aal2'`, existe un solo perfil USER legacy sin vínculo, existe una sola cuenta Auth confirmada, no suspendida ni eliminada, con correo verificado coincidente, y ese Auth UUID no está asociado a otro perfil ni a Superadmin.
- Requiere motivo escrito entre 12 y 500 caracteres, bloqueo transaccional para concurrencia y audit trail inmutable por permisos cliente. La función no invita, no crea Auth, no modifica credenciales y no puede vincular administradores.
- SQL persistente: `docs/sql/R12_VINCULACION_AUTH_MFA_AAL2_APLICADA_20261014.sql`.

**Pruebas negativas reales del código PostgreSQL, con JWT simulado en transacciones que FALLARON sin escritura:**
1. Gmail/SUPERADMIN con AAL1 → rechazo MFA AAL2 (42501).
2. Hotmail/USER con AAL2 → rechazo no SUPERADMIN (42501).
3. Gmail/SUPERADMIN con AAL2 intentando vincular Hotmail previamente asociado → rechazo de vínculo existente (23505).

**Comprobación posterior:** 27 perfiles tradicionales, **2 vínculos** con Auth, **0 operaciones nuevas en bitácora de vinculaciones**, 1 Superadmin y **0 factores MFA verificados** en la cuenta administrativa. Una función permitida para `authenticated` no significa autorización para USER; todas las decisiones se realizan en el servidor.

## R12 interfaz creada, NO publicada en producción

Archivos:
- `acceso-seguro.html`: sección «Seguridad de la cuenta Superadmin», QR TOTP + código temporal, formulario individual de vinculación con motivo y confirmación. No se muestra en USER.
- `acceso-seguro.js`: `mfa.listFactors()`, `mfa.enroll({factorType:'totp'})`, `mfa.challengeAndVerify()`, `mfa.getAuthenticatorAssuranceLevel()` y RPC protegida `maestro_admin_vincular_auth`. No almacena TOTP secreto, código ni JWT en almacenamiento persistente; borra el QR temporal al terminar/cancelar/salir.
- `acceso-seguro.css`: estilos adaptables y legibles para MFA y vínculo.
- `tests/seguridad-auth-mfa-r12.test.cjs`: test de regresión de denegación USER, falta MFA, flujo QR/código y logout. La ejecución de Node CI **no se ha confirmado**; sí se ejecutó una simulación directa de los controles JavaScript actuales en memoria que pasó tras corregir el error del patrón de seis dígitos.

**No se han enviado invitaciones a los 25 Maestros pendientes ni existe vínculo nuevo.** El formulario solo actúa al pulsar expresamente «Vincular» y aceptar la confirmación; además la función SQL vuelve a exigir MFA y verifica que Auth esté confirmado.

## Despliegues y limitaciones

- En el inicio de esta fase se lanzó **solo preview** de R11 con commit `ce9e328f545edb52a0a7eb4cfe0088a32dab7c88`, que Vercel confirmó `READY`: `https://cdocencia-seguridad-k1ysbt0dv-jpintov-1864.vercel.app/acceso-seguro.html`.
- Ese commit es **anterior a R12**. No utilizarlo para probar MFA.
- El comprobador HTTP externo no pudo acceder a la preview (restricción de acceso) y la API Vercel no devolvió el árbol de archivos; `READY` confirma construcción, NO funcionalidad real.
- Dos variables publicables de laboratorio están configuradas solo para la rama preview: `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`. No se configuró `service_role` en esa API de identidad.
- **R12 necesita despliegue propio y pruebas con sesiones reales** antes de confiar en la activación de una nueva cuenta.

## Pruebas de aceptación del titular, sin compartir credenciales

1. Abrir únicamente la **nueva preview R12 cuyo SHA esté confirmado**.
2. Acceder a Supabase Auth como Gmail/SUPERADMIN. Verificar que muestra panel administrativo y MFA, no «Mi Docencia».
3. Pulsar «Configurar o verificar segundo factor», escanear QR privado en aplicación autenticadora y confirmar código temporal. **No enviar capturas de QR, secreto, OTP ni token al chat.**
4. Confirmar que la interfaz indica «MFA verificado / AAL2». Cerrar sesión y volver a entrar: debe exigir segundo factor antes de una vinculación nueva.
5. Acceder como Hotmail/USER en ventana privada: debe mostrar «Mi Docencia», sin MFA administrativo, padrón, editor ni vinculación.
6. Antes de asociar un usuario real: revisar padrón y contar usuarios confirmados, aprobar expresamente destinatario, justificación y fecha; **no enlazar sin invitación confirmada**.
7. Un nuevo usuario invitado con Auth confirmado pero sin UUID todavía debe recibir denegación del servicio institucional. Solo tras acción validada del Superadmin AAL2 queda habilitado.

## Riesgos y prioridades

- **P0 continuidad:** la base cerró el login legacy y tablas públicas; el frontend antiguo puede estar inoperativo. R11/R12 deben validarse en navegador y eventualmente promocionarse al acceso institucional.
- **P0 MFA:** Superadmin todavía sin factor TOTP verificado. Vinculación protegida falla cerrado hasta configurar AAL2.
- **P1:** sistema de invitaciones seguro y auditable a 25 Maestros, en lotes aprobados; sin contraseñas heredadas, correos confirmados ni concesión por coincidencia de email.
- **P1:** revisar CDN de Supabase JS (versión fija pero externa, sin SRI); protección adicional de contraseñas comprometidas/MFA y actualizaciones de seguridad.
- **P2:** corpus reservado, proveniencia documental, QA de respuestas y liberación G0–G7; nunca Doctrina USER hasta aprobación.

## Recuperación frente a pérdida del sandbox

1. Clonar rama `fix/roles-enter-20261012`; registrar HEAD, leer R9.1, R10, R11 y este R12.
2. Comprobar ACL/RLS y cierre de `autenticar_usuario`, `maestro_identidad_actual` y `maestro_admin_vincular_auth`.
3. Ejecutar `node --check acceso-seguro.js`, `node --check app.js`, `node --check api/security/session.js`; después cada `tests/*.test.cjs`.
4. Verificar con dos cuentas reales sin transmitir claves al chat. No ejecutar pruebas de escritura sobre la base compartida sin destinatario aprobado.
5. Mantener ZIP privado de los 19 originales y SHA256 del manifiesto.
6. No fusionar con `main` ni activar Doctrina USER automáticamente.

**Afirmación verificable:** función R12 y UI presentes, controles simulados superados y MFA obligatorio en SQL; invitaciones, enrolamiento real y pruebas E2E todavía pendientes.

## Adenda R12.1 — factor MFA vivo en servidor (14/10/2026)

Migración adicional **YA APLICADA**: `r12_factor_mfa_live_verificado_adicional_al_jwt_aal2`. La función `public.maestro_admin_vincular_auth(uuid,text)` ahora comprueba DOS pruebas independientes: `auth.jwt()->>'aal'='aal2'` **y** existencia vigente de `auth.mfa_factors.status='verified'` para `auth.uid()`. Esto impide que un JWT con un estado AAL2 antiguo autorice vinculaciones si el Superadmin ya no tiene un factor verificado.

Copia SQL exacta recuperada de la base: `docs/sql/R12_VINCULACION_AUTH_MFA_AAL2_APLICADA_20261014.sql`, actualizada. Conteos después del cambio: **0** registros de vinculación, **2** identidades vinculadas y **0** factores MFA verificados para el Superadmin. `anon` no tiene EXECUTE. No se ha enviado ninguna invitación ni cambiado el padrón.

La prueba de navegador actual de MFA es **simulada**, no equivale a enrolamiento real. Hasta escanear el QR, verificar el código y confirmar la sesión real AAL2, ninguna vinculación nueva puede prosperar. El previo READY R12 aloja el código del panel MFA, mientras que esta adenda y el respaldo SQL son posteriores y no introducen cambios a HTML/JS.
