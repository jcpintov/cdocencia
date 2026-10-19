# Continuidad 2026-10-19

Destino confirmado por CHECKPOINT_PRODUCCION_20261016.md del repositorio: jcpintov/cdocencia, Vercel cdocencia, Supabase pwnnpjygnviyzyyvfxnq. El checkpoint externo anterior quedó superado.

Migración primer_acceso_cancelar_envio_fallido_20261019 aplicada en Supabase. RPC solo service_role; vence únicamente el OTP coincidente, conserva contadores y no revoca una emisión posterior. Verificación SQL transaccional con rollback aprobada: código diferente intacto, coincidente vencido y rechazado, contador conservado, emisión posterior intacta. anon/authenticated EXECUTE false; service_role true.

Handler complementario y pruebas en esta rama; 67/67 pruebas Node aprobadas localmente. No se fusionó ni se publicó a producción. La API productiva no usa la RPC hasta desplegar este cambio. No se enviaron correos ni se crearon cuentas. No se ejecutó E2E SMTP real.

Pendientes: verificar CI y preview; integrar/desplegar cuando corresponda al ciclo de publicación; validar fallo SMTP en entorno de prueba y acceso con participante voluntario. Continuar frontend Superadmin y auditar controles de renumeración/eliminación que aún escriban directamente. Doctrina continúa sin validación final. QA visual autenticada móvil/escritorio pendiente. No borrar identidades Auth sin perfil.
