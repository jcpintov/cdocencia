# CHECKPOINT R11 — NUEVA ENTRADA SUPABASE AUTH Y ENDURECIMIENTO WEB

**Fecha:** 2026-10-13. **Estado:** código en GitHub de laboratorio; SQL de producción mantenido sin cambios en esta fase. **NO certificado E2E**.  
**Repositorio y rama:** `jcpintov/cdocencia` · `fix/roles-enter-20261012`.  
**Supabase compartido:** `pwnnpjygnviyzyyvfxnq`. **Producción:** `cmaestros.ofl.cl`, sin nuevos cambios de frontend.

## 1. Mandatos de seguridad que NO pueden relajarse

- Únicamente dos roles: **SUPERADMIN** (solo `jpintov@gmail.com`) y **USER** (todos Maestros; cuenta piloto `jpintov@hotmail.com`). No implementar autorización por grado simbólico A/C/M.
- Privilegios derivados exclusivamente del token Supabase Auth, vínculo UUID `public.usuarios.auth_user_id=auth.uid()` confirmado y `doctrina.superadmins` activo en el caso SUPERADMIN.
- **Doctrina y Reglamentos**: solo Superadmin; **USER no recibe botón, RPC ni corpus doctrinal** antes de aprobación formal G0–G7.
- Los 19 PDF originales (fuentes Gran Logia de Chile o literatura confiable REAA pendiente de revisión) permanecen en custodia privada, fuera de GitHub, Vercel y Supabase Storage; NO enviar a LLM externos sin autorización individual.
- R9 cerró ACL/RLS de las seis tablas públicas: `usuarios`, `modulos`, `progreso_maestro`, `comentarios_muro`, `registro_accesos`, `config_segura`. Nunca dar `GRANT` directo a `anon` o `authenticated` para simular funcionamiento.
- R10 revocó `autenticar_usuario(text,text)` a roles `PUBLIC,anon,authenticated`, conservando EXECUTE a `service_role` solo para recuperación administrativa; no reactivar como alternativa de login.
- El Superadmin supervisa/administra, pero NO puede cursar trabajos, marcar lectura ni comentar como alumno.

## 2. Código R11 efectivamente creado en la rama

**Puerta de entrada:** `index.html` eliminó el formulario de contraseña legacy y añadió la entrada **«Ingresar con Supabase Auth»**, enlazada a `./acceso-seguro.html`. Los IDs de inputs heredados permanecen únicamente ocultos y deshabilitados por compatibilidad con otros scripts. En `app.js`, el handler `iniciarSesion` permanece sin llamada a RPC antigua y limpia la contraseña si alguien lo invoca.

**Nueva aplicación candidata `acceso-seguro.html`**:
- Deriva del laboratorio `qa/auth-roles.html` y ofrece paneles separados de USER y SUPERADMIN.
- Introduce correo electrónico libre, no una lista fija de correos de prueba. **El dominio del correo jamás determina el rol**. El servidor devuelve el perfil a partir de token verificado y vínculo UUID; se permite el acceso únicamente si existe identidad autorizada.
- La contraseña se envía a Supabase Auth; NO al servidor Vercel. `persistSession:false`, `autoRefreshToken:false`, `detectSessionInUrl:false`; sin JWT persistidos en almacenamiento local. El navegador conserva sesión solo mientras la página viva y deberá iniciar de nuevo tras expirar.
- El endpoint `/api/security/session` verifica el token con Supabase Auth y contrasta la identidad con `public.maestro_identidad_actual()`, sin `service_role` en la página.
- `maestro_registrar_ingreso_auth()` se solicita después del perfil validado. Si falla la autorización o el registro, se cierra la sesión sin mostrar contenido.
- Las operaciones docentes y administrativas usan RPC protegidas. No existen `.from('usuarios'/'modulos'/...)` directas en la nueva aplicación.
- NO hay código HTML interpolado con datos del usuario; se usan `textContent` y DOM.
- Se limpian las contraseñas tras autenticación, cuenta mal formada o indisponibilidad de la librería.
- **Las acciones de edición/comentarios del panel de Auth pueden escribir datos reales**, con la confirmación prevista en el código; el entorno de laboratorio comparte Supabase. No efectuar pruebas destructivas sin autorización y control previo.

**Endurecimiento CSP y archivos separables**:
- `acceso-seguro.js`: lógica Auth y RPC en archivo externo.
- `acceso-seguro.css`: estilos en archivo externo.
- `acceso-seguro.html`: sin `<script>` ni `<style>` inline; importa la librería Supabase JS de versión fija por URL.
- `vercel.json`: CSP con `default-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `object-src 'none'`, orígenes de JS y conexión restringidos; `Cache-Control: private, no-store`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` y `Permissions-Policy` para la puerta de Auth y API.
- **Limitación actual:** los estilos por atributo requieren `style-src 'unsafe-inline'` para compatibilidad. La librería de Auth procede de CDN fijada por versión, aún no autoalojada ni protegida con hash SRI. Revisar ambas dependencias antes de certificación final.

## 3. Pruebas efectuadas, alcance estricto

- `new Function(acceso-seguro.js)`: sintaxis válida.
- Chequeos estáticos: HTML referencia JS y CSS separados, sin scripts o bloques de estilo inline; no se deducen privilegios del dominio email; ninguna llamada `.from()` a tablas protegidas; CSP y cabeceras anti-frame/no-store presentes.
- Se ejecutaron **6 escenarios simulados** del archivo JS actual en memoria con DOM, Supabase Auth y HTTP falsos:
  1. Gmail → SUPERADMIN y auditoría.
  2. Hotmail → USER y auditoría.
  3. Correo de tercer dominio → USER solo con rol simulado válido.
  4. Sesión sin vínculo (HTTP 403) → denegación, limpieza y signout.
  5. Fallo de RPC auditoría → denegación y signout.
  6. Correo mal formado → ni siquiera se llama a Auth; contraseña limpia.
  **Resultado: 6/6 PASS en simulación; no prueba una sesión real.**
- Añadido `tests/seguridad-acceso-r11.test.cjs` (Node sin dependencias externas) a la suite existente. La suite Node integral NO está verificada como exitosa en GitHub Actions; no usar el estado Vercel como sustituto.

## 4. Bloqueo externo actual de despliegue

- Vercel publicó una preview `READY` del commit `be9220b986dcb1029b520cbba3856f8c99442e33`, con **el primer archivo `acceso-seguro.html` antes de separar JS/CSS y aplicar CSP**.
- Commits R11 posteriores (JS/CSS externalizados, `vercel.json` y test) figuran con checks de Vercel fallidos por **build-rate-limit** tanto en `cdocencia-seguridad-lab` como en el otro proyecto vinculado `cdocencia`.
- **No afirmar que la última versión hardened está desplegada.** No intentar eludir el límite con facturación, planes, duplicar proyectos o alterar producción sin autorización.
- El HTTP real del preview tampoco pudo verificarse mediante el explorador externo (acceso denegado); solo se confirmó `READY` en control Vercel.
- Próximo paso al recuperar cuota: desplegar la rama de laboratorio, verificar SHA HEAD, validar que `/acceso-seguro.html`, `/acceso-seguro.js`, `/acceso-seguro.css`, `/api/security/session` sirvan con CSP correcta, y probar ambas cuentas con credenciales EN EL NAVEGADOR, nunca en el chat.

## 5. Auditoría Supabase tras R11 (solo lectura, NO se alteró producción)

- 27 perfiles legacy, 2 perfiles asociados a Auth, 1 único Superadmin.
- 5 trabajos activos, 6 progresos, 3 comentarios.
- 19 registros doctrinales en cuarentena; 0 originales en Storage.
- `autenticar_usuario` sigue sin EXECUTE para `anon`.
- Avisos linter: 24 INFO RLS habilitado sin policy (denegación intencional), 21 WARN funciones SECURITY DEFINER accesibles por `authenticated` con controles que requieren auditoría, 1 WARN protección de contraseñas filtradas.
- **No concluir certificación integral.** Quedan pruebas de navegador y validación de migración de 25 Maestros.

## 6. Prioridades siguientes, proporcionales a seguridad

**P0 operativo:** recuperar QA R11 con el build limit levantado y comprobar Gmail/Superadmin y Hotmail/USER en navegador con sesiones reales. No redirigir el dominio público hasta validar permisos negativos, escritura legítima y bitácora.
**P0 de continuidad:** habilitar inicio Auth y paneles únicamente después de prueba real; adaptar interfaz heredada restante o reemplazarla por panel funcional Auth. No reabrir RPC antiguas.
**P1:** preparar invitación y activación supervisada de 25 Maestros sin copiar hashes ni conceder acceso por correo. Invitación no equivale a asociación UUID.
**P1:** autoalojar o fijar con SRI la biblioteca Supabase JS; eliminar estilos inline para CSP aún más restrictiva.
**P1:** revisar las 21 funciones autenticadas, fortalecer la política de contraseña según capacidades del plan y evaluar segundo factor para Superadmin.
**P2 documental:** procedencia, derechos, cuarentena, correlación y calidad de respuestas, con G0–G7. El botón Doctrina permanece solo Superadmin.

## 7. Recuperación

1. `git clone` el repositorio en la rama citada y registrar SHA HEAD.
2. Leer R9.1, R10 y R11; contratos Superadmin/USER; SQL de diagnóstico solo lectura.
3. Confirmar por SQL que `anon` y `authenticated` carecen de privilegios directos en las seis tablas, y que `autenticar_usuario` permanece cerrado.
4. Ejecutar `node --check app.js`, `node --check acceso-seguro.js`, `node --check api/security/session.js`; ejecutar individualmente `tests/*.test.cjs`.
5. No desplegar producción automáticamente ni promover el preview antes de aprobación.
6. Recuperar el respaldo privado de 19 PDF y contrastar su hash contra manifiesto. Nunca adjuntar documentos reservados al repositorio Git.
7. Verificar permisos reales con una sesión Auth nueva y otra cuenta USER; no confiar en flags locales `es_admin`.

**Conclusión:** nueva puerta/Auth con endurecimiento técnico y seis simulaciones positivas; compilación final y evaluación con credenciales reales PENDIENTES.
