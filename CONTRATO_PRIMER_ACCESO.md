# Contrato de activación de primer acceso (v1)
Estado: API implementada y desplegada, limitada por defecto a Dummy. Activación general todavía NO VALIDADA; ningún otro integrante debe recibir OTP hasta cerrar E2E.

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
- No declarar validado el flujo integral hasta una prueba SMTP + Auth + inicio de sesión con Dummy. Desde el commit 84f039c, el servidor bloquea solicitudes reales del padrón salvo Dummy, excepto habilitación explícita `PRIMER_ACCESO_GENERAL_ENABLED=true`.

## Verificaciones de 2026-10-16
- Padrón: 26 perfiles reales, un Superadmin y un perfil Dummy (28 en total); uno de los 26 ya está vinculado con Auth.
- Los dos RPC `primer_acceso_*` requieren `service_role`; ningún OTP permaneció tras las pruebas transaccionales.
- Variables SMTP y Supabase presentes en Vercel producción. Aún no se verificó la recepción real de correos.
- Validación sintáctica local del endpoint: correcta; Vercel READY tras el commit de corrección.
- Pendientes críticos: prueba end-to-end de recepción del correo Dummy, verificación Auth/ingreso, recuperación ante fallos parciales. La restricción del piloto se verificó en CI y está en producción.

## Revisión técnica posterior — 2026-10-16
- GitHub PR #5 integrado y desplegado (commit `84f039c`). La variable `PRIMER_ACCESO_GENERAL_ENABLED` NO figura en el entorno de producción; solo `dummy@ofl.cl` tiene permitidas las acciones `solicitar` y `confirmar`. El resto recibe respuesta uniforme sin consulta a la base de datos ni generación de código.
- El envío real a la casilla Dummy y el acceso Auth todavía no están certificados: se observó emisión de OTP Dummy el 16/10 a las 18:52 UTC, pero ese dato aislado no demuestra entrega SMTP ni validación por el destinatario.
- GitHub PR #6 integrado y desplegado (commit `0b379d6`): padrón cerrado en 26, formulario administrativo simplificado, validación de correo reparada, API obsoleta de activar retirada.
- GitHub Actions: 16 pruebas automáticas aprobadas en https://github.com/jcpintov/cdocencia/actions/runs/38950645924. Las pruebas del backend están simuladas, no sustituyen E2E.
- Supabase: los dos perfiles Auth vinculados no presentan inconsistencias; existe una tercera cuenta Auth sin perfil de Docencia, que no debe eliminarse sin investigar su uso.
