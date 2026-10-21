CREATE OR REPLACE FUNCTION public.docencia_recordatorio_contexto(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object(
 'estado',case when r.estado is not null then r.estado when not a.vigente then 'anulada'
   when p.trabajos is not null then 'publicado' when c.id is null then 'sin_solicitud'
   when exists(select 1 from public.docencia_asignaciones_correos pc where pc.asignacion_id=a.id and pc.estado='preparado') then 'solicitud_pendiente'
   when now() < ((a.fecha_entrega+7)+a.hora_entrega) at time zone 'America/Santiago' then 'programado' else 'pendiente' end,
 'publicado',p.trabajos is not null,'trabajos_publicados',coalesce(p.trabajos,'[]'::jsonb),
 'programado_para',((a.fecha_entrega+7)+a.hora_entrega) at time zone 'America/Santiago',
 'solicitud_id',c.id,'solicitud_enviada_en',c.finalizado_en,
 'id',r.id,'creado_en',r.creado_en,'finalizado_en',r.finalizado_en,'copia_estado',r.copia_estado)
 from public.docencia_asignaciones a join public.usuarios u on u.id=a.usuario_id
 left join lateral(select c.id,c.finalizado_en from public.docencia_asignaciones_correos c
  where c.asignacion_id=a.id and c.estado='enviado' and c.finalizado_en is not null
   and c.usuario_id=a.usuario_id and c.codigo=a.codigo and lower(c.destinatario)=lower(u.email)
  order by c.finalizado_en,c.id limit 1) c on true
 left join lateral(select jsonb_agg(jsonb_build_object('id',m.id,'titulo',m.titulo,'fecha_subida',m.creado_en) order by m.numero_orden) trabajos
  from public.modulos m where m.activo and (m.unidad_codigo=a.codigo or exists(select 1 from public.modulos_temas mt where mt.modulo_id=m.id and mt.codigo=a.codigo))) p on true
 left join public.docencia_asignaciones_recordatorios r on r.asignacion_id=a.id
 where a.id=p_id;
$function$;

