-- BORRADOR NO APLICADO. Uso exclusivo por backend privado autorizado.
-- La consulta recalcula vigencia en cada lectura: no concede acceso por sí sola.
-- Debe ejecutarse con permisos mínimos, RLS y comprobación de identidad del actor.
select p.id, p.titulo, p.contenido, p.publicado_en
from doctrina.publicaciones p
where p.estado = 'publicado'
  and p.aprobado_por is not null
  and p.publicado_en is not null
  and nullif(btrim(p.contenido), '') is not null
  and exists (
    select 1 from doctrina.superadmins s
    where s.auth_user_id = p.aprobado_por and s.activo = true
  )
  and exists (
    select 1 from doctrina.publicacion_fuentes pf
    where pf.publicacion_id = p.id
  )
  and not exists (
    select 1
    from doctrina.publicacion_fuentes pf
    left join doctrina.afirmaciones a on a.id = pf.afirmacion_id
    left join doctrina.unidades u on u.id = a.unidad_id
    left join doctrina.versiones v on v.id = u.version_id
    left join doctrina.documentos doc on doc.id = v.documento_id
    where pf.publicacion_id = p.id
      and (
        a.id is null or u.id is null or v.id is null or doc.id is null
        or a.estado_revision is distinct from 'aprobado'
        or u.estado_revision is distinct from 'validado'
        or v.estado is distinct from 'listo'
        or not exists (
          select 1 from doctrina.dependencias_conocimiento dep
          where dep.publicacion_id = p.id
            and dep.fuente_version_id = v.id
            and dep.estado_revision = 'vigente'
        )
        or not exists (
          select 1 from doctrina.autorizaciones_fuente af
          where af.documento_id = doc.id
            and af.alcance = 'publicacion_derivados'
            and af.revocado_en is null
        )
      )
  )
  and not exists (
    select 1 from doctrina.dependencias_conocimiento dep
    where dep.publicacion_id = p.id
      and dep.estado_revision is distinct from 'vigente'
  );
