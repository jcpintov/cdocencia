create table if not exists public.calendario_tenidas (
 id uuid primary key default gen_random_uuid(),
 fecha date not null,
 grado smallint not null check(grado between 1 and 3),
 tema text not null check(length(btrim(tema)) between 1 and 250),
 autor text not null check(length(btrim(autor)) between 1 and 180),
 version integer not null default 1 check(version>0),
 activo boolean not null default true,
 creado_por uuid references public.usuarios(id) on delete set null,
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now()
);
create index if not exists calendario_tenidas_fecha on public.calendario_tenidas(fecha,id) where activo;
alter table public.calendario_tenidas enable row level security;
alter table public.calendario_tenidas force row level security;
revoke all on public.calendario_tenidas from public,anon,authenticated,service_role;
grant select,insert,update on public.calendario_tenidas to service_role;
