# Bloqueadores de activación: protección de publicaciones

Fecha: 2026-10-10. Rama de desarrollo, sin ejecución en producción.

## Verificado en el borrador

- Requiere aprobador y fecha de publicación.
- Exige superadministrador activo y evidencia aprobada.
- Rechaza fuentes no validadas y contenido vacío.
- Exige una dependencia vigente para **cada** versión efectivamente citada.
- La migración es un borrador y no figura entre las migraciones aplicadas.

## Bloqueadores pendientes

1. **Revocación posterior**: el trigger en publicaciones solo se ejecuta cuando cambia una fila de publicaciones. Una modificación de afirmaciones, unidades, versiones, dependencias o superadministradores puede invalidar una publicación ya visible sin disparar esta validación. Se necesita invalidación transaccional, retiro o lectura filtrada por vigencia.
2. **Identidad del aprobador**: el campo aprobado_por no acredita por sí solo quién ejecutó la operación. Exigir verificación de actor autenticado en un endpoint privilegiado y auditoría inmutable.
3. **Permisos de función y tablas**: validar ejecución con rol de servicio mínimo, RLS y SECURITY INVOKER. No conceder permisos amplios por comodidad.
4. **Pruebas reales**: escenarios de inserción, actualización, revocación, cero fuentes, mezcla de fuentes válidas e inválidas, transacciones diferidas y concurrencia con PostgreSQL aislado.
5. **Separación de exposición**: la tabla de publicaciones privada no debe exponerse directamente a Docencia; solo derivados revisados y expresamente autorizados.
6. **Consentimiento**: el derecho a publicar derivados debe constar por fuente, no inferirse del estado técnico de extracción.

No aplicar el SQL hasta cerrar estos bloqueadores y obtener aprobación final.
