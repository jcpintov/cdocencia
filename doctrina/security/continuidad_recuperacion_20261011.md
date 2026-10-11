# Docencia: control de continuidad (2026-10-11)

Estado: diagnóstico técnico. Sin cambios en producción.

La auditoría de solo lectura identificó una dependencia heredada de recuperación de cuentas que requiere sustitución antes de habilitar una política más estricta de acceso.

Próximos controles de desarrollo:
1. Preparar un entorno de pruebas independiente, con datos sintéticos.
2. Implementar un mecanismo de recuperación que verifique la titularidad del correo.
3. Probar los casos de éxito, expiración, reutilización, error y acceso no autorizado.
4. Conservar separadas las interfaces y autorizaciones de Docencia y Superadmin.
5. Revisar pruebas automatizadas y solicitar autorización antes de cualquier cambio operativo.

Ninguna modificación de funciones, permisos, usuarios o despliegues forma parte de este registro.
