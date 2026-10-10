-- DIAGNÓSTICO DE SOLO LECTURA. No ejecutar automáticamente.
-- No devuelve texto doctrinal ni nombres de personas.
-- Ejecutar únicamente con identidad administrativa autorizada.
-- Los resultados son indicadores de revisión, no una autorización de publicación.
with fuentes as (
  select pf.publicacion_id,
         count(*) as total,
         count(*) filter (
           where a.estado_revision = 'aprobado'
             and u.estado_revision = 'validado'
             and v.estado = 'listo'
         ) as validadas,
         count(*) filter (
           where not exists (
             select 1 from doctrina.dependencias_conocimiento d
             where d.publicacion_id = pf.publicacion_id
               and d.fuente_version_id = u.version_id
               and d.estado_revision = 'vigente'
           )
         ) as sin_dependencia
  from doctrina.publicacion_fuentes pf
  left join doctrina.afirmaciones a on a.id = pf.afirmacion_id
  left join doctrina.unidades u on u.id = a.unidad_id
  left join doctrina.versiones v on v.id = u.version_id
  group by pf.publicacion_id
), dependencias as (
  select publicacion_id,
         count(*) filter (where estado_revision <> 'vigente') as no_vigentes
  from doctrina.dependencias_conocimiento
  group by publicacion_id
)
select p.id as publicacion_id,
       coalesce(f.total, 0) = 0 as sin_fuentes,
       coalesce(f.total, 0) <> coalesce(f.validadas, 0) as fuentes_no_validadas,
       coalesce(f.sin_dependencia, 0) > 0 as dependencias_faltantes,
       coalesce(d.no_vigentes, 0) > 0 as dependencias_no_vigentes,
       p.aprobado_por is null or p.publicado_en is null as aprobacion_incompleta,
       not exists (
         select 1 from doctrina.superadmins s
         where s.auth_user_id = p.aprobado_por and s.activo
       ) as aprobador_no_activo
from doctrina.publicaciones p
left join fuentes f on f.publicacion_id = p.id
left join dependencias d on d.publicacion_id = p.id
where p.estado = 'publicado'
  and (
    coalesce(f.total, 0) = 0
    or coalesce(f.total, 0) <> coalesce(f.validadas, 0)
    or coalesce(f.sin_dependencia, 0) > 0
    or coalesce(d.no_vigentes, 0) > 0
    or p.aprobado_por is null or p.publicado_en is null
    or not exists (
      select 1 from doctrina.superadmins s
      where s.auth_user_id = p.aprobado_por and s.activo
    )
  );
