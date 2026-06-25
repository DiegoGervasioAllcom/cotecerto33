-- ============================================================
-- 034: Configurações gerais (singleton) e integrações
-- ============================================================

create table if not exists public.configuracoes_gerais (
  id text primary key default 'default',
  meta_vendedor integer not null default 14,
  meta_franquia integer not null default 48,
  auditoria_comissoes boolean not null default true,
  exigir_motivo_estorno boolean not null default true,
  aprovacao_dupla_comissao boolean not null default false,
  notif_sla_estourado boolean not null default true,
  notif_venda_nao_paga boolean not null default true,
  notif_renovacao_vencer boolean not null default true,
  notif_resumo_diario boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);

grant select on public.configuracoes_gerais to authenticated;
grant all on public.configuracoes_gerais to service_role;
alter table public.configuracoes_gerais enable row level security;

drop policy if exists conf_geral_select on public.configuracoes_gerais;
create policy conf_geral_select on public.configuracoes_gerais
  for select to authenticated using (true);

drop policy if exists conf_geral_admin on public.configuracoes_gerais;
create policy conf_geral_admin on public.configuracoes_gerais
  for all to authenticated
  using (public.has_role(auth.uid(),'matriz'))
  with check (public.has_role(auth.uid(),'matriz'));

insert into public.configuracoes_gerais (id) values ('default')
on conflict (id) do nothing;

create or replace function public.conf_geral_touch() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end$$;

drop trigger if exists conf_geral_touch on public.configuracoes_gerais;
create trigger conf_geral_touch
  before update on public.configuracoes_gerais
  for each row execute function public.conf_geral_touch();

-- ------------------------------------------------------------
-- Integrações (registro dinâmico)
-- ------------------------------------------------------------
create table if not exists public.integracoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  status text not null default 'conectado' check (status in ('conectado','desconectado','pendente')),
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now()
);

grant select on public.integracoes to authenticated;
grant all on public.integracoes to service_role;
alter table public.integracoes enable row level security;

drop policy if exists integ_select on public.integracoes;
create policy integ_select on public.integracoes
  for select to authenticated using (true);

drop policy if exists integ_admin on public.integracoes;
create policy integ_admin on public.integracoes
  for all to authenticated
  using (public.has_role(auth.uid(),'matriz'))
  with check (public.has_role(auth.uid(),'matriz'));

insert into public.integracoes (nome, descricao, status, ordem) values
  ('Quiver Mult Cálculo', 'Cotação multi-seguradora', 'conectado', 1),
  ('Disparo de leads (Meta / Google)', 'Entrada automática na Central de Leads', 'conectado', 2)
on conflict do nothing;
