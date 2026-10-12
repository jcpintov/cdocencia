# CHECKPOINT R3 — SEGURIDAD E INTEGRACIÓN DOCTRINA–DOCENCIA

**Fecha:** 2026-10-12 · **Rama:** `fix/roles-enter-20261012` · **Repositorio:** `jcpintov/cdocencia`  
**Último commit de seguridad anterior a este documento:** `5d4d4effa23cebc40b3abad8b731ce372006be63`  
**Estado:** desarrollo; NO merge a main; NO despliegue público; NO consulta doctrinal USER.

## 1. Contratos y reglas estables

1. `SUPERADMIN` único (titular) y `USER` todos Maestros.
2. El grado Aprendiz/Compañero/Maestro es **contexto de consulta**, no permiso de acceso.
3. Botón `Doctrina y Reglamentos` reservado a Superadmin; **nunca** crear botón doctrinal para USER sin aprobación expresa posterior a G0–G7.
4. Solo se aceptan **fuentes oficiales verificadas de la Gran Logia de Chile** o **literatura pertinente al REAA procedente de fuentes confiables**. La procedencia DECLARADA no acredita su autenticidad.
5. No habilitar consulta, indexación, LLM externo, publicación ni descarga de originales de cuarentena.
6. Los PDF originales permanecen fuera de GitHub y de Vercel; no se subieron a Storage.

Contratos completos:
- `docs/CONTRATO_FUNCIONAL_SUPERADMIN_v1.md`
- `docs/CONTRATO_FUNCIONAL_USER_MAESTRO_v1.md`
- `docs/DOCTRINA_PUERTAS_DE_LIBERACION_v1.md`

## 2. Supabase — situación confirmada

- Proyecto `pwnnpjygnviyzyyvfxnq`; bucket privado `doctrina-originales-privados`.
- `doctrina.ingesta_documental`: 19 registros, sin publicación ni autorización de uso externo, con las cuatro revisiones pendientes.
- `doctrina.ingesta_sustituciones`: dos sustituciones históricas.
- Storage privado: **0 objetos**; catálogo autorizado: **0 documentos**.
- RLS preingesta forzada; `anon` y `authenticated` sin lectura.
- `public.usuarios`: **27** cuentas tradicionales; `auth.users`: **2**, solo **1** correo vinculado entre ambos padrones.
- El Superadmin tradicional tiene correspondencia con una identidad existente en Supabase Auth, pero la migración del resto sigue incompleta.

## 3. Incidentes críticos de autenticación (P0)

**Confirmados en definiciones SQL reales:**

- `public.admin_crear_usuario`, `admin_editar_usuario`, `admin_eliminar_usuario`, `admin_cambiar_clave`: `SECURITY DEFINER` invocables por `anon`; confían en `p_admin_id` suministrado por el cliente.
- `public.cambiar_clave_usuario`: usa el identificador de usuario sin verificar la identidad solicitante.
- `public.solicitar_recuperacion_clave`: devuelve al llamante el token de recuperación de la cuenta indicada por correo, sin entrega al titular verificado.
- `public.resetear_clave_con_token`: aplica el token recibido para reemplazar contraseñas.
- En la última consulta se observaron **0 tokens de recuperación almacenados o vigentes**. Esto NO reduce el riesgo de poder solicitar uno nuevo.

**No se han revocado ni modificado estas RPC en producción** porque una revocación rompería la administración/cambio de clave/recuperación heredados. La mitigación de emergencia requiere autorización expresa e interrupción documentada.

Scripts propuestos, **NO EJECUTADOS**:
- `docs/sql/EMERGENCIA_RPC_REQUIERE_APROBACION.sql`: revocación urgente de 7 RPC tras autorización y ventana de mantenimiento.
- `docs/sql/AUTH_CUTOVER_BLOQUEADO_HASTA_MIGRACION.sql`: corte final después de migrar completamente el padrón a Supabase Auth y desplegar clientes nuevos; aborta si no se cumplen precondiciones.

## 4. Código nuevo en esta iteración

- `api/security/session.js`: endpoint GET de solo lectura, protegido por bearer token verificado con Supabase Auth, correo confirmado, correspondencia a padrón vía clave privada en servidor y coincidencia con UID único de Superadmin. Devuelve 401/403/502/503 según falla; **no modifica base de datos ni sustituye el login heredado**.
- Variables necesarias solo en Vercel/server: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPERADMIN_AUTH_USER_ID`. **No están configuradas en laboratorio** y el endpoint falla cerrado (503). Nunca incorporarlas a GitHub.
- `app.js`: trazados escapados de HTML; muro de Maestros (directo y por trabajo) con nodos de texto y listeners, editor institucional DOM sin interpolaciones peligrosas y sin error de índices al eliminar una tarjeta; respuesta de progreso de usuario obsoleta no contamina otra sesión.
- `ui-v2.css`: composición segura y responsive para los elementos de muro y reflexión.
- `.github/workflows/doctrina-regresion.yml`: pruebas Node en rama/PR, sin secretos; el verde NO constituye certificación de seguridad.
- `tests/seguridad-sesion-servidor.test.cjs`, `tests/seguridad-muro.test.cjs`: nuevas pruebas.

## 5. Verificaciones efectuadas

- Análisis de definiciones SQL: confirmado problema de autenticación y recuperación.
- 8 escenarios simulados del endpoint (401, 403, 502, 503, USER, SUPERADMIN, token inválido, etc.) superados tras simular `URL`, `fetch` y la base.
- `new Function` validó sintaxis de `app.js`, API y scripts de prueba consultados.
- Comprobaciones estáticas: no `innerHTML` interpolado en los nuevos muros ni editor; no nuevo botón doctrinal USER.
- **No se ha ejecutado aún la suite completa Node en GitHub Actions ni un test de navegador**. No confundir las verificaciones estáticas/simuladas con certificación.

## 6. Recuperación exacta

1. Clonar `jcpintov/cdocencia` y cambiar a `fix/roles-enter-20261012`; registrar `git rev-parse HEAD`.
2. Leer este checkpoint, `docs/CHECKPOINT_SEGURIDAD_DOCTRINA_DOCENCIA_20261012.md` y los contratos.
3. Restaurar originales únicamente del archivo privado `DOCTRINA_ORIGINALES_VIGENTES_LOTE01_20261012.zip` (19 PDFs, 1.536 páginas) y contrastar con `DOCTRINA_manifest_VIGENTE_20261012.json`.
4. Ejecutar `node --check app.js`, `node --check api/security/session.js` y `for file in tests/*.test.cjs; do node "$file"; done`.
5. Verificar desde Supabase **en modo lectura**: 19 preingestas, 2 sustituciones, 0 objetos, RLS forzada, 7 RPC inseguras aún accesibles por anon (hasta que se apruebe mitigación).
6. Evaluar autorización de emergencia: interrupción admin/recuperación vs riesgo de mantener RPC inseguras; no accionar sin resolución explícita.
7. Solo después de P0 configurar secretos server-only y migrar usuarios a Supabase Auth.
8. No usar credenciales de servicio en navegador ni publicar originales bajo ningún mecanismo.
9. No desplegar producción ni fusionar con main antes de cumplir G0–G7.

## 7. Pendientes, prioridad

| Prioridad | Acción | Restricción |
|---|---|---|
| P0 crítica | Aprobación de mitigación urgente y corte de RPC expuestas | Requiere decisión explícita por impacto |
| P0 | Plan de migración de los 27 usuarios a Auth (sin contraseñas en texto) | Garantizar acceso y recuperación |
| P1 | Activar/validar endpoint servidor en entorno **aislado** con env secrets | Sin exposición de service role |
| P1 | Migrar flujos CRUD y cambio/recuperación a backend autenticado | Luego revocar RPC antiguas |
| P2 | Corregir otras interpolaciones HTML restantes del código docente | Auditoría completa de UI |
| P2 | Custodia Storage privado con huellas y bitácora | Bloqueado por P0 |
| P3 | Documentos, derechos, correlación y respuestas | 100% revisión con evidencia |
| P4 | Eventual acceso doctrinal USER | Bloqueado por G0–G7 |

**Este checkpoint preserva estado, no certifica seguridad. Sin aprobación expresa NO alterar producción.**
