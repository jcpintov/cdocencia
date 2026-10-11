# Integración SMTP OFL — laboratorio Vercel

Estado: diseño de integración, **no desplegado ni activado**.

- Proyecto de pruebas confirmado: `cdocencia-seguridad-lab`.
- Proyecto principal: `cdocencia` (no modificar configuración de producción).
- SMTP: `mail.ofl.cl`, puerto `465`, TLS implícito, usuario/remitente `no-reply@ofl.cl`.
- Guardar `SMTP_PASSWORD` como variable **sensitive** en Vercel, destino **Preview** del laboratorio; nunca escribirla en repositorio ni en respuestas.
- Confirmar que el certificado TLS corresponde a `mail.ofl.cl`; no usar `rejectUnauthorized:false`.
- El laboratorio local `recovery-smtp-lab.cjs` solo modela tokens; todavía no envía correos ni persiste tokens.
- La función serverless deberá aplicar límites por IP/cuenta, respuesta uniforme para correos existentes e inexistentes, registro de auditoría sin tokens, persistencia transaccional de hashes, expiración y uso único.
- No revelar tokens al navegador ni devolver detalles SMTP en errores.
- Validar SPF, DKIM y DMARC en cPanel.
- La sustitución de `solicitar_recuperacion_clave` requiere pruebas funcionales y aprobación expresa para cambios operativos.
- No activar ni desplegar producción sin aprobación final.
