# Checkpoint UI · Docencia y Superadmin
**Fecha de revisión:** 2026-10-18 (Chile)  
**Repositorio:** `jcpintov/cdocencia`  
**Rama de trabajo:** `feat/superadmin-frontend-orden-20261018`  
**PR:** https://github.com/jcpintov/cdocencia/pull/30 (borrador, NO fusionar).  
**Base de trabajo:** `main`, commit `795aad170cbe74c8a07996e422a373de4e669a37`.

## Contrato de alcance
- Plataforma Docencia de Tercer Grado para un padrón cerrado de **26 usuarios no administrativos**.
- **Un Superadmin** como único operador administrativo; no cuenta como participante del seguimiento docente.
- La cuenta de prueba Dummy tampoco cuenta como participante.
- GitHub es la fuente versionada; Vercel despliega; Supabase hospeda datos y Auth.
- **Queda prohibido publicar a producción o fusionar el PR** sin decisión posterior expresa del propietario.
- No mezclar con Portal OFL histórico, repositorios alternativos ni programas periciales.
- **Doctrina y Reglamentos: NO COMPROBADO, sin consulta USER.** El editor de «Este Espacio» es independiente del corpus doctrinal.

## Observación de base de datos (solo lectura, 18/10/2026)
- `public.usuarios`: **28 perfiles**: 26 ordinarios, 1 Superadmin, 1 Dummy.
- **3 perfiles** con `auth_user_id` registrado (sin inferir identidad de los restantes).
- 6 trabajos, 6 registros de progreso, 3 comentarios.
- 4 áreas, 175 entradas en `unidades_docencia` y 8 asociaciones en `modulos_temas`.
- `primer_acceso_codigos`: 0 filas durante la revisión; esto no constituye validación del flujo.
- RLS habilitada en las tablas listadas, **políticas/permiso efectivo no certificados**.

## Fase A · Frontend y UI Superadmin (prioridad inmediata)
- [x] Crear rama aislada y PR en borrador.
- [x] Reorganizar visualmente las 9 secciones existentes en tres grupos de navegación sin alterar IDs.
- [x] Crear cabecera institucional, accesos rápidos y marcador visible «NO COMPROBADO» para Doctrina.
- [x] Mejorar foco de teclado/identificación de pestaña activa con `aria-current`.
- [x] Ajustar aire inferior de invitación «Este Espacio», desktop y móvil.
- [ ] Inspección visual real a 1440, 1024, 768 y 390 px.
- [ ] Revisar cabecera, navegación en móvil, tarjetas, tablas, estados vacíos, estados de carga, modales, contraste, indicadores.
- [ ] Pulir todas las pantallas internas siguiendo identidad sobria. Evitar iconografía estridente, efectos innecesarios y modal administrativo aislado.
- [ ] Ejecutar pruebas de regresión y verificar CI aprobado antes de proponer la fusión.

## Fase B · Experiencia de usuarios
- [ ] Validar primer acceso por código temporal, su expiración y contraseña personal para los 26 participantes.
- [ ] Verificar cierre de sesión, reinicio, recuperación por email y accesos con tecla Enter.
- [ ] Revisar menú lateral y retorno entre Inicio, Trabajos, Programa, Este Espacio, Muro y Mis avances.
- [ ] Confirmar descarga original en nueva pestaña, sin visor interno reinstalado.
- [ ] Probar lectura, 8 preguntas, consagración, progreso, muro y respuestas a comentarios.
- [ ] Comprobar informes PDF y accesibilidad de usuarios mayores.
- [ ] Garantizar que usuario nunca vea controles ni información administrativa.

## Fase C · Operación Superadmin, API y persistencia
- [ ] Alta, edición, activación y gestión de Auth ligadas al padrón real.
- [ ] Resolver bajas transaccionales preservando historial y referencias, antes de habilitar su control.
- [ ] Guardado seguro de trabajos, renumeración y clasificación por múltiples temas (revisar `modulos_temas`).
- [ ] Documentos originales: asociación, sustitución y descarga, con trazabilidad y límites adecuados.
- [ ] Matriz de avance y KPI sin Superadmin ni Dummy; reportes fiables.
- [ ] Bitácora filtrable y exclusión opcional de administración/pruebas.
- [ ] Muro general, moderación, exportación; cámara presencial y persistencia, según contrato.
- [ ] Revalidar políticas RLS/RPC y privilegios con pruebas reales USER/Superadmin; no reabrir funciones heredadas inseguras.

## Fase D · Doctrina (se mantiene en cuarentena)
- [ ] Inventariar originales, fuente, edición, vigencia, hash y habilitación institucional de cada documento.
- [ ] Corregir corpus, trazabilidad de respuestas y controles de acceso del Superadmin.
- [ ] Probar búsqueda, referencias exactas, alucinaciones y límites por grado, sin exponer material reservado.
- [ ] **Solo tras aprobación documental y seguridad:** considerar habilitación paulatina a usuarios.

## Compuertas de publicación
1. CI y pruebas frontend aprobadas.
2. QA E2E con cuenta USER de prueba y cuenta Superadmin, sin datos destructivos.
3. Revisión de backend y pruebas de accesos reales, secretos y límites.
4. Confirmación de que Doctrina permanece no publicada.
5. Validación explícita del usuario para fusionar/desplegar; plan de reversión preparado.

**Nota:** READY de Vercel certifica construcción/despliegue, no funcionamiento end-to-end. El proyecto puede acumular previews sin que eso autorice producción.
