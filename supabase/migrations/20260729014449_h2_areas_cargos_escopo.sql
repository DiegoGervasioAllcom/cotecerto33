-- ===========================================================================
-- H2/H3/H4 (V11 · hierarquia) — áreas, cargos e escopo ajustável por pessoa
--
-- A V11 recorta o menu do time interno por ÁREA, não por perfil: "cada um recebe
-- o menu recortado pelas áreas marcadas no seu cargo" (fluxo "Acesso e
-- visualização"). E o modal de aprovação dá "cargo (preset) + áreas ajustáveis",
-- ou seja, o preset é ponto de partida e a pessoa pode ter escopo próprio.
--
-- Modelagem espelhando o protótipo V11 r40 (const MATRIZ_AREAS, MATRIZ_AREAS_FUTURO
-- e CARGOS em cotecerto_prototipo_v11.html):
--
--   areas          — catálogo de 17 áreas ativas + 4 "em breve". Chaves iguais às
--                    do protótipo (mdash, mleads, ...) para o front não traduzir.
--   cargos         — 7 presets do protótipo, com id de texto porque a tela
--                    Configurações > Cargos cria e duplica cargos (id 'cg<ts>').
--   cargo_areas    — o preset de escopo de cada cargo.
--   profiles.cargo_id — o cargo da pessoa.
--   profile_areas  — override de escopo por pessoa (as "áreas ajustáveis").
--
-- Resolução: fn_areas_do_usuario devolve o override se a pessoa tiver QUALQUER
-- linha em profile_areas; senão devolve o preset do cargo. Sem cargo e sem
-- override => nenhuma área (não vaza menu).
--
-- Vendedor Matriz (Modelo CLT) fica FORA dos presets de propósito: no protótipo
-- ele é uma opção à parte nas listas de convite/cadastro, não um cargo de escopo.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Catálogo de áreas
-- ---------------------------------------------------------------------------
create table if not exists public.areas (
  chave       text primary key check (char_length(chave) between 2 and 40),
  label       text not null check (char_length(label) between 2 and 60),
  rota        text check (rota is null or char_length(rota) <= 120),
  ordem       smallint not null check (ordem >= 0),
  disponivel  boolean not null default true
);

comment on table public.areas is
  'H2: catálogo de áreas do sistema (unidade de recorte de menu/escopo do time
   interno). Chaves iguais ao protótipo V11 (MATRIZ_AREAS). disponivel=false são
   as áreas "em breve" (Marketing/Financeiro/Compras/Facilities) — existem para
   um cargo poder referenciá-las antes de a tela existir.';

comment on column public.areas.rota is
  'Rota do TanStack Router correspondente. NULL nas áreas "em breve" (sem tela).';

alter table public.areas enable row level security;

revoke all on public.areas from public, anon, authenticated;
grant select on public.areas to authenticated;
grant all on public.areas to service_role;

-- Catálogo é leitura livre para autenticado (mesmo padrão de seguradoras);
-- escrita só via service_role (o catálogo é fixo — cargos é que são editáveis).
drop policy if exists areas_select_autenticado on public.areas;
create policy areas_select_autenticado on public.areas
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 2) Cargos (presets de escopo)
-- ---------------------------------------------------------------------------
create table if not exists public.cargos (
  id            text primary key check (char_length(id) between 2 and 40),
  nome          text not null check (char_length(nome) between 2 and 60),
  descricao     text check (descricao is null or char_length(descricao) <= 300),
  preset        boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.cargos is
  'H3: cargos do time interno da Matriz. Os 7 do protótipo V11 nascem com
   preset=true; a tela Configuracoes > Cargos cria/duplica os demais (preset=false).
   Vendedor Matriz (Modelo CLT) NÃO é cargo — é opção à parte de convite/cadastro.';

alter table public.cargos enable row level security;

revoke all on public.cargos from public, anon, authenticated;
grant select on public.cargos to authenticated;
grant insert, update, delete on public.cargos to authenticated;
grant all on public.cargos to service_role;

drop policy if exists cargos_select_autenticado on public.cargos;
create policy cargos_select_autenticado on public.cargos
  for select to authenticated
  using (true);

-- Escrita: Matriz e Coordenador (as duas únicas experiências com Configurações
-- no menu, conforme const MENUS do protótipo). A trava de diretor é da V11.0.5.
drop policy if exists cargos_escrita_matriz on public.cargos;
create policy cargos_escrita_matriz on public.cargos
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
  )
  with check (
    public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
  );

-- ---------------------------------------------------------------------------
-- 3) cargo_areas — o preset de escopo
-- ---------------------------------------------------------------------------
create table if not exists public.cargo_areas (
  cargo_id   text not null references public.cargos(id) on delete cascade,
  area_chave text not null references public.areas(chave) on delete cascade,
  primary key (cargo_id, area_chave)
);

comment on table public.cargo_areas is
  'H3: áreas que compõem o preset de um cargo. É ponto de partida — o escopo
   efetivo da pessoa pode ser sobrescrito em profile_areas (H4).';

create index if not exists idx_cargo_areas_area on public.cargo_areas(area_chave);

alter table public.cargo_areas enable row level security;

revoke all on public.cargo_areas from public, anon, authenticated;
grant select on public.cargo_areas to authenticated;
grant insert, update, delete on public.cargo_areas to authenticated;
grant all on public.cargo_areas to service_role;

drop policy if exists cargo_areas_select_autenticado on public.cargo_areas;
create policy cargo_areas_select_autenticado on public.cargo_areas
  for select to authenticated
  using (true);

drop policy if exists cargo_areas_escrita_matriz on public.cargo_areas;
create policy cargo_areas_escrita_matriz on public.cargo_areas
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
  )
  with check (
    public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
  );

-- ---------------------------------------------------------------------------
-- 4) profiles.cargo_id
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists cargo_id text
    references public.cargos(id) on delete set null;

comment on column public.profiles.cargo_id is
  'H3: cargo do time interno. NULL para quem não é interno (master, franqueado,
   vendedor) e para o Vendedor Matriz, que não tem cargo de escopo.';

create index if not exists idx_profiles_cargo_id on public.profiles(cargo_id);

-- ---------------------------------------------------------------------------
-- 5) profile_areas — override de escopo por pessoa ("áreas ajustáveis")
-- ---------------------------------------------------------------------------
create table if not exists public.profile_areas (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  area_chave text not null references public.areas(chave) on delete cascade,
  primary key (profile_id, area_chave)
);

comment on table public.profile_areas is
  'H4: escopo próprio da pessoa, definido na aprovação ("cargo + áreas
   ajustáveis"). Presença de QUALQUER linha aqui substitui o preset do cargo
   por completo — não é união. Ausência total = usa o preset.';

create index if not exists idx_profile_areas_area on public.profile_areas(area_chave);

alter table public.profile_areas enable row level security;

revoke all on public.profile_areas from public, anon, authenticated;
grant select on public.profile_areas to authenticated;
grant insert, update, delete on public.profile_areas to authenticated;
grant all on public.profile_areas to service_role;

-- Leitura: a própria pessoa (o front monta o menu dela) + quem administra acesso.
drop policy if exists profile_areas_select_proprio_ou_gestor on public.profile_areas;
create policy profile_areas_select_proprio_ou_gestor on public.profile_areas
  for select to authenticated
  using (
    profile_id = auth.uid()
    or public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
  );

drop policy if exists profile_areas_escrita_matriz on public.profile_areas;
create policy profile_areas_escrita_matriz on public.profile_areas
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
  )
  with check (
    public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
  );

-- ---------------------------------------------------------------------------
-- 6) Seed do catálogo — 17 ativas, na ordem do menu do protótipo
-- ---------------------------------------------------------------------------
insert into public.areas (chave, label, rota, ordem, disponivel) values
  ('mdash',    'Visão geral',           '/comando/visao-geral',     1,  true),
  ('mleads',   'Leads',                 '/comando/leads',           2,  true),
  ('mdist',    'Distribuição',          '/comando/distribuicao',    3,  true),
  ('maprov',   'Aprovações',            '/operacao/aprovacoes',     4,  true),
  ('mfranq',   'Franquias',             '/operacao/franquias',      5,  true),
  ('mvend',    'Vendedores',            '/operacao/vendedores',     6,  true),
  ('msuperv',  'Supervisão',            '/operacao/supervisao',     7,  true),
  ('mpipe',    'Pipeline geral',        '/operacao/pipeline-geral', 8,  true),
  ('mvendas',  'Vendas',                '/operacao/vendas',         9,  true),
  ('mcomm',    'Comissões',             '/operacao/comissoes',      10, true),
  ('mprem',    'Premiações',            '/operacao/premiacoes',     11, true),
  ('mestorno', 'Estornos',              '/operacao/estornos',       12, true),
  ('mren',     'Renovações',            '/operacao/renovacoes',     13, true),
  ('mrel',     'Relatórios',            '/operacao/relatorios',     14, true),
  ('mmsgs',    'Mensagens',             '/operacao/mensagens',      15, true),
  ('macessos', 'Acessos e permissões',  '/operacao/acessos',        16, true),
  ('mconf',    'Configurações',         '/operacao/configuracoes',  17, true),
  -- "em breve" (MATRIZ_AREAS_FUTURO): sem rota, mas referenciáveis por cargo.
  ('mkt',        'Marketing',   null, 18, false),
  ('fin',        'Financeiro',  null, 19, false),
  ('compras',    'Compras',     null, 20, false),
  ('facilities', 'Facilities',  null, 21, false)
on conflict (chave) do update
  set label = excluded.label,
      rota = excluded.rota,
      ordem = excluded.ordem,
      disponivel = excluded.disponivel;

-- ---------------------------------------------------------------------------
-- 7) Seed dos 7 cargos preset (const CARGOS do protótipo r40)
-- ---------------------------------------------------------------------------
insert into public.cargos (id, nome, descricao, preset) values
  ('matriz_total',     'Direção',
   'Acesso total ao CRM, configurações, usuários, relatórios, comissões e todas as carteiras.', true),
  ('coord_com',        'Coordenador Comercial',
   'Acesso geral: todas as áreas da Matriz (regra 5).', true),
  ('sup_vendas',       'Supervisor de Vendas',
   'Tudo do time de vendas (Vendedor Matriz e Franquia Individual), incluindo as Aprovações de desconto (regra 5).', true),
  ('sup_operacional',  'Supervisor Operacional',
   'Foco operacional: Leads, Distribuição e Acessos e permissões (regra 5).', true),
  ('sup_backoffice',   'Supervisor Backoffice',
   'Distribuição de leads, vendas de todos os canais e pendências de emissão.', true),
  ('assist_com',       'Assistente Comercial',
   'Acompanha vendas de todos os canais e pendências de emissão.', true),
  ('marketing',        'Marketing',
   'Distribuição de leads, relatório de campanhas e de performance.', true)
on conflict (id) do update
  set nome = excluded.nome,
      descricao = excluded.descricao,
      preset = excluded.preset,
      atualizado_em = now();

-- Presets de escopo. Direção e Coordenador recebem as 17 áreas ATIVAS
-- (ALL_AREA_KEYS do protótipo = MATRIZ_AREAS, sem as "em breve").
insert into public.cargo_areas (cargo_id, area_chave)
select c.id, a.chave
  from public.cargos c
  cross join public.areas a
 where c.id in ('matriz_total', 'coord_com')
   and a.disponivel
on conflict do nothing;

insert into public.cargo_areas (cargo_id, area_chave) values
  -- ATENÇÃO: esta lista segue o protótipo r40, que NÃO inclui 'mestorno' para o
  -- Supervisor de Vendas, embora const MENUS dos Fluxos liste "Estornos" para ele.
  -- Divergência registrada em docs/ANALISE_LACUNAS_V11.md — resolver com a Lis.
  ('sup_vendas', 'mdash'),   ('sup_vendas', 'maprov'), ('sup_vendas', 'mvend'),
  ('sup_vendas', 'msuperv'), ('sup_vendas', 'mpipe'),  ('sup_vendas', 'mvendas'),
  ('sup_vendas', 'mcomm'),   ('sup_vendas', 'mprem'),  ('sup_vendas', 'mren'),
  ('sup_vendas', 'mrel'),

  ('sup_operacional', 'mdash'), ('sup_operacional', 'mleads'),
  ('sup_operacional', 'mdist'), ('sup_operacional', 'macessos'),

  ('sup_backoffice', 'mdash'),  ('sup_backoffice', 'mleads'),
  ('sup_backoffice', 'mdist'),  ('sup_backoffice', 'mpipe'),
  ('sup_backoffice', 'mvendas'),

  ('assist_com', 'mdash'), ('assist_com', 'mvendas'), ('assist_com', 'mpipe'),

  ('marketing', 'mdash'), ('marketing', 'mleads'), ('marketing', 'mdist'),
  ('marketing', 'mrel'),  ('marketing', 'mkt')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 8) Resolução do escopo efetivo
-- ---------------------------------------------------------------------------
create or replace function public.fn_areas_do_usuario(_user_id uuid)
  returns table(area_chave text)
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $function$
begin
  -- A função é security definer (precisa ler profile_areas/cargo_areas por cima
  -- da RLS), então ela mesma tem de barrar enumeração: perguntar pelo escopo de
  -- OUTRA pessoa só é permitido a quem administra acesso. Sem isso, qualquer
  -- autenticado descobriria o menu de qualquer colega.
  if _user_id <> auth.uid()
     and not (
       public.has_role(auth.uid(), 'matriz')
       or public.has_role(auth.uid(), 'coordenador')
     ) then
    return;
  end if;

  -- Matriz enxerga tudo o que existe, sem depender de cargo.
  if public.has_role(_user_id, 'matriz') then
    return query select a.chave from public.areas a where a.disponivel;
    return;
  end if;

  -- Override por pessoa: se houver QUALQUER linha, ela substitui o preset.
  if exists (select 1 from public.profile_areas pa where pa.profile_id = _user_id) then
    return query
      select pa.area_chave from public.profile_areas pa where pa.profile_id = _user_id;
    return;
  end if;

  -- Senão, o preset do cargo. Sem cargo => nenhuma área.
  return query
    select ca.area_chave
      from public.profiles p
      join public.cargo_areas ca on ca.cargo_id = p.cargo_id
     where p.id = _user_id;
end;
$function$;

comment on function public.fn_areas_do_usuario(uuid) is
  'H4: escopo efetivo de áreas. Matriz = todas as ativas; senão override de
   profile_areas se existir; senão preset do cargo; sem cargo = vazio.
   Perguntar pelo escopo de outra pessoa exige ser matriz/coordenador — sem isso
   a função (security definer) permitiria enumerar o menu de qualquer usuário.';

revoke all on function public.fn_areas_do_usuario(uuid) from public, anon;
grant execute on function public.fn_areas_do_usuario(uuid) to authenticated;

create or replace function public.fn_tem_area(_user_id uuid, _area text)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select exists (
    select 1 from public.fn_areas_do_usuario(_user_id) a where a.area_chave = _area
  );
$function$;

comment on function public.fn_tem_area(uuid, text) is
  'H4: atalho booleano de fn_areas_do_usuario, para policy e para o gate de menu.
   Lembrar da regra 7 do AGENTS.md: o gate visual não é segurança — a policy é.';

revoke all on function public.fn_tem_area(uuid, text) from public, anon;
grant execute on function public.fn_tem_area(uuid, text) to authenticated;
