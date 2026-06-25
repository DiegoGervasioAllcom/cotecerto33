-- ============================================================
-- 023: Configuração de distribuição (singleton)
-- ============================================================

create table if not exists public.distribuicao_config (
  id text primary key default 'default',
  automatico_on boolean not null default false,
  modo text not null default 'regiao' check (modo in ('regiao','performance','fila')),
  criterios jsonb not null default '{"regiao":true,"franquia":true,"disp":true,"conv":true,"volume":true,"horario":false}'::jsonb,
  sla_segundos integer not null default 180,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);

grant select on public.distribuicao_config to authenticated;
grant all on public.distribuicao_config to service_role;
alter table public.distribuicao_config enable row level security;

drop policy if exists dist_cfg_select on public.distribuicao_config;
create policy dist_cfg_select on public.distribuicao_config
  for select to authenticated using (true);

drop policy if exists dist_cfg_admin on public.distribuicao_config;
create policy dist_cfg_admin on public.distribuicao_config
  for all to authenticated
  using (public.has_role(auth.uid(),'matriz'))
  with check (public.has_role(auth.uid(),'matriz'));

insert into public.distribuicao_config (id) values ('default')
on conflict (id) do nothing;

-- Helper: marcar atualização
create or replace function public.distribuicao_config_touch() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end$$;

drop trigger if exists dist_cfg_touch on public.distribuicao_config;
create trigger dist_cfg_touch
  before update on public.distribuicao_config
  for each row execute function public.distribuicao_config_touch();
