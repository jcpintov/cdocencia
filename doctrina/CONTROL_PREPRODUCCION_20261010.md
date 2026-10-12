# Control de seguridad antes de integrar a producción

**Estado:** propuesta en rama feature. No ejecutar migraciones ni desplegar servicios sin aprobación final.

## Invariantes
1. Original en Storage privado; Docencia nunca recibe URL ni contenido.
2. Reserva de cola transaccional mediante FOR UPDATE SKIP LOCKED.
3. Extracción termina en revisión, no publicación.
4. Reserva vencida pasa a cuarentena; no reintento automático.
5. Publicación exige superadministrador activo, unidades validadas, afirmaciones aprobadas y versiones listas.
6. SQL de control de publicación guardado como propuesta, sin aplicar.

## Pendientes críticos
- Probar concurrencia con dos conexiones PostgreSQL en entorno aislado.
- Implementar worker de Storage y credenciales privadas.
- Añadir heartbeat y comprobar vigencia del arrendamiento antes de confirmar unidades.
- Probar PDF/DOCX adversariales y bombas ZIP; OCR supervisado.
- Invalidar derivados publicados ante revocación de fuentes.
- Verificar consentimiento LLM externo en cada invocación.
- Revisar separación de funciones entre autor y aprobador.
- Auditar control de publicación frente a revocaciones y cambios concurrentes.

## Criterio de salida
CI aprobado, concurrencia real, Storage privado, permisos mínimos, prueba de no filtración a Docencia y aprobación final de producción.
## Pendiente prioritario P1 — nueva interfaz Admin / Superadmin (registrado 2026-10-12)

**Encargo expreso del titular:** sustituir el aspecto heredado del panel administrativo por una interfaz profesional, moderna, elegante y funcional, evitando íconos ornamentales. La navegación de **Docencia Admin** permanece dentro de `#seccionAdmin`. El acceso a **Doctrina Superadmin** se abre mediante **un botón dentro del panel Admin**, no mediante una pestaña flotante independiente.

### Criterios de aceptación
1. Diseño editorial coherente: azul institucional, cobre moderado, tipografía jerarquizada, tarjetas, tablas legibles y disposición adaptable a móvil.
2. Botón "Gobierno Doctrina" dentro del menú lateral de Admin, visible solo tras verificación `auth.getUser` y RPC de servidor `doctrina_es_superadmin()`.
3. El botón abre un diálogo/modal accesible (Escape, foco y atributo `aria-expanded`), cerrado por defecto y sin autorizaciones deducidas del navegador.
4. Mantener secciones funcionales: visión general, autorizaciones y auditoría; ninguna función de Doctrina se ejecuta con la credencial o rol heredado de Docencia.
5. Política actual de administración individual: la única cuenta candidata es `jpintov@gmail.com`. No provisionar otros Superadmin ni ampliar privilegios sin autorización posterior y comprobación en servidor.
6. Pruebas de regresión, revisión de contraste/responsividad y validación de sesiones sin redirecciones indeseadas.
7. Desarrollo y pruebas en la rama `feature/doctrina-ingesta-v1`. Integración/despliegue operativo **solo previa aprobación final**.

### Estado
- [x] Requisito incorporado al registro de pendientes.
- [x] Diseño y estructura visual incorporados en rama de desarrollo; verificación automática satisfecha.
- [x] Botón Admin → modal Superadmin incorporado; Escape, foco, fondo modal y cierre verificados con simulador.
- [x] Pruebas automáticas de accesibilidad, aislamiento de identidad y sesión satisfactoriamente ejecutadas en GitHub Actions.
- [ ] Prueba manual en navegador con sesión real y móvil.
- [ ] Autorización operativa de cuenta única verificada en servidor.
- [ ] Aprobación del titular para publicación.

**Precaución:** ocultar acciones o restringir correos en la interfaz no constituye una política de seguridad del servidor.

### Evidencias y bloqueadores actuales (2026-10-12)
- Estilos aislados: `admin-console-v3.css`; carga verificada desde `index.html`.
- Panel Doctrina: lanzador incluido en `#seccionAdmin .admin-menu-list`; ventana modal accesible; Superadmin visible solo tras `auth.getUser` y `doctrina_es_superadmin`.
- Protección de cuenta única en interfaz: sin controles de alta, revocación o delegación de privilegios; permanece activa la consulta y auditoría autorizada.
- En Supabase, una consulta agregada de solo lectura verificó **1 Superadmin activo**, titular `jpintov@gmail.com`, **0 activos ajenos**. No modificó datos.
- La función de servidor `public.doctrina_admin_cambiar` aún permite delegación a un usuario verificado para un Superadmin autorizado. **Pendiente de restringir en el servidor**; migración borrador `doctrina/superadmin/migrations/20261012_titular_unico_NO_APLICAR.sql`, sin aplicar.
- CI de implementación y modal: <https://github.com/jcpintov/cdocencia/actions/runs/38199556535> — resultado satisfactorio.
- **Pendiente de validación manual:** experiencia visual y navegación en escritorio/móvil con cuenta institucional autenticada; comprobar que el panel real abre sin redirecciones ni nuevas solicitudes de permisos. No sustituir esta prueba por CI.
- **No autorizar producción** mientras persistan el corte de recuperación heredada de Docencia, la política de delegación del servidor o pruebas de sesión reales pendientes.

