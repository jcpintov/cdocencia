# Verificación técnica Doctrina–Docencia — 2026-10-12

## Alcance
Revisión de solo lectura de GitHub y Supabase, sin cambios de datos, despliegue ni tratamiento de documentos.

## Estado verificado
- Supabase: proyecto cmaestros-docencia activo y saludable.
- Doctrina: tabla superadmins con un registro y un registro activo (conteo agregado).
- Permisos: la función doctrina_es_superadmin puede ejecutarse con rol authenticated, no con anon.
- La función doctrina_admin_cambiar sigue siendo ejecutable con rol authenticated, pero exige comprobación de autorización en servidor. La restricción definitiva a un único titular permanece propuesta y sin aplicar.
- GitHub: rama feature/doctrina-ingesta-v1, última ejecución observada 38199556535, resultado success.
- Diseño Admin v3, modal y pruebas automatizadas presentes en la rama. No se ha acreditado prueba manual con sesión real en navegador.

## Hallazgo pendiente: lanzador fuera de la consola
El código de floating-tab.js contiene un fallback que inserta el lanzador en document.body si no se encuentra .admin-menu-list. Esto contradice el requisito de que el botón exista exclusivamente dentro del panel Admin.

Corrección prevista: no montar el lanzador si falta la navegación Admin y añadir prueba negativa que simule ausencia de seccionAdmin y admin-menu-list. El intento de modificación directa del archivo fue rechazado por el control de escritura de la herramienta, por lo que **no se considera corregido**.

## Restricciones
- No ejecutar la migración 20261012_titular_unico_NO_APLICAR.sql sin autorización final y ensayo aislado.
- No fusionar con main ni desplegar a producción sin aprobación.
- No exponer originales de Doctrina a Docencia.
- No procesar documentos reservados con LLM externo sin consentimiento específico.

## Próxima acción segura
Implementar y probar el fallo cerrado del montaje de la interfaz en la rama de desarrollo cuando el control de escritura lo permita; verificar CI y, después, ejecutar pruebas visuales y de sesión reales antes de solicitar aprobación de producción.
