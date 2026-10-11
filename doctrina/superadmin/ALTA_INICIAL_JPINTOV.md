# Alta inicial controlada: jpintov@gmail.com

**Estado: pendiente de identidad verificada y autorización final de activación.** No ejecutar este documento automáticamente.

## Procedimiento seguro

1. Un operador autorizado de Supabase debe invitar a `jpintov@gmail.com` desde **Authentication → Users → Invite user**. No insertar directamente en `auth.users`, no generar contraseñas en el repositorio, no usar RPC heredadas de Docencia.
2. El destinatario debe aceptar la invitación y confirmar su identidad; verificar `email_confirmed_at IS NOT NULL` en Supabase Auth.
3. Validar que exista **exactamente una** identidad verificada para el correo y registrar autorización administrativa independiente. Nunca deducir autorización de `public.usuarios.es_admin`.
4. Con aprobación expresa para la habilitación privilegiada, ejecutar mediante consola administrativa autorizada la operación parametrizada siguiente, sustituyendo el UUID por el ID verificado y registrando el fundamento.

```sql
-- SOLO después de verificar identidad y aprobación; no se ha ejecutado.
BEGIN;
DO $provision$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO STRICT v_id
  FROM auth.users
  WHERE lower(email) = 'jpintov@gmail.com'
    AND email_confirmed_at IS NOT NULL;

  INSERT INTO doctrina.superadmins (auth_user_id, activo, fundamento)
  VALUES (v_id, true, 'Autorización explícita del titular; alta inicial controlada')
  ON CONFLICT (auth_user_id) DO UPDATE
    SET activo = true,
        fundamento = EXCLUDED.fundamento,
        actualizado_en = now();
END;
$provision$;
COMMIT;
```

**Precondición:** comprobar el índice único de `auth_user_id` antes de usar `ON CONFLICT`; si no existe, detener y revisar el esquema. Verificar también defaults de `creado_en` y `actualizado_en` antes de ejecutar. No usar este ejemplo sin esa inspección.

5. Comprobar en sesión autenticada que `public.doctrina_es_superadmin()` devuelve `true` únicamente para esa identidad; anónimos y administradores Docencia sin registro Doctrina deben permanecer denegados.
6. Registrar evidencia de auditoría, fecha, autorizador y procedimiento de revocación. La UI no sustituye el control del servidor.

## Separación de funciones
La asignación Superadmin de Doctrina **no** concede ni modifica `public.usuarios.es_admin` de Docencia. Cualquier cambio a ese perfil exige autorización y procedimiento independiente.

## Bloqueo actual
No hay identidad de Supabase Auth verificada para el correo en la última comprobación; las herramientas conectadas no incluyen un flujo administrativo seguro de invitación/confirmación. No se ha ejecutado ninguna asignación de privilegios.
