# Docencia — persistencia privada de recuperación (diseño de ensayo)

**Estado: BORRADOR NO APLICADO.** Este archivo documenta una migración para un proyecto Supabase **aislado**, con identidades sintéticas. No ejecutar en producción ni en el proyecto operativo sin aprobación final y plan de reversión revisado.

## Fronteras comprobadas (lectura de esquema, 2026-10-12 UTC)

- `public.usuarios(id uuid, email varchar(255), clave_hash text, debe_cambiar_clave boolean)` pertenece a **Docencia**.
- El login heredado verifica `u.clave_hash = extensions.crypt(p_clave, u.clave_hash)`.
- `extensions.gen_salt('bf', 12)` produce un hash compatible con esa verificación.
- `doctrina.superadmins` y Supabase Auth son independientes. **No reutilizar sus permisos para Docencia.**
- La ruta `/recuperar.html` existente corresponde a la **cuenta de ensayo de Supabase Auth**. El futuro formulario Docencia debe usar exclusivamente `/docencia-restablecer.html`; todavía no existe y no debe redirigirse al anterior.

## Requisitos de implementación antes de activar

1. Usar solo un proceso servidor con conexión PostgreSQL privada y TLS. No publicar `DATABASE_URL`, `service_role` ni este adaptador en el cliente.
2. Implementar `limiter.allow` con contadores persistentes y operaciones atómicas por origen de red confiable y correo normalizado; no aceptar identificadores de origen enviados en JSON.
3. Instalar un formulario propio para Docencia y endpoints HTTPS con respuestas uniformes. Aplicar `Referrer-Policy: no-referrer`, `Cache-Control: no-store` y `Content-Security-Policy`.
4. Verificar correo y SMTP en Preview. No enviar tokens al navegador que solicita la recuperación.
5. Instalar y probar este esquema en una instancia aislada; luego ejecutar regresión integral.
6. Retirar las RPC heredadas ejecutables por `anon` **solo en una operación de corte aprobada**.

## Propuesta SQL para instancia aislada; NO ejecutar todavía

```sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS docencia_private;
REVOKE ALL ON SCHEMA docencia_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS docencia_private.password_reset_tokens (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS docencia_reset_tokens_user_idx
  ON docencia_private.password_reset_tokens (user_id);

ALTER TABLE docencia_private.password_reset_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE docencia_private.password_reset_tokens FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA docencia_private TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON docencia_private.password_reset_tokens TO service_role;

CREATE OR REPLACE FUNCTION docencia_private.consume_reset_token(
  p_token_hash text,
  p_password_hash text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_password_hash !~ '^[$]2a[$][0-9]{2}[$][./A-Za-z0-9]{53}$' THEN
    RETURN FALSE;
  END IF;

  UPDATE docencia_private.password_reset_tokens
     SET consumed_at = clock_timestamp()
   WHERE token_hash = p_token_hash
     AND consumed_at IS NULL
     AND expires_at > clock_timestamp()
   RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN RETURN FALSE; END IF;

  UPDATE public.usuarios
     SET clave_hash = p_password_hash, debe_cambiar_clave = FALSE
   WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reset target no longer exists';
  END IF;
  RETURN TRUE;
END;
$fn$;

REVOKE ALL ON FUNCTION docencia_private.consume_reset_token(text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION docencia_private.consume_reset_token(text,text)
  TO service_role;
COMMIT;
```

### Propiedad transaccional

La ejecución de la función consume el hash y actualiza el hash de contraseña en la **misma transacción PostgreSQL**. Una excepción revierte ambos cambios. La condición `consumed_at IS NULL` impide que dos solicitudes concurrentes utilicen el mismo token.

### Verificación obligatoria tras instalar en ensayo

```sql
SELECT
  has_schema_privilege('anon','docencia_private','USAGE') AS anon_schema_usage,
  has_table_privilege('anon','docencia_private.password_reset_tokens','SELECT') AS anon_read,
  has_function_privilege('anon','docencia_private.consume_reset_token(text,text)','EXECUTE') AS anon_exec,
  has_function_privilege('authenticated','docencia_private.consume_reset_token(text,text)','EXECUTE') AS authenticated_exec,
  has_function_privilege('service_role','docencia_private.consume_reset_token(text,text)','EXECUTE') AS service_exec;
-- Esperado: false, false, false, false, true.
```

Además se deben probar con usuarios sintéticos: caso exitoso, ausencia de cuenta, vencimiento, reutilización y dos consumos concurrentes (exactamente uno debe prosperar), errores del proveedor de correo, límites de frecuencia, revocación de tokens y persistencia tras reinicio. Inspeccionar la compatibilidad del hash bcrypt con `public.autenticar_usuario`.

**No confundir** los controles estáticos o pruebas con simuladores de JavaScript con una prueba SQL real en una instancia aislada. No existe certificación de persistencia hasta completar esas pruebas.
