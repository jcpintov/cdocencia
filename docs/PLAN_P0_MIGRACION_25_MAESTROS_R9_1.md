# P0 — Plan operativo para migrar los 25 Maestros restantes a Supabase Auth

**Fecha:** 2026-10-13. **Estado:** ejecución pendiente de piloto y confirmación de invitaciones, **ninguna invitación enviada** en esta fase.  
**Referencia:** `docs/CHECKPOINT_R9_CIERRE_P0_TABLAS_Y_AUTH_20261013.md` (adenda R9.1).

## Política inflexible

- Un único SUPERADMIN, identificado por Auth y UUID validado, gestiona la invitación. Los nuevos USER son siempre **Maestros**; no existe rol por grado A/C/M.
- Para USER, la condición necesaria es `public.usuarios.auth_user_id=auth.uid()` junto a `auth.users.email_confirmed_at`, correo concordante y `public.usuarios.es_admin=false`. **La coincidencia de correo sin UUID no concede acceso**.
- Ningún USER recibe «Doctrina y Reglamentos» ni corpus reservado.
- Prohibido copiar, convertir, enviar o exponer los `clave_hash` del login antiguo. Las claves son nuevas y personales en Supabase Auth.
- Mantener `public.usuarios`, `public.modulos`, `public.progreso_maestro`, `public.comentarios_muro`, `public.registro_accesos`, `public.config_segura` sin acceso directo para roles cliente. Nunca reactivar policies `USING(true)`.
- El flujo de invitación requiere identidad Superadmin autenticada y autorización por usuario. No activar inscripción pública sin validación institucional.

## Estado de partida comprobado

| Métrica | Total |
|---|---:|
| Perfiles tradicionales | 27 |
| Supabase Auth registrados | 3 |
| Perfiles asociados por UUID y confirmados | 2 |
| Perfiles pendientes de asociación | 25 |
| Superadmins activos | 1 |
| Emails duplicados en padrón | 0 |

## Puertas antes de enviar un primer correo

1. **Prueba real de QA**: Gmail y Hotmail acceden con credenciales Auth propias; ningún token se pega en el chat. Confirmar lectura de perfil, trabajos y progresos con el backend seguro y denegación de rutas directas.
2. **Validación de correos**: Superadmin coteja los 25 correos del padrón con información institucional actual, confirma bajas y consentimiento de contacto. No exportar emails a archivos públicos.
3. **URL de invitación y experiencia inicial**: comprobar `Site URL`, allowlist de redirect y página de aceptación Auth; configurar expiración y SMTP antes de invitar. Evitar enlaces a una interfaz legacy que no funciona con Auth.
4. **Trazabilidad**: el servidor registra solicitante, destinatario UUID tradicional, fecha, estado de invitación y resultado. Ningún otro USER puede ver la lista ni enviar invitaciones.
5. **Envío piloto**: seleccionar de 1 a 3 Maestros que hayan sido informados; confirmar explícitamente cada invitación. No hacer envíos masivos invisibles.
6. **Activación estable**: después de la confirmación del correo, servicio exclusivamente administrativo valida `auth.users.id`, correo, perfil tradicional único no administrativo y ausencia de vínculo con otro UUID; entonces registra **una vez** `public.usuarios.auth_user_id`. Auditoría obligatoria.
7. **Pruebas de perfil**: recién después de la vinculación, `maestro_identidad_actual()` retorna USER y `maestro_mis_progresos()` retorna solo sus propias filas. Antes de la vinculación devuelve cero.
8. **Cohortes**: expandir en lotes pequeños con fecha, lista controlada, tasas de entrega y confirmación, errores y soporte. Registrar cuentas no activadas sin penalizar al usuario.
9. **Corte final**: una vez migrados los perfiles autorizados, deshabilitar `autenticar_usuario` heredado, comprobar ausencia de accesos `anon` `SECURITY DEFINER` y retirar la interfaz de inicio de sesión antigua.

## Reglas técnicas del servicio de invitación aún pendiente

- Servidor de confianza (Supabase Auth Admin API o Dashboard), clave secreta **nunca en navegador, repositorio ni checkpoint**.
- Recibe solamente **UUID del perfil tradicional**; correo objetivo siempre se recupera del padrón con identidad Superadmin verificada.
- Estado inicial **deshabilitado por configuración**. Cada envío requiere un clic de confirmación y control de frecuencia. Prohibido invitar al SUPERADMIN como USER o alterar sus privilegios.
- Verificar que el perfil objetivo existe, es USER, no tiene `auth_user_id` vigente, no está de baja y su correo es institucionalmente confirmado.
- No confundir `inviteUserByEmail()` con la activación institucional: la invitación puede crear un usuario Auth pendiente; solo la confirmación y asociación por UUID habilitan funciones.
- No enviar invitaciones a los 25 hasta que el titular autorice expresamente la campaña. Mantener un procedimiento de revocación sin reabrir ACL públicas.

## Criterio de éxito

Se ha migrado una cuenta solo si la invitación fue entregada, el usuario confirma correo y establece su acceso, la asociación UUID es única, obtiene exactamente USER, puede consultar su Docencia propia, no puede acceder a la de otro usuario ni a administración o Doctrina reservada, y existe un evento auditable.

## Decisiones críticas pendientes

1. Autorizar una cohorte piloto con sus destinatarios y fecha una vez lista la landing Auth.
2. Autorizar el retiro definitivo de `autenticar_usuario`, lo cual deshabilitará el ingreso antiguo de cuentas aún no activadas.
