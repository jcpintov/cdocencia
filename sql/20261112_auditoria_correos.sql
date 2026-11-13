-- Auditoría de metadatos de correo. No se almacenan cuerpos ni credenciales.
create table if not exists public.auditoria_correos (
 id uuid primary key default gen_random_uuid(),
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now(),
 remitente text not null,
 destinatarios text[] not null default '{}',
 cc text[] not null default '{}',
 cco text[] not null default '{}',
 asunto text not null,
 tipo text not null,
 origen_id text,
 intento_id text,
 estado text not null default 'pendiente'
  check (estado in ('pendiente','aceptado_smtp','error','incierto')),
 aceptados_smtp text[] not null default '{}',
 rechazados_smtp text[] not null default '{}',
 message_id text,
 error_codigo text,
 error_detalle text
);
create index if not exists auditoria_correos_fecha_idx on public.auditoria_correos (creado_en desc);
create index if not exists auditoria_correos_tipo_fecha_idx on public.auditoria_correos (tipo,creado_en desc);
create unique index if not exists auditoria_correos_intento_idx on public.auditoria_correos (tipo,intento_id) where intento_id is not null;
alter table public.auditoria_correos enable row level security;
revoke all on public.auditoria_correos from anon, authenticated, public;
grant select, insert, update on public.auditoria_correos to service_role;
-- Sin policies: únicamente backend con service_role accede.
