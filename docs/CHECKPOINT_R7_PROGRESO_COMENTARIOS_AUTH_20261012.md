# CHECKPOINT R7 — Doctrina–Docencia: progresos y muro autenticados

**Fecha:** 2026-10-12. **Repositorio:** `jcpintov/cdocencia`. **Rama:** `fix/roles-enter-20261012`.
**Proyecto Supabase:** `pwnnpjygnviyzyyvfxnq`. **Estado:** migración parcial en laboratorio; NO publicar en producción.
**Antecedente:** `docs/CHECKPOINT_R6_SEGURIDAD_RLS_DOCENCIA_20261012.md` y contratos de roles.

## 1. Política vigente

- **SUPERADMIN único:** `jpintov@gmail.com`; **USER/Maestro piloto:** `jpintov@hotmail.com`, ambos reconocidos por Supabase Auth.
- Todos los USER son Maestros; Aprendiz y Compañero son **solo contextos temáticos**, nunca filtros de autorización.
- «Doctrina y Reglamentos» continúa **exclusivo del Superadmin**. Ningún botón ni búsqueda doctrinal para USER hasta G0–G7 y autorización final del titular.
- Se admitirá únicamente documentación oficial verificada de Gran Logia de Chile y literatura confiable pertinente al REAA.
- Corpus: 19 metadatos en cuarentena, 2 sustituciones auditadas, **0 PDF en Supabase Storage**, 0 publicaciones doctrinales.
- La integración Gemini es **obsoleta, sin uso ni requisito de nueva clave**. No reactivarla.

## 2. Seguridad ejecutada en Supabase (R7)

Adicionalmente, se limitó `UPDATE` de `public.comentarios_muro` a `contenido`, `editado`, `editado_en` y `activo`. Los clientes no pueden alterar `usuario_id`, `modulo_id`, `progreso_id`, `contenido_original`, `ip_origen`, `creado_en` ni su clave primaria. Comprobada compatibilidad con edición y ocultamiento legacy. **Aún existe riesgo de editar contenido ajeno por políticas antiguas.**

Se revocó `DELETE` directo a `PUBLIC`, `anon`, `authenticated` en:
`public.progreso_maestro` y `public.comentarios_muro`. La revocación y las lecturas/escrituras legacy conservadas se comprobaron.

Se crearon y verificaron **ocho** RPC nuevas, `EXECUTE` únicamente para `authenticated`, con `SECURITY DEFINER`, `search_path=''`, identidad derivada de `auth.uid()` y `public.maestro_identidad_actual()`, sin `usuario_id` ni correos del navegador:

1. `maestro_modulos_activos()`: catálogo reducido, solo perfiles válidos (sin contenido ni preguntas).
2. `maestro_mis_progresos()`: exclusivamente filas del usuario autenticado.
3. `maestro_marcar_lectura(uuid)`: lectura propia de módulo activo.
4. `maestro_comentarios_modulo(uuid)`: comentarios activos, disponibles solo al completar el trabajo o para SUPERADMIN; no incluye correo, IP ni huella original.
5. `maestro_publicar_comentario(uuid,text)`: identidad del autor derivada del JWT, trabajo completado, texto entre 5 y 1500 caracteres, máximo 5 publicaciones por minuto.
6. `maestro_editar_comentario_propio(uuid,text)`: solo autor, conserva `contenido_original`.
7. `maestro_registrar_evaluacion(uuid,jsonb)`: exige ocho respuestas `0..7` en `A/B/C/D`, mantiene los datos previamente consagrados.
8. `maestro_consagrar_reflexion(uuid,text)`: exige entre 15 y 200 palabras y ocho respuestas registradas, o trabajo ya completado. No cambia autor ni degrada completación.

Copia **literal de definiciones SQL y GRANT/REVOKE** de PostgreSQL:
`docs/sql/R7_FUNCIONES_AUTH_DOCENCIA_VERIFICADAS_20261012.sql`.
**Son definiciones YA APLICADAS: no ejecutarlas otra vez a ciegas.**

## 3. Pruebas realizadas en transacciones con ROLLBACK

- USER Hotmail recuperó exactamente **5 progresos propios**. SUPERADMIN Gmail recuperó 0 propios (no obtuvo los de Hotmail), e identidad inexistente recuperó 0.
- Hotmail pudo consultar un comentario de un módulo completado; un rol sin perfil no puede recuperar el catálogo.
- Crear comentario, editarlo sin sobrescribir el original y marcar lectura: correcto, con reversión.
- SUPERADMIN no puede modificar un comentario ajeno mediante la RPC de edición de autor.
- Una identidad inexistente no puede marcar lectura.
- Evaluación de ocho respuestas y consagración de reflexión: correctas dentro de transacción reversible.
- Siete respuestas: rechazadas. Reflexión inferior a 15 palabras: rechazada. Reflexión sin evaluación previa: rechazada.
- El sistema sigue con **6 filas de progreso y 3 comentarios**, y 5 trabajos activos. No se modificaron datos reales en los ensayos.
- `anon` carece de `EXECUTE` sobre las ocho RPC.
- Se verificó la sintaxis JavaScript de `app.js`, `api/security/session.js`, `qa/auth-roles.html` y pruebas nuevas. **Sin prueba real de login en navegador** todavía.

## 4. Interfaz y regresión

`qa/auth-roles.html` añade **«Mi Docencia»**:
- Cuenta autenticada: resumen de trabajos, lecturas y conclusiones personales.
- Selector de trabajos, lectura de comentarios tras completar el módulo, sin texto de otros módulos revelado.
- Marcar lectura, publicar y editar comentario propio tras confirmación expresa: los cambios son REALES en la base compartida; nunca pruebas ficticias.
- Uso exclusivo de RPC autenticadas, nodos `textContent` y `input.value`; sin `innerHTML` de usuarios, sin cookies/tokens persistidos por código de QA.
- La edición y consulta institucional SUPERADMIN continúan separadas; no hay botón doctrinal USER.

`tests/seguridad-mi-docencia-auth.test.cjs`: regresiones de la UI, autorización, reserva de comentarios y ausencia de acceso directo desde QA.
`.github/workflows/doctrina-regresion.yml`: sintaxis y tests de Node. **No se declara aprobación de GitHub Actions** sin ejecución verificable.

El último PREVIEW READY comprobado en Vercel correspondía al commit `eafa1bb521180b469d6916a768bb45a0ab8cd565`, **anterior a la pantalla nueva R7**. No presentar R7 como desplegado mientras no exista URL asociada al nuevo commit.

## 5. Riesgo P0 AÚN ABIERTO

**IMPORTANTE:** `anon` y `authenticated` conservan `SELECT/INSERT/UPDATE` sobre `progreso_maestro` y `comentarios_muro` por las políticas legacy `USING(true)` / `WITH CHECK(true)`. **No son seguras.**

No se revocaron todavía porque **25 usuarios legacy** aún no están migrados a Supabase Auth y dependen de la escritura directa para realizar sus trabajos; hacerlo ahora interrumpiría Docencia. Revocar `DELETE` reduce daño destructivo pero NO resuelve BOLA/IDOR ni acceso cruzado.

Riesgos relacionados:
- Acceso anónimo al directorio docente mínimo y a textos de trabajos en `modulos`; la migración de lecturas Auth debe completarse.
- Función de login legacy anónima `autenticar_usuario` aún invocable.
- Cuentas restantes deben migrarse de forma individual y confirmar correo. No copiar hashes/passwords legacy a Auth.
- `Gemini` es obsoleto; su registro histórico permanece en `config_segura` pero no es legible por anon/auth. No se requiere para operar.

## 6. Recuperación ante pérdida del sandbox

1. Abrir rama GitHub `fix/roles-enter-20261012`; registrar su HEAD real, **no usar `main`**.
2. Leer R7, R6, contratos `docs/CONTRATO_FUNCIONAL_SUPERADMIN_v1.md`,
   `docs/CONTRATO_FUNCIONAL_USER_MAESTRO_v1.md`, y puertas G0–G7.
3. Verificar las ocho RPC y sus grants comparándolas con
   `docs/sql/R7_FUNCIONES_AUTH_DOCENCIA_VERIFICADAS_20261012.sql`.
4. SQL de solo lectura: contar 6 progresos/3 comentarios/5 trabajos, revisar políticas
   `pg_policies` y grants de `anon`; no afirmar seguridad total.
5. Ejecutar `node --check app.js`, `node --check api/security/session.js`
   y `for f in tests/*.test.cjs; do node "$f"; done` en clon local.
6. Conservar los 19 PDF originales en ZIP privado, contrastar SHA-256 del manifiesto
   y confirmar que Storage sigue sin originales.
7. No restaurar funciones heredadas revocadas ni reabrir DELETE anónimo.
8. Siguiente prioridad: migar otros 25 USER a Supabase Auth y cortar con pruebas negativas
   `SELECT/INSERT/UPDATE` permisivos de progreso/comentarios, tras sustituir frontend.
9. Antes de habilitar Doctrina USER: corpus, integridad, correlación, respuestas,
   derechos, seguridad RLS y aprobación final Superadmin.

**Este checkpoint permite continuidad, NO certifica seguridad de producción.**
