# P0 — Plan de cierre de RLS y acceso directo a tablas (v1.0)

**Fecha:** 2026-10-12 · **Proyecto:** Doctrina–Docencia OFL146  
**Estado:** planificación de corte. **NO IMPLEMENTADO sobre tablas públicas**.  
**Motivo:** el sistema conserva 27 cuentas legacy y solo dos identidades Auth enlazadas al padrón; cortar permisos en todas las tablas antes de migrar consumidores bloquearía funciones docentes.

## 1. Situación confirmada

- Las siete RPC legacy de altas/bajas/cambio/recuperación fueron **revocadas para anon y authenticated**, con verificación SQL.
- El login heredado `autenticar_usuario` permanece ejecutable por `anon`. No confiar en la sesión antigua como autorización para modificaciones.
- El esquema `public` mantiene políticas `USING(true)` y/o `WITH CHECK(true)` para `anon` y `authenticated` en `usuarios`, `modulos`, `progreso_maestro`, `comentarios_muro`, `config_segura` y `registro_accesos`. **Riesgo crítico persistente**.
- **No se ha aplicado todavía el corte RLS de esas tablas**. La herramienta bloqueó la operación intentada de restringir la escritura sobre `public.usuarios`. No suponer que se ejecutó.
- Las funciones `maestro_identidad_actual()` y `maestro_padron_superadmin()` ya están creadas, con verificación de identidades Auth y control de roles.

## 2. Perfiles y permisos objetivo

| Recurso | `anon` (futuro) | USER / Maestro Auth | SUPERADMIN Auth |
|---|---|---|---|
| `usuarios` | Sin acceso directo | Solo perfil propio mediante RPC autenticada | Padrón resumido por `maestro_padron_superadmin()`; modificaciones por API de confianza |
| `modulos` | Sin acceso a contenido protegido | Lectura de trabajos activos autorizados | Crear/editar/archivar mediante servicio auditado |
| `progreso_maestro` | Sin acceso | Propio progreso mediante identidad Auth→legacy verificada | Resumen y auditoría controlada |
| `comentarios_muro` | Sin acceso | Aportes autorizados, edición únicamente propia y según reglas docentes | Moderación mediante API auditada |
| `config_segura` | Sin acceso | Solo contenido institucional expresamente publicado vía interfaz limitada | Revisión y cambios por servicio autenticado |
| `registro_accesos` | Sin acceso | Registro de propia sesión por backend, sin consultar bitácoras | Consulta agregada o detallada mediante RPC segura |
| `doctrina.ingesta_documental` | Ninguno | Ninguno | Solo servicios de custodia y auditoría, con permiso verificado |
| Storage `doctrina-originales-privados` | Ninguno | Ninguno mientras corpus esté en cuarentena | Operaciones servidor-only tras autorización y chequeo de hash |

La ausencia de permisos por grado A/C/M es deliberada: todos los USER son Maestros. No implica acceso a documentos no aprobados ni al análisis exclusivo «Doctrina y Reglamentos».

## 3. Migración sin bloqueo de los 25 usuarios restantes

1. **Respaldar datos y contratos**: checkpoint privado; exportaciones servidor-side de tablas en formato seguro. Jamás exportar `clave_hash` o tokens a un navegador.
2. **Inventario de identidades**: 27 usuarios legacy, actualmente 3 identidades Auth y 2 vinculadas. Identificar errores de email, bajas y duplicados. No importar contraseñas antiguas.
3. **Invitación controlada de 25 USER pendientes**: desde Supabase Dashboard o un servicio seguro con Auth Admin. Permitir establecer contraseña personal y confirmar email; no habilitar registro abierto sin validación.
4. **Corte progresivo de interfaz**: usar `maestro_identidad_actual()` como único perfil; eliminar `sessionStorage.es_admin` y `p_admin_id` como autorización. El login legacy se retirará solo al pasar las pruebas.
5. **Servicios por operación**: reemplazar escritura directa de `modulos`, `progreso_maestro`, `comentarios_muro`, `config_segura`, `registro_accesos` por RLS basado en `auth.uid()` o RPC autenticadas, según caso.
6. **Cerrar permisos en transacción**: revocar `anon` lectura/escritura de `usuarios` y otras tablas reservadas; limitar `authenticated` al mínimo necesario; retirar políticas permisivas y aplicar políticas restrictivas con ownership verificado. No hacerlo sin pruebas negativas.
7. **Pruebas simultáneas**: login Gmail/Hotmail, usuario sin perfil, token caducado, peticiones directas `POST/PATCH/DELETE`, cambios de `usuario_id` o `p_admin_id`, y descarga directa Storage.
8. **Aprobación de producción**: solo al pasar controles críticos y tras resolución expresa del titular; conservar estrategia de rollback por versión.

## 4. Pruebas de aceptación de acceso

- `anon` no puede leer correos, nombres, hashes, credenciales ni registros de actividad del padrón.
- USER autenticado recibe cero filas al llamar `maestro_padron_superadmin()`; SUPERADMIN recibe las filas mínimas sin hashes ni tokens.
- USER no puede editar otra identidad aunque conozca su UUID ni alterando datos enviados en URL/JSON.
- Los formularios administrativos nunca pueden establecer `es_admin=true` ni degradar al único SUPERADMIN.
- Ningún usuario no autenticado obtiene textos, metadatos doctrinales en cuarentena o claves de referencia.
- Cada consulta de usuario y actualización autenticada queda atribuida a una identidad verificable; sin filtración de datos en logs.
- El frontend NO ofrece botón de Doctrina a USER hasta G0–G7 y decisión expresa.

## 5. Señales que NO equivalen a cierre del riesgo

- Esconder botones en JavaScript, aunque ayude a experiencia.
- Construir HTML seguro: mitiga XSS, pero no protege REST de Supabase.
- `RLS=true` con políticas `USING(true)`: sigue permitiendo acceso.
- Que la cuenta Gmail figure como Admin en el cliente: no verifica la identidad en servidor.
- El resultado verde de tests simulados sin pruebas de acceso reales con tokens Auth.

**Conclusión:** las dos funciones de identidad/padrón son infraestructura piloto útil. La vulnerabilidad central sigue abierta hasta cortar lectura y escritura directa a tablas públicas con un plan de migración y pruebas de extremo a extremo.
