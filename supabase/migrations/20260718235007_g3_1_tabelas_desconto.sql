-- ===========================================================================
-- G3.1 — Tabelas do fluxo de desconto adicional multinível
--
-- Schema apenas (RLS + grants). As RPCs de solicitar/aprovar/escalar são o
-- PR2 (G3.2+) — aqui não há função de fluxo, só a tabela + policies fechadas
-- (insert/update de desconto_solicitacoes e desconto_trilha só via RPC
-- security definer, que ainda não existe).
--
-- 4 tabelas:
--   1) desconto_politicas    — alçada % máx por modelo x seguradora (config).
--   2) desconto_solicitacoes — o pedido de desconto, escalando pela rede.
--   3) desconto_trilha       — auditoria append-only do pedido.
--   4) respostas_padrao      — textos de resposta rápida (G3.6).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) desconto_politicas — alçada configurada pela Matriz. Nasce VAZIA (sem
--    seed): a ausência de linha para um modelo x seguradora é lógica de
--    negócio (a RPC do PR2 escala direto à Matriz nesse caso).
-- ---------------------------------------------------------------------------
create table if not exists public.desconto_politicas (
  id uuid primary key default gen_random_uuid(),
  modelo text not null
    check (modelo in ('franquia_individual', 'franquia_full', 'master', 'supervisor')),
  seguradora_id uuid not null references public.seguradoras(id) on delete cascade,
  pct_maximo numeric(5, 2) not null check (pct_maximo >= 0 and pct_maximo <= 100),
  condicoes text check (condicoes is null or char_length(condicoes) <= 300),
  atualizado_em timestamptz not null default now(),
  unique (modelo, seguradora_id)
);

comment on table public.desconto_politicas is
  'G3.1: alçada de desconto (% máximo) por modelo de rede x seguradora, configurada
   pela Matriz. Nasce vazia — ausência de linha para um par (modelo, seguradora_id)
   significa que o pedido escala direto à Matriz (lógica da RPC no G3.2, não daqui).';

alter table public.desconto_politicas enable row level security;

revoke all on public.desconto_politicas from public, anon, authenticated;
grant select on public.desconto_politicas to authenticated;
grant insert, update, delete on public.desconto_politicas to authenticated;
grant all on public.desconto_politicas to service_role;

drop policy if exists desconto_politicas_select on public.desconto_politicas;
create policy desconto_politicas_select
  on public.desconto_politicas
  for select
  to authenticated
  using (true);

drop policy if exists desconto_politicas_write_matriz on public.desconto_politicas;
create policy desconto_politicas_write_matriz
  on public.desconto_politicas
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'matriz'))
  with check (public.has_role(auth.uid(), 'matriz'));

comment on policy desconto_politicas_write_matriz on public.desconto_politicas is
  'Grant amplo (insert/update/delete a authenticated) + policy matriz-only é a
   barreira real (padrão comissao_regras/G4.1 — 20260718022643).';

-- ---------------------------------------------------------------------------
-- 2) desconto_solicitacoes — o pedido de desconto adicional, escalando pela
--    hierarquia (nivel_atual) até a Matriz.
--
--    RLS (CRÍTICO — inbox não pode vazar entre redes): SELECT permitido se
--    o usuário é o solicitante, é quem tem o pedido pendente agora
--    (nivel_atual), é matriz, OU o solicitante está na rede visível dele
--    (mesmo padrão de vendedor_solicitacoes/G1.6c: solicitante_id em
--    empresas_visiveis()). Um aprovador comum só vê o que está pendente PRA
--    ELE (nivel_atual) ou dentro da própria rede (empresas_visiveis) — nunca
--    o inbox de uma rede paralela.
--
--    INSERT/UPDATE: sem policy — fechado, só via RPC security definer (PR2).
-- ---------------------------------------------------------------------------
create table if not exists public.desconto_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cotacoes(id) on delete cascade,
  solicitante_id uuid not null references public.profiles(id),
  nivel_atual uuid references public.profiles(id),
  seguradora_id uuid not null references public.seguradoras(id),
  pct_pedido numeric(5, 2) not null check (pct_pedido >= 0 and pct_pedido <= 100),
  pct_concedido numeric(5, 2) check (pct_concedido is null or (pct_concedido >= 0 and pct_concedido <= 100)),
  status text not null default 'pendente'
    check (status in ('pendente', 'aguardando_aceite', 'aprovado', 'negado', 'cancelado')),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);

comment on table public.desconto_solicitacoes is
  'G3.1: pedido de desconto adicional em uma cotação, por seguradora, escalando
   pela hierarquia (nivel_atual = a quem está pendente agora). Resolução do
   fluxo (aprovar/negar/escalar/contrapropor) é RPC security definer do G3.2 —
   sem policy de insert/update aqui.';

alter table public.desconto_solicitacoes enable row level security;

revoke all on public.desconto_solicitacoes from public, anon, authenticated;
grant select on public.desconto_solicitacoes to authenticated;
grant all on public.desconto_solicitacoes to service_role;

drop policy if exists desconto_solicitacoes_select on public.desconto_solicitacoes;
create policy desconto_solicitacoes_select
  on public.desconto_solicitacoes
  for select
  to authenticated
  using (
    solicitante_id = auth.uid()
    or nivel_atual = auth.uid()
    or public.has_role(auth.uid(), 'matriz')
    or exists (
      select 1
        from public.profiles p
       where p.id = desconto_solicitacoes.solicitante_id
         and p.empresa_id in (select public.empresas_visiveis(auth.uid()))
    )
  );

comment on policy desconto_solicitacoes_select on public.desconto_solicitacoes is
  'Anti-vazamento de inbox: solicitante e nivel_atual (a quem o pedido está
   pendente AGORA) sempre veem; matriz vê tudo; demais só veem se o solicitante
   está na própria rede visível (empresas_visiveis) — um aprovador de outra
   rede não enxerga pedidos que não são dele nem da sua subárvore.';

-- Sem policy de insert/update: escrita fechada, só via RPC security definer (PR2).

-- ---------------------------------------------------------------------------
-- 3) desconto_trilha — auditoria append-only do pedido.
-- ---------------------------------------------------------------------------
create table if not exists public.desconto_trilha (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.desconto_solicitacoes(id) on delete cascade,
  autor_id uuid references public.profiles(id),
  acao text not null
    check (acao in ('solicitou', 'aprovou', 'contrapropos', 'negou', 'escalou', 'aceitou', 'cancelou')),
  pct numeric(5, 2) check (pct is null or (pct >= 0 and pct <= 100)),
  observacao text check (observacao is null or char_length(observacao) <= 500),
  criado_em timestamptz not null default now()
);

comment on table public.desconto_trilha is
  'G3.1: trilha de auditoria append-only de um pedido de desconto. Insert só
   via RPC security definer do G3.2 (junto com a mudança de status/nivel_atual
   em desconto_solicitacoes, na mesma transação).';

alter table public.desconto_trilha enable row level security;

revoke all on public.desconto_trilha from public, anon, authenticated;
grant select on public.desconto_trilha to authenticated;
grant all on public.desconto_trilha to service_role;

drop policy if exists desconto_trilha_select on public.desconto_trilha;
create policy desconto_trilha_select
  on public.desconto_trilha
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.desconto_solicitacoes s
       where s.id = desconto_trilha.solicitacao_id
         and (
           s.solicitante_id = auth.uid()
           or s.nivel_atual = auth.uid()
           or public.has_role(auth.uid(), 'matriz')
           or exists (
             select 1
               from public.profiles p
              where p.id = s.solicitante_id
                and p.empresa_id in (select public.empresas_visiveis(auth.uid()))
           )
         )
    )
  );

comment on policy desconto_trilha_select on public.desconto_trilha is
  'Mesma regra de visibilidade da solicitação-pai (não-vazamento de inbox) —
   quem pode ver a solicitação vê a trilha dela. Insert fechado (só RPC).';

-- ---------------------------------------------------------------------------
-- 4) respostas_padrao — textos de resposta rápida (G3.6).
-- ---------------------------------------------------------------------------
create table if not exists public.respostas_padrao (
  id uuid primary key default gen_random_uuid(),
  seguradora_id uuid references public.seguradoras(id) on delete cascade,
  titulo text not null check (char_length(titulo) > 0 and char_length(titulo) <= 100),
  texto text not null check (char_length(texto) > 0 and char_length(texto) <= 1000),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table public.respostas_padrao is
  'G3.1: textos de resposta rápida do fluxo de desconto (G3.6). seguradora_id
   nulo = resposta geral (não específica de uma seguradora).';

alter table public.respostas_padrao enable row level security;

revoke all on public.respostas_padrao from public, anon, authenticated;
grant select on public.respostas_padrao to authenticated;
grant insert, update, delete on public.respostas_padrao to authenticated;
grant all on public.respostas_padrao to service_role;

drop policy if exists respostas_padrao_select on public.respostas_padrao;
create policy respostas_padrao_select
  on public.respostas_padrao
  for select
  to authenticated
  using (true);

drop policy if exists respostas_padrao_write_matriz on public.respostas_padrao;
create policy respostas_padrao_write_matriz
  on public.respostas_padrao
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'matriz'))
  with check (public.has_role(auth.uid(), 'matriz'));
