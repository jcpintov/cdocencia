-- Preparado para el próximo despliegue; no ejecutar por separado antes de revisar el conjunto.
alter table public.calendario_tenidas add column if not exists hora time not null default '20:00';
create table if not exists public.calendario_tenidas_avisos(
 id uuid primary key,evento_id uuid not null references public.calendario_tenidas(id),fecha_evento date not null,
 version_evento integer not null,estado text not null check(estado in ('preparado','enviando','enviado','incierto','cancelado')),
 creado_en timestamptz not null default now(),finalizado_en timestamptz,message_id text,
 unique(evento_id,fecha_evento,version_evento)
);
alter table public.calendario_tenidas_avisos enable row level security;
revoke all on public.calendario_tenidas_avisos from public,anon,authenticated;
grant select,insert,update on public.calendario_tenidas_avisos to service_role;
create or replace function public.calendario_recordatorios_servicio(p_accion text,p_datos jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.calendario_tenidas; aviso public.calendario_tenidas_avisos; local_hoy timestamp:=now() at time zone 'America/Santiago'; filas integer;
begin
 if p_accion='candidatos' then
  return coalesce((select jsonb_agg(to_jsonb(t)) from public.calendario_tenidas t where t.activo and t.fecha=local_hoy::date+5 and extract(hour from local_hoy)=8 and not exists(select 1 from public.calendario_tenidas_avisos x where x.evento_id=t.id and x.fecha_evento=t.fecha and x.estado<>'cancelado')),'[]');
 end if;
 select * into e from public.calendario_tenidas where id=(p_datos->>'id')::uuid for update;
 if not found then return jsonb_build_object('enviar',false); end if;
 if p_accion='reservar' then
  if not e.activo or e.fecha<>local_hoy::date+5 or extract(hour from local_hoy)<>8 or e.version<>(p_datos->>'version')::integer then return jsonb_build_object('enviar',false); end if;
  if exists(select 1 from public.calendario_tenidas_avisos x where x.evento_id=e.id and x.fecha_evento=e.fecha and x.estado<>'cancelado') then return jsonb_build_object('enviar',false); end if;
  insert into public.calendario_tenidas_avisos(id,evento_id,fecha_evento,version_evento,estado) values((p_datos->>'intento')::uuid,e.id,e.fecha,e.version,'preparado') on conflict(evento_id,fecha_evento,version_evento) do nothing;
  get diagnostics filas=row_count;return jsonb_build_object('enviar',filas=1);
 end if;
 select * into aviso from public.calendario_tenidas_avisos where id=(p_datos->>'intento')::uuid and evento_id=e.id for update;
 if not found then return jsonb_build_object('enviar',false,'ok',false); end if;
 if p_accion='confirmar' then
  if aviso.estado<>'preparado' then return jsonb_build_object('enviar',false); end if;
  if extract(hour from local_hoy)<>8 or e.fecha<>local_hoy::date+5 or not e.activo or e.fecha<>aviso.fecha_evento or e.version<>aviso.version_evento then update public.calendario_tenidas_avisos set estado='cancelado',finalizado_en=now() where id=aviso.id;return jsonb_build_object('enviar',false); end if;
  update public.calendario_tenidas_avisos set estado='enviando' where id=aviso.id;return jsonb_build_object('enviar',true);
 elsif p_accion='finalizar' and p_datos->>'estado' in ('enviado','incierto') then
  update public.calendario_tenidas_avisos set estado=p_datos->>'estado',message_id=p_datos->>'message_id',finalizado_en=now() where id=aviso.id and estado in ('preparado','enviando');
  get diagnostics filas=row_count;return jsonb_build_object('ok',filas=1);
 end if;
 raise exception 'Acción no válida';
end $$;
revoke all on function public.calendario_recordatorios_servicio(text,jsonb) from public,anon,authenticated;
grant execute on function public.calendario_recordatorios_servicio(text,jsonb) to service_role;
