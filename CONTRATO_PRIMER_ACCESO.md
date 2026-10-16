# Contrato de activación de primer acceso (v1)
Estado: NO OPERATIVO. No habilitar formularios ni enviar códigos hasta completar la API.

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
Vercel registra el commit 6b33c0a como READY; no hay API primer-acceso.js en GitHub.

## Condiciones adicionales de cierre (auditoría 2026-10-16)
- La verificación debe consumir el código de manera atómica; el RPC actual solo incrementa intentos y devuelve el ID, por lo que NO es suficiente para habilitar una API pública.
- El envío SMTP debe fallar de manera segura, sin dejar un código válido no enviado o revelar la existencia de una cuenta.
- El servidor debe establecer un límite de solicitudes también para correos desconocidos y prevenir enumeración por tiempo de respuesta.
- Evitar condiciones de carrera en creación de Auth y vinculación; una cuenta huérfana exige reconciliación controlada.
- Comprobar el estado real de Supabase Auth (política de contraseñas, configuración de confirmación y acceso) antes de habilitar el flujo.
- No introducir una API parcial en producción como si fuera funcional.
