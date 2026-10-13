# CHECKPOINT R8 — Lectura docente mínima y diagnóstico de migración

**Fecha:** 2026-10-12 (Chile). **Repositorio:** `jcpintov/cdocencia`. **Rama de laboratorio:** `fix/roles-enter-20261012`.  
**Proyecto Supabase compartido:** `pwnnpjygnviyzyyvfxnq`. **No se ha autorizado despliegue de producción.**  
**Precedente obligatorio:** `docs/CHECKPOINT_R7_PROGRESO_COMENTARIOS_AUTH_20261012.md` y sus adendas R7.1/R7.2.

## 1. Política vigente sin modificaciones

- `jpintov@gmail.com` = único **SUPERADMIN**; solo administración, supervisión, revisión y auditoría. NO cursa Docencia como alumno.
- `jpintov@hotmail.com` = **USER/Maestro** piloto autenticado. Los restantes USER también serán Maestros.
- Los grados A/C/M se usan solo para contexto semántico; no para controlar permisos.
- **«Doctrina y Reglamentos» es exclusivo de Superadmin**. Ningún botón de Doctrina para USER hasta superar G0–G7 y aprobación expresa.
- Solo se aceptará documentación oficial contrastada de Gran Logia de Chile y literatura confiable REAA. Ninguna pieza del corpus doctrinal está publicada ni subida a Storage.
- Las siete RPC legacy de creación/edición/borrado usuarios, cambio y recuperación de clave continúan revocadas para `anon` y `authenticated`.
- No reactivar la integración Gemini obsoleta ni incluir claves en GitHub.

## 2. Cambio aplicado R8.1: módulo docente sin soluciones

Migración aplicada: `r8_docencia_trabajo_estudio_user_sin_claves_respuestas`.  
Nueva RPC: `public.maestro_trabajo_estudio(p_modulo_id uuid)`, `STABLE SECURITY DEFINER`, `search_path=''`, autorización basada en `auth.uid()` + `public.maestro_identidad_actual()`, rol **USER únicamente** y trabajo activo.

Devuelve únicamente:
- `modulo_id`, `numero_orden`, `titulo`, `autor`, `contenido_trazado`;
- `preguntas[]` con número, enunciado y opciones reducidas a letra y texto.

**No devuelve:** `respuesta_correcta`, `retroalimentacion`, respuestas de evaluación, `archivo_pdf_base64`, objetos Storage, emails ni datos de otros usuarios. `anon` NO tiene EXECUTE.

Pruebas PostgreSQL con rol autenticado y JWT simulado:
- Hotmail USER: 5 trabajos activos accesibles, los 5 con 8 preguntas y **0 referencias internas a soluciones**.
- Gmail SUPERADMIN: 0 filas; identidad inexistente: 0 filas.
- No se modificaron trabajos ni avances.

**UI de laboratorio:** `qa/auth-roles.html` incluye botón «Leer trabajo y preguntas, sin soluciones», exclusivamente en «Mi Docencia» de USER. Texto renderizado con `textContent`, sin interpolación de HTML. Limpia vista al cambiar trabajo/sesión.

**Recuperación SQL:** `docs/sql/R8_TRABAJO_ESTUDIO_USER_APLICADA_20261012.sql` (copia de función vigente y permisos, NO ejecutar a ciegas).  
**Prueba Node:** `tests/seguridad-trabajo-estudio-r8.test.cjs`.

## 3. Cambio aplicado R8.2: estado agregado de migración

Migración aplicada: `r8_superadmin_resumen_migracion_auth_solo_lectura`.  
Nueva RPC: `public.maestro_admin_estado_migracion()`, `STABLE SECURITY DEFINER`, `search_path=''`; solo una identidad Auth realmente vinculada a **SUPERADMIN** obtiene una fila.

Devuelve solo indicadores agregados: padrón legacy, total Auth, confirmados vinculados, pendientes, superadmins confirmados y correos duplicados. Ninguna lista, correo, contraseña, hash ni token.

Pruebas SQL:
- Gmail SUPERADMIN: **27 perfiles, 25 pendientes, 0 duplicados**.
- Hotmail USER: 0 filas; UID sin perfil: 0 filas.
- `anon` sin EXECUTE; `authenticated` con EXECUTE pero resultados filtrados por rol validado.

UI `qa/auth-roles.html`: botón «Estado de migración a Supabase Auth» dentro del panel exclusivo de Superadmin; cifras textuales sin información personal y limpieza de datos al cerrar sesión.

**Recuperación SQL:** `docs/sql/R8_ESTADO_MIGRACION_AUTH_SOLO_SUPERADMIN_APLICADA.sql`.  
**Prueba Node:** `tests/seguridad-migracion-r8.test.cjs`.

## 4. Estado comprobado de datos

- Padrón legacy: **27**; Supabase Auth: **3**, 2 usuarios vinculados y confirmados, 25 pendientes de migrar.
- Docencia: **5 módulos activos**, **6 registros de progreso**, **3 comentarios**.
- Corpus doctrinal: **19 metadatos en cuarentena**, **2 sustituciones**, **0 PDF en Storage**.
- Supabase `public.usuarios` tiene tabla SELECT total revocada, pero **mantiene SELECT por columna** (nombre, email, rol, id y algunos datos operativos) accesible por `anon/authenticated`. Hashes y tokens no están expuestos por esas concesiones.
- `progreso_maestro` y `comentarios_muro` siguen con RLS abiertas para varias operaciones, incluyendo lectura y modificación cruzada entre cuentas legacy. **RIESGO CRÍTICO sin resolver**.
- `modulos` aún es legible por usuarios legacy, incluyendo campos que deberán protegerse tras migrar frontend.
- La existencia de nuevas RPC seguras no suprime las rutas legacy: NO declarar protección completa.

## 5. Despliegue y pruebas

Vercel laboratorio `cdocencia-seguridad-lab` confirmó READY para el commit `46a7a4002dfb3d5235848acbf0371d16951ed3ac`, que incluye el botón de lectura del trabajo; la pantalla del resumen agregado es posterior y debe desplegarse y comprobarse por separado. Producción `cmaestros.ofl.cl` no fue alterada por los commits R8.

Los tests de SQL descritos se realizaron **simulando** el contexto JWT desde conexiones privilegiadas con transacciones `ROLLBACK`; no equivalen a una prueba real de navegador. Los scripts Node se incorporaron a GitHub; no afirmar GitHub Actions verde sin logs.

## 6. Recuperación inmediata

1. Clonar `jcpintov/cdocencia` rama `fix/roles-enter-20261012`, registrar SHA actual y comparar con este checkpoint.
2. Leer contratos, G0–G7 y checkpoint R7. No mezclar las reglas de participación de SUPERADMIN.
3. Verificar existencia, definición y grants de `maestro_trabajo_estudio(uuid)` y `maestro_admin_estado_migracion()`. **No aplicar otra vez** sus SQL sin comprobar estado.
4. Ejecutar QA `node --check app.js` y `for f in tests/*.test.cjs; do node "$f"; done` en clon limpio con Node.js 22.
5. Confirmar que no existe opción de Doctrina para USER, no se accede a originales en Storage, ni se reabrieron RPC legacy.
6. Recuperar los 19 originales PDF solo del respaldo privado `DOCTRINA_ORIGINALES_VIGENTES_LOTE01_20261012.zip`; verificar los SHA256 del manifiesto.
7. Mantener restricciones por autorización de contenido, **no por grado**, con Superadmin único.
8. Siguiente P0: cerrar exposición de columnas de `usuarios` y acceso directo a `modulos`, `progreso_maestro`, `comentarios_muro` tras migrar clientes restantes a Auth.
9. No fusionar con `main`, no publicar producción ni abrir Doctrina/USER sin control final y decisión expresa.

**Estado:** funciones nuevas aplicadas, conservación verificada, publicación aún bloqueada.
