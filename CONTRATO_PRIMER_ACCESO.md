# Contrato de primer acceso — Cámara de Docencia
**Versión:** 2026-10-16 · **Estado:** OPERATIVO PARA EL PADRÓN CERRADO (26 integrantes).
**Alcance exclusivo:** GitHub `jcpintov/cdocencia` / Vercel `cdocencia` / Supabase `pwnnpjygnviyzyyvfxnq`.

## Reglas definitivas
1. No enviar invitaciones masivas ni contraseñas provisionales. Solo el usuario inscrito puede solicitar un código a su correo e iniciar su activación.
2. Padrón cerrado de 26 integrantes ordinarios, además de Superadmin único y cuenta Dummy de prueba. El servidor rechaza nuevas altas si los 26 cupos están ocupados.
3. Código aleatorio de **8 dígitos**, validez de **15 minutos**, hash exclusivo en Postgres, máximo **5 intentos**, **5 solicitudes/hora** y espera de **60 segundos** entre solicitudes al mismo correo.
4. Los RPC `primer_acceso_emitir` y `primer_acceso_verificar` requieren `service_role`; el navegador nunca recibe esta credencial. Los códigos no se anotan en logs.
5. Las solicitudes de emisión muestran un mensaje público genérico. Para correos no incluidos en el padrón no debe crearse Auth ni enviarse OTP. La limitación global por IP y la mitigación de diferencias de tiempo de respuesta siguen como mejoras a evaluar proporcionalmente.
6. La confirmación requiere OTP correcto y contraseña personal de 8–128 caracteres, con al menos seis caracteres alfanuméricos y un símbolo.
7. Después de confirmar, el servidor crea el usuario Supabase Auth, enlaza `auth_user_id` y elimina el OTP; si falla el enlace, intenta revertir la nueva identidad. Un perfil previamente vinculado no se reactiva con el OTP.
8. La autenticación normal usa correo y contraseña personal. MFA para el usuario común no es obligatorio; el perfil Superadmin se controla por sus permisos especiales.
9. Doctrina y Reglamentos sigue reservada exclusivamente al Superadmin hasta la validación documental acordada.
10. Las cuentas Auth sin vínculo con Docencia no se deben eliminar ni modificar sin identificación expresa.

## Cierre verificado del piloto Dummy
- Se observó emisión OTP el **16/10/2026 18:52:47 UTC**.
- Supabase registró cuenta Auth vinculada y correo confirmado el **16/10/2026 18:54:19 UTC**.
- Supabase Auth registró ingreso a las **18:54:46 UTC**; la bitácora de Docencia registra al menos un acceso.
- El OTP fue eliminado y quedaron cero códigos activos al verificar.
- Estos registros acreditan la secuencia de activación y autenticación. La recepción del mensaje no se comprobó visualmente en la bandeja.

## Liberación general controlada
- PR #5 (`84f039c`): limitación temporal a Dummy por defecto, con apertura explícita del entorno de servidor.
- PR #6 (`0b379d6`): cupo 26, corrección de validación de emails, retiro de activación antigua y UI actualizada.
- **2026-10-16:** Vercel producción configuró `PRIMER_ACCESO_GENERAL_ENABLED=true` tras comprobar el piloto y desplegó el commit `7c66079` en `dpl_73R1xismvdBK5KJhZ7gYgDdaCd7W` (`READY`, dominio `cmaestros.ofl.cl`).
- Activación general bajo demanda: **no se envían invitaciones ni correos automáticamente al liberar**.
- GitHub Actions: 16 pruebas aisladas y validación sintáctica aprobadas. https://github.com/jcpintov/cdocencia/actions/runs/38950645924

## Pendientes y recuperación
- Mejorar recuperación ante fallos entre creación Auth y vinculación del perfil, con conciliación cuidadosa. Los mocks cubren la reversión simple, no garantizan atomicidad distribuida.
- Evaluar mitigación de enumeración por tiempos y límites por origen antes de aumentar el volumen de público; para 26 personas mantener solución sencilla.
- Si debe suspenderse temporalmente la incorporación, cambiar `PRIMER_ACCESO_GENERAL_ENABLED` a `false` en **Vercel producción** y realizar **nuevo despliegue**; cambiar la variable por sí sola no modifica funciones ya publicadas.
- Examinar alertas Supabase SECURITY DEFINER y controles de claves sin revocar indiscriminadamente funciones requeridas.
