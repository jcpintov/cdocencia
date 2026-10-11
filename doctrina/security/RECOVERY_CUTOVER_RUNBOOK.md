# Docencia — sustitución segura de recuperación de contraseñas

Estado: **plan técnico; NO desplegado ni aplicado**. Alcance: únicamente el sistema heredado de cuentas de Docencia. El módulo Doctrina/Superadmin mantiene su autorización independiente con Supabase Auth y no debe reutilizar los RPC de Docencia.

## Evidencia de partida (auditoría de solo lectura, 2026-10-11)

- `public.usuarios` contiene `email`, `clave_hash`, `token_recuperacion` y `token_expira`.
- `public.solicitar_recuperacion_clave(text)` está definido con `SECURITY DEFINER`, es ejecutable por `anon` y devuelve un token.
- `app.js` solicita ese token y muestra un enlace de recuperación al navegador.
- `public.resetear_clave_con_token(text,text)` valida el token para cambiar la contraseña.
- No hay Edge Functions desplegadas en el proyecto consultado. No se verificó un proveedor de correo transaccional.
- No existe rama de ensayo Supabase. **No ejecutar migraciones sobre el proyecto operativo antes de aprobación.**

## Arquitectura objetivo

1. Un endpoint **exclusivamente servidor** recibe el correo, valida el formato, aplica límites de frecuencia por cuenta y origen, y devuelve siempre una respuesta genérica indistinguible para cuentas existentes e inexistentes.
2. El servidor genera un token criptográficamente aleatorio, de un solo uso y vida breve. La base almacena únicamente su hash; nunca devuelve el token a un cliente no verificado.
3. El enlace se envía solo al correo registrado mediante proveedor transaccional configurado con secretos de servidor. La URL base se obtiene de configuración confiable, nunca del encabezado `Origin` del solicitante.
4. El restablecimiento consume el token **atómicamente**, comprueba expiración y uso previo, valida la nueva contraseña y registra un evento sin credenciales ni tokens.
5. El endpoint legado deja de ser ejecutable por `anon` y `authenticated` antes de habilitar el nuevo flujo público. No confiar únicamente en ocultar la llamada en el navegador.
6. No incluir tokens en registros, analíticas, mensajes de error, respuestas de API ni URLs de terceros. Configurar `Referrer-Policy: no-referrer` en la pantalla de restablecimiento.
7. Mantener los procedimientos y tablas de Doctrina/Superadmin separados. Ningún cambio de este plan debe modificar sus permisos o flujos de autenticación.

## Secuencia obligatoria de cambio (entorno aislado)

- Preparar rama o proyecto de ensayo con datos **sintéticos**, previa aprobación de posibles costes.
- Configurar proveedor de correo y dominio verificado en el entorno de ensayo; comprobar entregabilidad sin datos reales.
- Implementar endpoint, almacenamiento hash y consumo atómico. Evitar que la función que genera tokens pueda ser invocada por roles públicos.
- Ejecutar pruebas: no enumeración de cuentas, límite de solicitudes, correo exclusivamente al titular, expiración, reutilización, concurrencia, errores del proveedor y ausencia de tokens en respuesta/logs.
- Verificar compatibilidad de inicio de sesión heredado y recuperación sin afectar Doctrina/Superadmin.
- Actualizar `app.js` para consumir el endpoint seguro y eliminar la visualización del enlace generado.
- Activar la prueba de regresión actualmente omitida, sustituyéndola por pruebas que fallen ante cualquier devolución de token al navegador.
- Registrar evidencias y preparar reversión controlada. **Solicitar aprobación final antes de cualquier cambio operativo o despliegue de producción.**

## Contención y reversión

La exposición actual exige atención prioritaria, pero revocar el RPC sin reemplazo interrumpiría la recuperación de cuentas. Cualquier contención de emergencia debe aprobarse explícitamente con ese impacto documentado. En caso de reversión, no restablecer un endpoint que entregue tokens al solicitante; preferir recuperación asistida por un administrador autorizado y canal verificado.

## Criterio de aceptación

No se considera resuelto hasta que: (a) el rol anónimo no pueda obtener tokens; (b) la recuperación legítima funcione de extremo a extremo; (c) las pruebas automáticas y manuales pasen; (d) la separación Docencia–Superadmin esté comprobada; y (e) exista aprobación final para producción.
