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
