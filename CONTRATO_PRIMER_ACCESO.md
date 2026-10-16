# Contrato de activación de primer acceso (v1)
Estado: API IMPLEMENTADA y desplegada; activación general NO VALIDADA. Solo autorizar pruebas controladas con Dummy hasta cerrar E2E.

- El usuario ya debe existir en public.usuarios y no estar vinculado a Auth.
- No se enviarán invitaciones ni contraseñas provisionales.
- El correo recibe un código aleatorio de 8 dígitos, válido 15 minutos.
- La base almacena solo un hash del código; máximo 5 intentos, 5 emisiones/hora y espera de 60 segundos.
- Las funciones primer_acceso_emitir y primer_acceso_verificar solo permiten service_role.
- La API debe validar contraseña (mínimo 8 caracteres, seis alfanuméricos y símbolo), entregar respuestas genéricas y no registrar secretos.
- Tras verificar código, crear cuenta en Supabase Auth con Admin API y vincular auth_user_id de forma segura.
- Impedir doble activación concurrente y recuperarse de fallos parciales (usuario Auth huérfano).
- No reutilizar el RPC de recuperación heredada: no cambia la contraseña de Supabase Auth.
- La emisión y confirmación deben ser atómicas; verificar código no debe crear cuentas sin confirmación de propiedad del correo.
- Pruebas solo con dummy@ofl.cl; no tocar el resto del padrón.
- Hasta pruebas end-to-end, primer-acceso.html permanece informativa.

## Estado de despliegue
Vercel confirmó en producción el commit 26179ee como READY con api/primer-acceso.js. SQL: migración primer_acceso_verificacion_recuperable_20261016 aplicada.

## Condiciones adicionales de cierre (auditoría 2026-10-16)
- La validación del OTP no consume el código antes de crear Auth; después de vincular correctamente, la API elimina el OTP. El perfil vinculado impide reactivación aun si falla la limpieza.
- El envío SMTP debe fallar de manera segura, sin dejar un código válido no enviado o revelar la existencia de una cuenta.
- El servidor debe establecer un límite de solicitudes también para correos desconocidos y prevenir enumeración por tiempo de respuesta.
- Evitar condiciones de carrera en creación de Auth y vinculación; una cuenta huérfana exige reconciliación controlada.
- Comprobar el estado real de Supabase Auth (política de contraseñas, configuración de confirmación y acceso) antes de habilitar el flujo.
- No declarar validado el flujo integral hasta una prueba SMTP + Auth + inicio de sesión con Dummy. Actualmente el formulario está accesible y falta limitar explícitamente el piloto a Dummy.

## Verificaciones de 2026-10-16
- Padrón: 26 perfiles reales, un Superadmin y un perfil Dummy (28 en total); uno de los 26 ya está vinculado con Auth.
- Los dos RPC `primer_acceso_*` requieren `service_role`; ningún OTP permaneció tras las pruebas transaccionales.
- Variables SMTP y Supabase presentes en Vercel producción. Aún no se verificó la recepción real de correos.
- Validación sintáctica local del endpoint: correcta; Vercel READY tras el commit de corrección.
- Pendientes críticos: restricción de activación del piloto exclusivamente a Dummy, prueba end-to-end de correo/Auth/ingreso, análisis de recuperación ante fallos parciales.
