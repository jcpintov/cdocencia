-- BORRADOR: no ejecutar en producción sin autorización final.
-- Bloquea publicación sin aprobación humana y evidencia doctrinal revisada.
create or replace function doctrina.exigir_publicacion_validada()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, doctrina
as $$
begin
  if new.estado = 'publicado' then
    if new.aprobado_por is null or new.publicado_en is null then
      raise exception 'Publicación sin aprobación humana';
    end if;
    if nullif(btrim(new.contenido), '') is null then
      raise exception 'Publicación sin contenido';
    end if;
    if not exists (
      select 1 from doctrina.publicacion_fuentes pf
      join doctrina.afirmaciones a on a.id = pf.afirmacion_id
      join doctrina.unidades u on u.id = a.unidad_id
      join doctrina.versiones v on v.id = u.version_id
      where pf.publicacion_id = new.id
        and a.estado_revision = 'aprobado'
        and u.estado_revision = 'validado'
        and v.estado = 'listo'
    ) then
      raise exception 'Publicación sin evidencia revisada';
    end if;
    if exists (
      select 1 from doctrina.publicacion_fuentes pf
      join doctrina.afirmaciones a on a.id = pf.afirmacion_id
      join doctrina.unidades u on u.id = a.unidad_id
      join doctrina.versiones v on v.id = u.version_id
      where pf.publicacion_id = new.id
        and (a.estado_revision <> 'aprobado'
             or u.estado_revision <> 'validado'
             or v.estado <> 'listo')
    ) then
      raise exception 'Publicación contiene evidencia no validada';
    end if;
    -- Consentimiento específico, activo y revocable por documento fuente.
    if exists (
      select 1 from doctrina.publicacion_fuentes pf
      join doctrina.afirmaciones a on a.id = pf.afirmacion_id
      join doctrina.unidades u on u.id = a.unidad_id
      join doctrina.versiones v on v.id = u.version_id
      where pf.publicacion_id = new.id
        and not exists (
          select 1 from doctrina.autorizaciones_fuente au
          where au.documento_id = v.documento_id
            and au.alcance = 'publicacion_derivados'
            and au.revocado_en is null
        )
    ) then
      raise exception 'Publicación sin autorización vigente de derivados';
    end if;
    -- Cada versión efectivamente citada requiere una dependencia vigente.
    -- Sin esta correspondencia, una revisión posterior podría pasar inadvertida.
    if exists (
      select 1 from doctrina.publicacion_fuentes pf
      join doctrina.afirmaciones a on a.id = pf.afirmacion_id
      join doctrina.unidades u on u.id = a.unidad_id
      where pf.publicacion_id = new.id
        and not exists (
          select 1 from doctrina.dependencias_conocimiento d
          where d.publicacion_id = new.id
            and d.fuente_version_id = u.version_id
            and d.estado_revision = 'vigente'
        )
    ) then
      raise exception 'Publicación sin dependencia vigente para cada fuente';
    end if;
    if exists (
      select 1 from doctrina.dependencias_conocimiento d
      where d.publicacion_id = new.id and d.estado_revision <> 'vigente'
    ) then
      raise exception 'Publicación con dependencias pendientes';
    end if;
    if not exists (
      select 1 from doctrina.superadmins s
      where s.auth_user_id = new.aprobado_por and s.activo = true
    ) then
      raise exception 'Aprobador no autorizado';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_exigir_publicacion_validada on doctrina.publicaciones;
create constraint trigger trg_exigir_publicacion_validada
after insert or update on doctrina.publicaciones
deferrable initially deferred
for each row execute function doctrina.exigir_publicacion_validada();
