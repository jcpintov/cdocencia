# CHECKPOINT DE SEGURIDAD — DOCTRINA–DOCENCIA

**Fecha:** 2026-10-12 (Chile). **Checkpoint:** `OFL-DOC-SEC-20261012-R1`.  
**Repositorio:** `jcpintov/cdocencia`. **Rama:** `fix/roles-enter-20261012`. **Commit de base verificado:** `b42fb76e90b1026ebdf427ef6e27bcb201670003`. **Código y pruebas posteriores incluidos hasta:** `63fe1de2576e3180a2bfae01d4753d999245e383`.  
**No usar `main` como fuente de esta versión ni desplegar a producción.**

## 1. Mandato y arquitectura

- Dos roles: `SUPERADMIN` (único administrador actual) y `USER` (todos Maestros).
- **Exclusivo SUPERADMIN**: botón «Doctrina y Reglamentos» para análisis normativo; «Recepción documental» para preingesta local segura. No botón ni API de consultas doctrinales para USER hasta las ocho puertas G0–G7 cerradas con aprobación expresa.
- El grado A/C/M es **contexto semántico**, no requisito de visibilidad ni permiso.
- Corpus admisible: documentación **oficial verificada de Gran Logia de Chile** y literatura **REAA con autor, edición, procedencia y confiabilidad contrastadas**. Lo declarado por operador permanece pendiente hasta revisión individual.
- Preservar siempre originales, sustituciones, hashes, procedencia, derechos y auditoría. No activar LLM externo por lote.
- Todos los documentos en cuarentena, sin habilitación de publicación ni respuestas doctrinales.

## 2. Infraestructura

| Elemento | Identificación |
|---|---|
| GitHub | `jcpintov/cdocencia` |
| Rama de laboratorio | `fix/roles-enter-20261012` |
| Proyecto Supabase existente | `pwnnpjygnviyzyyvfxnq` (proyecto `cmaestros-docencia`) |
| Bucket Storage privado | `doctrina-originales-privados` — `public=false`, sin objetos |
| Proyecto Vercel laboratorio | `cdocencia-seguridad-lab`, `prj_94ftLBOnpABVXxj6MN4jMVKqSuzY` |
| Vercel producción | `cdocencia`; dominio público `cmaestros.ofl.cl` — **NO TOCAR** |
| Despliegue de laboratorio | último READY comprobado previo a estos cambios: commit `bb305f35`, NO contiene la nueva ficha de procedencia |
| Claves/tokens | No incluidos ni requeridos para recuperar este checkpoint |

**Importante:** laboratorio y producción aún pueden compartir el mismo Supabase. No tratar el laboratorio como entorno de datos aislado.

## 3. Estado verificado de Supabase

- `doctrina.ingesta_documental`: **19 registros**, fuente todavía pendiente de identificación/verificación oficial, cuatro revisiones **pendientes**, `grado_propuesto='M'` para 19, `contexto_grado` informativo.
- `doctrina.ingesta_sustituciones`: **2 registros** (Constitución revisada y Libro del Maestro).
- `doctrina.documentos`: **0**; `doctrina.versiones`: **0**; objetos `storage.objects` en bucket privado: **0**.
- RLS de preingesta habilitada y forzada; `anon` y `authenticated` sin permiso SELECT; sin policies abiertas.
- Migración `doctrina_politica_fuentes_reaa_cuarentena_con_gates_20261012` aplicada: columnas para procedencia, autor, institución, referencia, derechos, evidencia y revisiones; CHECK impide `publicacion_autorizada=true` y `autorizacion_procesamiento_externo=true` en la tabla de cuarentena.
- El inventario vigente tiene **19 documentos y 1.536 páginas**; el ZIP de originales vigente se conserva fuera de Supabase y debe guardarse adicionalmente por el titular.

## 4. Hallazgos de seguridad BLOQUEANTES

- Cuatro RPC administrativas `public.admin_crear_usuario`, `admin_editar_usuario`, `admin_eliminar_usuario`, `admin_cambiar_clave` siguen siendo `SECURITY DEFINER` invocables por `anon`; requiere revisión/mitigación en servidor. **No se afirma explotación comprobada, pero su exposición es incompatible con certificación.**
- El login actual es personalizado, mantiene estado `es_admin` y `usuarioActual` en `sessionStorage` y pasa `p_admin_id` desde cliente. El guard JavaScript de la consola solo es **visual**, NO autorización de servidor.
- Los originales PDF todavía no están subidos; no se ha probado integridad de objetos, descargas privadas ni RLS end-to-end.
- Búsqueda PDF de «Doctrina y Reglamentos» solo trabaja con ficheros locales seleccionados por SUPERADMIN. Es coincidencia textual, **no RAG, no interpretación ni respuesta validada**.
- Sin aprobación final de G0–G7, ningún acceso doctrinal nuevo para USER.

## 5. Código entregado en rama

- `index.html`: consola Superadmin, recepción documental con formulario de fuente oficial/REAA, «Doctrina y Reglamentos», bitácora de cuentas ocultables y portada ejecutiva.
- `app.js`: preingesta PDF local: metadatos obligatorios, cabecera `%PDF-`, SHA-256, duplicados, cuarentena; clasificación contextual por grado sin permisos A/C/M; limpiar sesión, protección frontend de Superadmin; padrón construido con nodos DOM y listeners (evita XSS por nombres/correos).
- `ui-v2.css`: interfaz Superadmin, indicadores, formulario de fuentes y buscador local responsive.
- `scripts/validar-manifiesto-doctrina.cjs`: validador sin red de cuarentena y condiciones de admisión.
- `tests/doctrina-politica.test.cjs`, `tests/doctrina-manifiesto.test.cjs`, `tests/doctrina-ingesta.test.cjs`: regresión de política, manifiestos y carga local.
- `tests/seguridad-padron.test.cjs` y `tests/seguridad-credenciales.test.cjs`: detección de inyección HTML, conservación de permisos SUPERADMIN, criptografía de contraseñas y privacidad del portapapeles.
- `app.js`: generación de contraseñas de 16 caracteres con `crypto.getRandomValues`, sin `Math.random`; nunca mostrar la contraseña en una alerta. Protección del exportador doctrinal y limpieza de originales/manifest al cerrar sesión.
- `docs/CONTRATO_FUNCIONAL_SUPERADMIN_v1.md`, `docs/CONTRATO_FUNCIONAL_USER_MAESTRO_v1.md` y `docs/DOCTRINA_PUERTAS_DE_LIBERACION_v1.md` son la referencia contractual.
- `docs/DOCTRINA_INGESTA_SEGURA.md` y `docs/DOCTRINA_POLITICA_MAESTROS_20261012.md` documentan la historia y el alcance.

## 6. Recuperación ante pérdida de sandbox

1. Descargar/clonar `jcpintov/cdocencia` y cambiar a `fix/roles-enter-20261012`; usar **SHA de commit**, nunca asumir que `main` contiene estos cambios.
2. Revisar estos contratos, gates G0–G7 y el presente checkpoint; **no ejecutar migraciones de nuevo sin verificar primero `information_schema` y la tabla `supabase_migrations.schema_migrations`**.
3. Restaurar los originales desde el archivo del titular `DOCTRINA_ORIGINALES_VIGENTES_LOTE01_20261012.zip`, verificar 19 archivos y SHA-256 del manifiesto vigente. Si falta, solicitar el archivo; no reconstruir contenido desde hashes.
4. Ejecutar SQL de **solo lectura** para contar los 19 registros y confirmar cuarentena, RLS, 2 sustituciones y Storage=0; no alterar bitácoras.
5. Ejecutar `node tests/doctrina-politica.test.cjs`, `node tests/doctrina-manifiesto.test.cjs`, `node tests/doctrina-ingesta.test.cjs`, `node tests/seguridad-padron.test.cjs` y `node tests/seguridad-credenciales.test.cjs` en copia local de la rama; resolver fallos antes de desplegar.
6. Iniciar nuevo trabajo por autenticación servidor/seguridad RPC, no por publicar contenido o añadir botón USER.
7. Confirmar Vercel/team/project/branch exactos antes de la vista previa; **no usar `--prod` ni promover despliegues**.
8. **Nunca** incluir claves Supabase, contraseñas, tokens, archivos reservados en GitHub o despliegues públicos.

## 7. Prioridades de trabajo restante

**P0:** mitigar RPC anon + migrar autorización del servidor, validar Storage privado y acceso negativo.  
**P1:** interfaz y backend de ingestión física solo Superadmin con estados de revisión, hash del objeto, evidencia de procedencia y logs.  
**P2:** corpus validado, OCR de escaneados autorizado, correlación fuente-página-versión-vigencia y pruebas de respuestas con rechazo de invenciones.  
**P3:** QA de USER/Maestro, pruebas de fuga con manipulación de sesión y autorización explícita.  
**P4:** solo tras G0–G7, considerar UX de consulta USER. No habilitar botón por automatismo.

**El checkpoint es una fotografía de trabajo, no certificación de seguridad o autorización de producción.**
