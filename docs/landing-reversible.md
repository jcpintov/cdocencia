# Conmutación reversible de la portada `cmaestros.ofl.cl`

## Estado actual (noviembre de 2026)
- `index.html` presenta **Plataforma temporalmente fuera de Servicio**. No debe cambiarse al publicar otras funcionalidades mientras dure el mantenimiento.
- `a1.html` es la puerta de entrada reservada a administración. La comprobación del acceso se realiza en servidor; la URL sola no otorga permisos.
- La interfaz completa original se conserva dentro de `api/admin-usuarios.js`, en la constante `LANDING_ORIGINAL_RESGUARDADO`. Esa es la interfaz que usa `a1.html` después de autenticarse.
- `config/landing-mantenimiento.html` preserva el diseño de la portada temporal.

## Restaurar funcionamiento normal en el futuro
Se requiere decisión explícita de reabrir el portal a sus usuarios registrados; **NO ejecutar por anticipado**.

1. Comprobar que los despliegues y las migraciones de Supabase están al día y que no existe una contingencia de seguridad.
2. Desde el repositorio ejecutar `node scripts/landing-mode.mjs --check`; debe indicar `mantenimiento`.
3. Ejecutar `node scripts/landing-mode.mjs --restore`. Esto sustituye **solo `index.html`** por la interfaz completa, extraída del mismo resguardo que usa `a1.html`.
4. Inspeccionar `git diff -- index.html`, correr `node --test tests/landing-reversible.test.mjs`, y ejecutar las demás suites.
5. Confirmar el cambio en GitHub y desplegar Vercel; verificar la portada, el ingreso ordinario y el rol de Superadmin.

**Nota:** No copiar literalmente `a1.html` sobre `index.html`: `a1.html` está restringido a administración. Lo correcto es recuperar la interfaz original completa que `a1.html` carga mediante su endpoint autenticado.

## Volver a mantenimiento
- Ejecutar `node scripts/landing-mode.mjs --maintenance`.
- Validar el diff, pruebas y publicar la nueva versión.
- `a1.html` permanece inalterado en ambas direcciones.

El mecanismo aborta si detecta modificaciones no reconocidas en `index.html`; no sobrescribe ediciones ajenas silenciosamente.
