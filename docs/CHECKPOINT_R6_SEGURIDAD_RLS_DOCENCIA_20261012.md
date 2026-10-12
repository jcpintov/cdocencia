# CHECKPOINT R6 — SEGURIDAD APLICADA Y RECUPERACIÓN

**Fecha:** 2026-10-12. **Rama:** `fix/roles-enter-20261012`. **Repositorio:** `jcpintov/cdocencia`. **Proyecto Supabase:** `pwnnpjygnviyzyyvfxnq`.  
**Estado:** seguridad parcial aplicada a la BASE COMPARTIDA; cambios de interfaz solo en rama de desarrollo. **NO hay autorización de publicación a producción.**  
**Predecesor:** `docs/CHECKPOINT_R4_AUTH_BLOQUEO_RPC_20261012.md` y paquete R5.

## Identidades y reglas de negocio

- `jpintov@gmail.com` → SUPERADMIN, único autorizado.
- `jpintov@hotmail.com` → USER/Maestro; cero permisos administrativos.
- 27 perfiles legacy; 3 usuarios en Supabase Auth; 2 vinculados. Restan 25 por migrar.
- Grados Aprendiz/Compañero/Maestro son CONTEXTO TEMÁTICO, no filtros de acceso.
- «Doctrina y Reglamentos» SOLO Superadmin. Nunca habilitar Doctrina para USER hasta evidencia documental, calidad de respuestas, derechos, seguridad G0–G7 y aprobación expresa.
- Corpus: 19 originales PDF vigentes privados, 2 sustituciones, 19 registros de cuarentena, 0 objetos en Storage.

## Cambios SQL ejecutados y comprobados (NO REEJECUTAR CIEGAMENTE)

1. `public.usuarios`: `INSERT/UPDATE/DELETE` denegados a anon/authenticated. `SELECT` de tabla revocado y concedidas solo columnas operativas `id,email,nombre,es_admin,terminos_aceptados,creado_en,debe_cambiar_clave`. NO accesibles para anon/auth: `clave_hash,token_recuperacion,token_expira,auth_user_id`. Sigue siendo posible leer la identidad básica del padrón sin login: **PENDIENTE P0**.
2. `public.config_segura`: removida política `ALL USING(true)`; única lectura temporal autorizada para la clave `doctrina_docencia_maestros`. Escritura anon/auth denegada. `gemini_api_key` ya NO se puede recuperar vía RLS; **pudo quedar expuesta antes**. Es obligatorio rotar/revocar la clave en Google AI Studio y verificar las cuotas. **No se realizó rotación.**
3. `public.modulos`: `INSERT/UPDATE/DELETE` anon/auth denegados; lectura sigue disponible temporalmente para usuarios legacy. Cinco trabajos activos. El editor legacy de trabajos requiere migración a nuevo Auth; no reabrir escritura por comodidad.
4. `public.registro_accesos`: `SELECT/UPDATE/DELETE` anon/auth denegados; `INSERT` anon se conserva temporalmente para registrar login antiguo. Consulta protegida mediante `maestro_admin_bitacora()`, exclusivamente SUPERADMIN (200 registros recientes). USER obtiene cero; anon sin EXECUTE.
5. Se conservan revocaciones anteriores de las siete RPC legacy de administración/cambio/recuperación. `autenticar_usuario(text,text)` sigue permitido para compatibilidad: **NO demuestra que el login sea seguro**.
6. `doctrina.auditoria_docencia`: tabla privada de eventos, sin permisos a anon/auth. `maestro_admin_editar_trabajo(uuid,text,text,text)` y `maestro_admin_actualizar_preguntas(uuid,jsonb)`: RPC nuevas, solo `authenticated` con rol SUPERADMIN obtenido de `auth.uid()` y `maestro_identidad_actual()`; validaciones de texto y preguntas, registro de auditoría. USER rechazado en pruebas de transacción. Prueba autorizada revertida: cinco trabajos y cero eventos persistidos.

Los cambios de ACL, política de configuración y nuevas RPC están registrados en historial de migraciones de Supabase. Archivo de referencia en GitHub: `docs/sql/SEGURIDAD_R6_CAMBIOS_APLICADOS_NO_REEJECUTAR.sql`.

## UI de desarrollo

- `qa/auth-roles.html`: autenticación de Gmail/Hotmail con Supabase Auth sin persistir JWT. Padrón Superadmin de solo lectura; editor piloto de título, autor, texto y ocho preguntas con confirmación, rol renovado y RPC auditadas. Nuevo resumen de bitácora con filtros Gmail/Hotmail que no borran datos.
- `tests/seguridad-qa-editor-auth.test.cjs`: regresiones de UI y ausencia de RPC legacy/HTML sin escapar.
- `app.js`: no ejecuta las siete RPC revocadas ni revive sesiones de Superadmin desde `sessionStorage`; mejoras DOM en catálogo, preguntas y muro.
- Frontend de laboratorio comparte datos con el proyecto Supabase activo. Antes de guardar desde QA, confirmar conscientemente que los cambios afectan trabajos reales.

## QA y observaciones

- PostgreSQL: comprobaciones de ACL y RLS en `usuarios`, `config_segura`, `modulos`, `registro_accesos` con resultados de acceso esperado.
- RPC Superadmin: permiso `authenticated`, anónimo sin EXECUTE; pruebas negativas con USER. Se ensayó una edición con rollback, SIN modificar datos.
- Prueba del editor de ocho preguntas con entrada HTML maliciosa pasó en simulación; falta validación real de navegador.
- Vercel mostró despliegue READY del commit `cd7066c9` en `cdocencia-seguridad-lab` (QA de editor). Verificar nuevamente antes de considerar disponible el resumen de bitácora posterior.
- Suite GitHub Actions completa: **no se afirma aprobada** sin logs/resultados verificables.

## Riesgos críticos pendientes

**P0**: `public.usuarios` expone todavía emails/nombres por acceso anónimo; `public.modulos` expone textos y posibles adjuntos; `public.progreso_maestro` y `public.comentarios_muro` mantienen políticas permisivas y operaciones directas. Migrar las 25 cuentas restantes a Supabase Auth y reemplazar lecturas/escrituras por políticas de propiedad y RPC para no interrumpir docencia.

**P0**: rotar inmediatamente la clave Gemini que estuvo almacenada en `config_segura`. NO registrar el valor en prompts, ZIP, GitHub o logs.

**P1**: habilitar administración segura de usuarios, docencia, certificados y bitácoras mediante Auth. Mantener siete RPC antiguas revocadas.

**P2**: custodiar PDF doctrinales en Storage privado tras validar derechos, versiones, huellas y permisos; elaborar correlación verificable y pruebas de calidad de respuestas.

## Restauración después de pérdida del sandbox

1. GitHub `jcpintov/cdocencia`, rama `fix/roles-enter-20261012`; anotar HEAD exacto y NO mezclar con `main`.
2. Leer R6, R5, contratos `SUPERADMIN/USER`, G0–G7 y plan RLS.
3. Verificar grants/policies por SQL de **solo lectura**. No repetir migraciones sin comparar el estado y su historial.
4. Verificar ambas identidades Auth y funciones de rol; probar que anon y USER no puedan escribir al padrón ni consultar bitácoras privadas.
5. Validar cinco módulos, 27 perfiles, tres identidades Auth, 19 documentos en cuarentena, dos sustituciones, cero PDF en Storage, cero eventos de edición reales.
6. Ejecutar `node --check app.js`, `node --check api/security/session.js` y `for file in tests/*.test.cjs; do node "$file"; done` en clon aislado.
7. Recuperar ZIP de originales `DOCTRINA_ORIGINALES_VIGENTES_LOTE01_20261012.zip` desde custodia privada y verificar SHA-256 por PDF.
8. NO reabrir DML anónimo ni publicar Doctrina/USER ni desplegar a producción antes de validar P0 y G0–G7.
