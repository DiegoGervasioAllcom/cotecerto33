-- ===========================================================================
-- G5.1 — Premiações (schema + RLS)
--
-- 100% separado das campanhas Elite do G4 (comissao_regras/campanhas_elite/
-- fechar_campanha_elite) — aqui são premiações de seguradora/cartão/metas
-- externas, lançadas manualmente pela Matriz ("quem ganhou e o que falta
-- pagar"). Sem cálculo automático de ganhador nesta fatia.
--
-- - premiacao_campanhas: cadastro da campanha (seguradora opcional; null =
--   geral/interna).
-- - premiacao_lancamentos: quem ganhou quanto, status pago/a_pagar.
--
-- Escrita só Matriz. Leitura: Matriz vê tudo; vendedor vê os seus
-- lançamentos; grupo (master/franquia) vê os lançamentos da própria rede
-- via empresas_visiveis() — sem vazar entre redes.
-- ===========================================================================

-- ---------- premiacao_campanhas ----------

create table if not exists public.premiacao_campanhas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) >= 1 and char_length(nome) <= 150),
  seguradora_id uuid references public.seguradoras (id),
  competencia text check (competencia is null or competencia ~ '^\d{4}-\d{2}$'),
  descricao text check (descricao is null or char_length(descricao) <= 300),
  ativa boolean not null default true,
  criado_por uuid references public.profiles (id),
  criado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.premiacao_campanhas to authenticated;
grant all on public.premiacao_campanhas to service_role;

alter table public.premiacao_campanhas enable row level security;

drop policy if exists premiacao_campanhas_select on public.premiacao_campanhas;
create policy premiacao_campanhas_select on public.premiacao_campanhas
  for select to authenticated using (true);

drop policy if exists premiacao_campanhas_admin on public.premiacao_campanhas;
create policy premiacao_campanhas_admin on public.premiacao_campanhas
  for all to authenticated
  using (public.has_role(auth.uid(), 'matriz'))
  with check (public.has_role(auth.uid(), 'matriz'));

-- ---------- premiacao_lancamentos ----------

create table if not exists public.premiacao_lancamentos (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.premiacao_campanhas (id) on delete cascade,
  vendedor_id uuid not null references public.profiles (id),
  empresa_id uuid references public.empresas (id),
  competencia text check (competencia is null or competencia ~ '^\d{4}-\d{2}$'),
  valor numeric(12, 2) not null check (valor >= 0),
  status text not null default 'a_pagar' check (status in ('a_pagar', 'pago')),
  pago_em timestamptz,
  observacao text check (observacao is null or char_length(observacao) <= 500),
  criado_por uuid references public.profiles (id),
  criado_em timestamptz not null default now()
);

create index if not exists premiacao_lancamentos_campanha_id_idx
  on public.premiacao_lancamentos (campanha_id);
create index if not exists premiacao_lancamentos_vendedor_id_idx
  on public.premiacao_lancamentos (vendedor_id);
create index if not exists premiacao_lancamentos_empresa_competencia_idx
  on public.premiacao_lancamentos (empresa_id, competencia);
create index if not exists premiacao_lancamentos_status_idx
  on public.premiacao_lancamentos (status);

grant select, insert, update, delete on public.premiacao_lancamentos to authenticated;
grant all on public.premiacao_lancamentos to service_role;

alter table public.premiacao_lancamentos enable row level security;

-- Matriz vê tudo; o vendedor vê os seus; o grupo vê os da própria rede
-- (empresa_id em empresas_visiveis(auth.uid())) — sem vazar entre redes.
drop policy if exists premiacao_lancamentos_select on public.premiacao_lancamentos;
create policy premiacao_lancamentos_select on public.premiacao_lancamentos
  for select to authenticated using (
    public.has_role(auth.uid(), 'matriz')
    or vendedor_id = auth.uid()
    or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
  );

drop policy if exists premiacao_lancamentos_admin on public.premiacao_lancamentos;
create policy premiacao_lancamentos_admin on public.premiacao_lancamentos
  for all to authenticated
  using (public.has_role(auth.uid(), 'matriz'))
  with check (public.has_role(auth.uid(), 'matriz'));

-- ---------- Seed opcional (dev local) ----------
-- Comentado por padrão; a tela nasce vazia e a Matriz cadastra. Descomente
-- se quiser uma campanha de exemplo em ambiente local:
--
-- insert into public.premiacao_campanhas (nome, competencia, descricao)
-- select 'Campanha Exemplo', to_char(now(), 'YYYY-MM'), 'Seed de desenvolvimento'
-- where not exists (select 1 from public.premiacao_campanhas where nome = 'Campanha Exemplo');
