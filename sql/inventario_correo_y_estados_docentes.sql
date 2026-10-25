create table public.docencia_inventarios_correo (
 id uuid primary key, actor uuid not null, estado text not null default 'preparado'
 check(estado in ('preparado','enviando','enviado','incierto')),
 contenido jsonb not null, aceptados integer not null default 0, rechazados integer not null default 0,
 message_id text, creado_en timestamptz not null default now(), finalizado_en timestamptz
);
alter table public.docencia_inventarios_correo enable row level security;
revoke all on public.docencia_inventarios_correo from public,anon,authenticated;
grant select,insert,update on public.docencia_inventarios_correo to service_role;

create function public.maestro_estados_temas_docencia() returns table(codigo text,estado text)
language sql stable security definer set search_path='' as $$
 select a.codigo,case when a.entregado_el is not null then 'recibido'
 when now()>((a.fecha_entrega+a.hora_entrega) at time zone 'America/Santiago') then 'vencido'
 else 'asignado' end
 from public.docencia_asignaciones a
 where a.vigente and exists(select 1 from public.maestro_identidad_actual())
 and not exists(select 1 from public.modulos m where m.activo and
 (m.unidad_codigo=a.codigo or exists(select 1 from public.modulos_temas t where t.modulo_id=m.id and t.codigo=a.codigo)));
$$;
revoke all on function public.maestro_estados_temas_docencia() from public,anon;
grant execute on function public.maestro_estados_temas_docencia() to authenticated;
