# CHECKPOINT R4 — CORTE DE RPC LEGACY Y PILOTO DE AUTENTICACIÓN

**Fecha:** 2026-10-12. **Estado:** seguridad parcial aplicada, producción aún NO certificada.
**Rama de desarrollo:** `fix/roles-enter-20261012` en `jcpintov/cdocencia`. **Proyecto Supabase:** `pwnnpjygnviyzyyvfxnq`.
**Precedente:** `docs/CHECKPOINT_R3_DOCTRINA_DOCENCIA_20261012.md` (histórico; las siete RPC YA NO están abiertas).

## 1. Mandato, identidades y hechos comprobados

El titular autorizó expresamente bloquear temporalmente siete RPC legacy expuestas.
Se comprobaron dos cuentas Supabase Auth confirmadas, enlazadas por correo único al padrón:
- `jpintov@gmail.com`: `SUPERADMIN`, también presente y activo en `doctrina.superadmins`.
- `jpintov@hotmail.com`: `USER`, no presente en superadmins.
No alterar esos roles para facilitar pruebas.

**Situación al cierre de la intervención:** 3 usuarios Auth, 27 usuarios legacy, 2 correos vinculados. Los demás usuarios deberán migrar a Auth sin recopilar ni copiar contraseñas históricas.

## 2. Medidas efectivamente aplicadas en Supabase

**APLICADO Y VERIFICADO EN BASE DE DATOS:** se revocó `EXECUTE` a `PUBLIC`, `anon` y `authenticated` para las siguientes siete funciones `public`:
1. `admin_crear_usuario(uuid,text,text,text,boolean)`
2. `admin_editar_usuario(uuid,uuid,text,text,boolean)`
3. `admin_eliminar_usuario(uuid,uuid)`
4. `admin_cambiar_clave(uuid,uuid,text,boolean)`
5. `cambiar_clave_usuario(uuid,text)`
6. `solicitar_recuperacion_clave(text)`
7. `resetear_clave_con_token(text,text)`

Las cuatro funciones `admin_*` conservan `EXECUTE` **solo para el rol de servicio** como posibilidad de transición; todavía no existe un endpoint de mutación habilitado.
`autenticar_usuario(text,text)` sigue ejecutable por `anon` para no cortar súbitamente el login heredado.
**Consecuencia:** altas/bajas/cambios de usuario, claves y recuperación legacy temporalmente suspendidos.

**APLICADA nueva migración:** `maestro_identidad_verificada_unica_superadmin_user`.
La función `public.maestro_identidad_actual()` calcula perfil contra `auth.uid()` validado, email confirmado, padrón único y `doctrina.superadmins`. Revocada para `anon`; concedida solo a `authenticated`. Pruebas SQL en transacción con contexto JWT simulado:
- Auth Gmail → `SUPERADMIN` (1 fila).
- Auth Hotmail → `USER` (1 fila).
- Auth UID inexistente → 0 filas.

## 3. Código del piloto

- `api/security/session.js` verifica JWT con Supabase Auth y pide el perfil a `/rest/v1/rpc/maestro_identidad_actual`, transmitiendo el mismo token. Sin `service_role`, sin `p_admin_id`, sin contraseña en servidor.
- `tests/seguridad-sesion-servidor.test.cjs` actualizado. Ocho escenarios simulados del servidor pasaron (USER, Superadmin, identidad falsa, sesión no confirmada, fallas de DB/configuración y token inválido).
- `qa/auth-roles.html`: página de **QA**, no navegación de usuarios. Autentica directamente en Supabase Auth con la clave digitada por el titular, sin sesión persistente; muestra solo el rol validado.
- `app.js`: se eliminaron tres `select('*')` de `public.usuarios` para que los respaldos normales no incluyan hashes de contraseñas ni tokens de recuperación. El exportador comprueba el rol de forma provisional en UI (no autorización definitiva).

En Vercel `cdocencia-seguridad-lab` se configuraron variables **solo preview y rama de laboratorio**:
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Son identificadores/clave **publicable**, no secretos del servicio.
El despliegue Vercel permanece bloqueado por límite diario de construcciones; **no afirmar que estos cambios estén visibles o probados en navegador**.

## 4. Riesgo restante MUY ALTO: tablas públicas

La auditoría de políticas RLS encontró reglas `USING(true)` o `WITH CHECK(true)` para `anon` y `authenticated` en:
- `public.usuarios`: lectura completa y escritura según ACL; contiene hashes, flags admin y campos de recuperación.
- `public.modulos`, `public.progreso_maestro`, `public.comentarios_muro`, `public.config_segura` y `public.registro_accesos`: permisos de acceso amplios.
**No se ha restringido aún la escritura ni la lectura de dichas tablas.** Un intento adicional de restringir DML de `public.usuarios` no fue ejecutado porque la herramienta lo bloqueó; tampoco se alteraron RLS ni ACL de estas tablas. NO considerar segura la producción tras bloquear las siete RPC.

Acciones pendientes:
1. Preparar un corte de permisos de tablas coordinado con clientes Supabase Auth e infraestructura de respaldo.
2. Denegar acceso directo a credenciales, tokens, roles y documentos; exponer únicamente servicios con `auth.uid()`, ownership y autorización real.
3. Probar con Hotmail USER, Gmail SUPERADMIN, `anon`, tokens alterados/caducados y operaciones REST directas; verificar imposibilidad de escritura cruzada.
4. Migrar las 25 cuentas legacy restantes por invitación/activación individual antes de abandonar el login anterior.
5. Revisar las políticas de `config_segura`, módulos, progreso, bitácora y muro una por una; revocar permisos abiertos tras sustitución de endpoints.
6. No habilitar búsqueda documental USER ni carga definitiva a Storage.

## 5. Puertas de seguridad/documentales

Corpus: 19 registros doctrinales en cuarentena, 2 sustituciones auditadas, 0 objetos físicos en bucket privado, 0 versiones publicadas.
Botón `Doctrina y Reglamentos`: solo interfaz SUPERADMIN; USER no lo recibe.
Todos los USER son Maestros; las referencias A/C/M son contextos temáticos, no permisos.
Fuentes admisibles: Gran Logia de Chile oficial y literatura confiable REAA, solo tras cotejo individual.

## 6. Restauración ante pérdida del sandbox

1. Reabrir GitHub `jcpintov/cdocencia` en rama `fix/roles-enter-20261012`. Identificar commit HEAD actual antes de editar.
2. Leer este checkpoint, contratos `docs/CONTRATO_FUNCIONAL_*`, puertas de liberación G0–G7 y R3 histórico.
3. Comprobar por SQL de solo lectura que las 7 funciones siguen sin `EXECUTE` para `anon/authenticated`; NO volver a conceder acceso por conveniencia.
4. Confirmar función `public.maestro_identidad_actual()` autenticada y denegada a anónimos.
5. Comprobar env de Vercel solo en preview, protección de despliegue y proyecto exacto.
6. Probar `node --check app.js`, `node --check api/security/session.js` y `node tests/*.test.cjs` individualmente en clon con Node.js 22.
7. Recuperar 19 PDF desde el ZIP privado `DOCTRINA_ORIGINALES_VIGENTES_LOTE01_20261012.zip` y contrastar SHA-256 contra manifiesto vigente. NO subirlos a GitHub.
8. Planificar y verificar cierre de permisos de tablas ANTES de abrir backend documental o restablecer CRUD.
9. Mantener intacto `main` y `cmaestros.ofl.cl` hasta auditoría y aprobación final.

**Nunca incluir secretos, contraseñas ni tokens de usuarios en checkpoint o logs.**
