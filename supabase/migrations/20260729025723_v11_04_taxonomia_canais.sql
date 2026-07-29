-- ===========================================================================
-- V11.0.4 (item 9 do Handoff) — taxonomia única de canais
--
-- Item 9: "uma tabela de canais alimenta captação de lead, canais habilitados na
-- aprovação, funis e a Central da Full (que soma os canais próprios dela).
-- Aceite: criar/renomear canal reflete em todos os pontos sem duplicidade."
--
-- O que existe hoje é o oposto disso: `leads.origem` é text livre com check de
-- tamanho, e a tela de Leads monta o filtro coletando os valores distintos das
-- linhas — taxonomia por acidente. Pior, o selo de mídia paga é decidido por
-- regex no texto (`/ads|meta|google/i` em comando/leads.tsx). Renomear um canal
-- hoje não reflete em nada; só cria mais um valor solto.
--
-- Modelagem (CANAIS_LEADS e FULL_CANAIS do protótipo r40):
--
--   canais          — Movida/Google/Facebook/Indicação/Manual/Outro (empresa_id
--                     nulo = canal Supper, da Matriz) + os canais próprios de
--                     cada Franquia Full (empresa_id preenchido).
--   profile_canais  — "de quais canais este acesso recebe (ex.: só Movida)",
--                     definido na aprovação.
--   leads.canal_id  — o canal do lead.
--
-- DOIS EIXOS QUE ESTAVAM MISTURADOS. `leads.origem` guarda tanto canal quanto
-- *como o lead nasceu*: os triggers de cotação gravam 'cotacao' e o cron de
-- renovação grava 'renovacao'. Isso não é canal. Por isso `canais.tipo`:
--
--   supper   — campanha/parceria, tem custo de aquisição da Matriz (entra nos
--              4 funis da Visão geral)
--   manual   — indicação, ligação: o vendedor imputa e vai direto pra cotação,
--              sem Central e sem SLA de 3 min
--   sistema  — o lead nasce de dentro (cotação direta, renovação); não é
--              captação e não deve poluir os funis por canal
--
-- `origem` fica como coluna LEGADA: 8 telas ainda leem para exibir/filtrar e
-- migrá-las é trabalho de front, feito nas frentes que tocam cada tela (funis na
-- Frente 7, Central da Full na Frente 5). A verdade nova é canal_id — quem
-- escreve lead a partir daqui grava os dois.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) A tabela única
-- ---------------------------------------------------------------------------
create table if not exists public.canais (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 2 and 60),
  tipo       text not null check (tipo in ('supper', 'manual', 'sistema')),
  empresa_id uuid references public.empresas(id) on delete cascade,
  ativo      boolean not null default true,
  ordem      smallint not null default 0 check (ordem >= 0),
  criado_em  timestamptz not null default now()
);

comment on table public.canais is
  'V11.0.4 (item 9): taxonomia única de canais de lead. empresa_id nulo = canal
   Supper (da Matriz); preenchido = canal próprio de uma Franquia Full. tipo
   separa captação paga (supper), entrada manual do vendedor (manual) e lead que
   nasce de dentro do sistema (sistema: cotação direta, renovação).';

comment on column public.canais.tipo is
  'supper = campanha/parceria com custo de aquisição, entra nos funis por canal.
   manual = indicação/ligação, sem Central e sem SLA. sistema = nasce de dentro
   (cotacao, renovacao) e NÃO conta como captação.';

-- Unicidade do nome por escopo. Em Postgres NULL é distinto de NULL em UNIQUE,
-- então `unique (empresa_id, nome)` deixaria passar dois canais Supper com o
-- mesmo nome. `nulls not distinct` (PG15+) resolve — e é justamente o "sem
-- duplicidade" do critério de aceite.
create unique index if not exists uq_canais_escopo_nome
  on public.canais (empresa_id, lower(nome)) nulls not distinct;

create index if not exists idx_canais_empresa on public.canais(empresa_id);
create index if not exists idx_canais_tipo on public.canais(tipo) where ativo;

alter table public.canais enable row level security;

revoke all on public.canais from public, anon, authenticated;
grant select on public.canais to authenticated;
grant insert, update, delete on public.canais to authenticated;
grant all on public.canais to service_role;

-- Leitura: canal Supper é visível a todo autenticado (o vendedor precisa saber
-- de que canal veio o lead dele); canal de franquia segue empresas_visiveis.
drop policy if exists canais_select_escopo on public.canais;
create policy canais_select_escopo on public.canais
  for select to authenticated
  using (
    empresa_id is null
    or empresa_id in (select public.empresas_visiveis(auth.uid()))
  );

-- Escrita: canal Supper é da Matriz/Coordenador. Canal próprio é da franquia
-- (a Full cria e remove os dela — xcAddCanal/xcDelCanal no protótipo).
drop policy if exists canais_escrita_matriz_global on public.canais;
create policy canais_escrita_matriz_global on public.canais
  for all to authenticated
  using (
    empresa_id is null
    and (
      public.has_role(auth.uid(), 'matriz')
      or public.has_role(auth.uid(), 'coordenador')
    )
  )
  with check (
    empresa_id is null
    and (
      public.has_role(auth.uid(), 'matriz')
      or public.has_role(auth.uid(), 'coordenador')
    )
  );

drop policy if exists canais_escrita_franquia on public.canais;
create policy canais_escrita_franquia on public.canais
  for all to authenticated
  using (
    empresa_id is not null
    and empresa_id in (select public.empresas_visiveis(auth.uid()))
    and (
      public.has_role(auth.uid(), 'franqueado')
      or public.has_role(auth.uid(), 'matriz')
      or public.has_role(auth.uid(), 'coordenador')
    )
  )
  with check (
    empresa_id is not null
    and empresa_id in (select public.empresas_visiveis(auth.uid()))
    and (
      public.has_role(auth.uid(), 'franqueado')
      or public.has_role(auth.uid(), 'matriz')
      or public.has_role(auth.uid(), 'coordenador')
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Seed dos canais Supper (CANAIS_LEADS do protótipo, na ordem dele)
-- ---------------------------------------------------------------------------
insert into public.canais (nome, tipo, empresa_id, ordem) values
  ('Movida',    'supper', null, 1),
  ('Google',    'supper', null, 2),
  ('Facebook',  'supper', null, 3),
  ('Indicação', 'manual', null, 4),
  ('Manual',    'manual', null, 5),
  ('Outro',     'manual', null, 6),
  -- Os dois eixos que estavam dentro de `origem`: lead que nasce de dentro.
  ('Cotação direta', 'sistema', null, 90),
  ('Renovação',      'sistema', null, 91)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3) Canais habilitados por acesso (definidos na aprovação — V11.2.7)
-- ---------------------------------------------------------------------------
create table if not exists public.profile_canais (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  canal_id   uuid not null references public.canais(id) on delete cascade,
  primary key (profile_id, canal_id)
);

comment on table public.profile_canais is
  'V11.0.4: "de quais canais este acesso recebe" (ex.: vendedor só da Movida),
   definido na aprovação do cadastro. Ausência de linhas = não recebe de canal
   nenhum — é o caso do Master franqueado, que não vende nem recebe leads.';

create index if not exists idx_profile_canais_canal on public.profile_canais(canal_id);

alter table public.profile_canais enable row level security;

revoke all on public.profile_canais from public, anon, authenticated;
grant select on public.profile_canais to authenticated;
grant insert, update, delete on public.profile_canais to authenticated;
grant all on public.profile_canais to service_role;

drop policy if exists profile_canais_select_proprio_ou_gestor on public.profile_canais;
create policy profile_canais_select_proprio_ou_gestor on public.profile_canais
  for select to authenticated
  using (
    profile_id = auth.uid()
    or profile_id in (
      select p.id from public.profiles p
       where p.empresa_id in (select public.empresas_visiveis(auth.uid()))
    )
    or public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
  );

drop policy if exists profile_canais_escrita_gestor on public.profile_canais;
create policy profile_canais_escrita_gestor on public.profile_canais
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
    or (
      -- A Franquia Full habilita canais do time dela (cadastro direto passa
      -- pela configuração — V11.5.5).
      public.has_role(auth.uid(), 'franqueado')
      and profile_id in (
        select p.id from public.profiles p
         where p.empresa_id in (select public.empresas_visiveis(auth.uid()))
      )
    )
  )
  with check (
    public.has_role(auth.uid(), 'matriz')
    or public.has_role(auth.uid(), 'coordenador')
    or (
      public.has_role(auth.uid(), 'franqueado')
      and profile_id in (
        select p.id from public.profiles p
         where p.empresa_id in (select public.empresas_visiveis(auth.uid()))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4) O lead aponta para o canal
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists canal_id uuid
    references public.canais(id) on delete set null;

comment on column public.leads.canal_id is
  'V11.0.4: canal do lead, da taxonomia única. Substitui o texto livre em
   leads.origem, que fica como legado até as telas migrarem.';

comment on column public.leads.origem is
  'LEGADO (V11.0.4): text livre que misturava canal e tipo de nascimento. Não
   usar em código novo — o canal é leads.canal_id. Mantida porque 8 telas ainda
   leem para exibir/filtrar; a migração acontece nas frentes que tocam cada tela.';

create index if not exists idx_leads_canal on public.leads(canal_id);

-- Backfill: casa o texto antigo com o canal de mesmo nome, sem inventar nada.
-- Só toca linhas cujo `origem` corresponde a um canal Supper conhecido.
update public.leads l
   set canal_id = c.id
  from public.canais c
 where l.canal_id is null
   and c.empresa_id is null
   and lower(l.origem) = lower(c.nome);

-- 'cotacao' e 'renovacao' viram os canais de sistema correspondentes.
update public.leads l
   set canal_id = c.id
  from public.canais c
 where l.canal_id is null
   and c.empresa_id is null
   and c.tipo = 'sistema'
   and (
     (lower(l.origem) = 'cotacao'   and c.nome = 'Cotação direta')
     or (lower(l.origem) = 'renovacao' and c.nome = 'Renovação')
   );

-- ---------------------------------------------------------------------------
-- 5) Trigger de normalização: resolve canal_id a partir do texto legado
--
-- Três funções gravam lead hoje (salvar_cotacao_rascunho, criar_leads_renovacao,
-- iniciar_renovacao) e nenhuma conhece canal_id. Redefinir as três aqui
-- duplicaria corpos de função que outras tasks ainda vão mexer — a cópia
-- divergiria na primeira alteração futura. Um trigger de normalização resolve
-- para TODO escritor, inclusive os que vierem depois, e segue o padrão que a
-- lista D já usa para normalizar documentos.
--
-- Código novo deve gravar canal_id direto; isto é a rede de segurança.
-- ---------------------------------------------------------------------------
create or replace function public.fn_leads_resolver_canal()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  _nome_canal text;
begin
  if new.canal_id is not null or new.origem is null then
    return new;
  end if;

  -- Os dois valores que não são canal, e sim tipo de nascimento.
  _nome_canal := case lower(new.origem)
                   when 'cotacao'   then 'Cotação direta'
                   when 'renovacao' then 'Renovação'
                   else new.origem
                 end;

  select c.id into new.canal_id
    from public.canais c
   where c.empresa_id is null
     and lower(c.nome) = lower(_nome_canal)
   limit 1;

  -- Texto que não casa com canal nenhum fica com canal_id nulo de propósito:
  -- melhor um lead sem canal do que um canal inventado (o critério do item 9 é
  -- justamente não criar duplicidade).
  return new;
end;
$function$;

comment on function public.fn_leads_resolver_canal() is
  'V11.0.4: preenche leads.canal_id a partir do texto legado leads.origem quando
   o escritor não informa o canal. Rede de segurança para as funções antigas —
   código novo grava canal_id direto. Texto desconhecido deixa canal_id nulo.';

drop trigger if exists trg_leads_resolver_canal on public.leads;
create trigger trg_leads_resolver_canal
  before insert on public.leads
  for each row execute function public.fn_leads_resolver_canal();
