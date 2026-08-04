-- ===========================================================================
-- V11.5.8 (Frente 5 — Franquia Full) — comissão por origem do lead
--
-- Regra 9 das "Regras Decididas" (Lis, 26/07/2026): "Lead captado pelo canal
-- próprio da Full tem regra de comissionamento diferente do lead repassado
-- pela Matriz. Essa regra é definida pela Matriz, nas configurações — não
-- pela franquia." Confirmado por grep em toda migration de comissão (G4):
-- hoje NADA olha `leads.canal_id`/origem no cálculo — só `empresas.
-- perc_comissao -> modelos_franquia.perc_comissao_padrao -> 16` (fallback),
-- resolvido por `fn_pct_comissao_efetivo` (048/g4_2).
--
-- ONDE A COMISSÃO POR PROPOSTA É EFETIVAMENTE DETERMINADA (lido antes de
-- desenhar, como pedido): NÃO é `fechar_comissao_competencia` (050/g4_4) — essa
-- RPC é o fechamento MENSAL (royalties, ajuste CLT, overrides de master/
-- supervisor); ela nunca calcula o % de uma proposta individual. Quem calcula
-- por proposta é o trigger `_sync_comissao_lancamento` (credita ao marcar
-- `pago_em`) e a RPC `marcar_apolice_emitida` (grava `comissao_pct`/
-- `comissao_valor` na transmissão) — ambas em 048/g4_2, ambas já usando
-- `fn_pct_comissao_efetivo` pra não duplicar a regra em dois lugares.
--
-- ESCOPO ENTREGUE NESTA MIGRATION (decisão consciente, ver plano V11.5.8 risco
-- 3): a CONFIGURAÇÃO (passo 1) + a FUNÇÃO DE RESOLUÇÃO por origem (passo 2),
-- isoladas e testadas — SEM tocar `_sync_comissao_lancamento`/
-- `marcar_apolice_emitida`. Esses dois já rodam em produção creditando dinheiro
-- de verdade a cada proposta paga; trocar a chamada de `fn_pct_comissao_efetivo`
-- por uma variante origem-aware ali dentro é a integração completa, e merece
-- task própria com teste de regressão do motor de comissão inteiro (G4), não
-- um encaixe forçado dentro desta fatia. `fn_pct_comissao_por_origem` abaixo
-- foi desenhada de propósito para ser o *drop-in* dessa integração futura: um
-- `select pct from fn_pct_comissao_por_origem(new.empresa_id, (select canal_id
-- from public.leads where id = new.lead_id))` no lugar do `select pct, fonte
-- from fn_pct_comissao_efetivo(new.empresa_id)` já resolveria — quando essa
-- task acontecer.
--
-- MODELO:
--   comissao_origem_config  — 2 linhas possíveis, chave = origem ('proprio' |
--                              'repassado'). `ativo` por linha: a Matriz pode
--                              cadastrar o valor SEM ligar o comportamento
--                              ainda (default `ativo=false`) — feature opt-in,
--                              não muda nada em produção até a Matriz decidir.
--   fn_origem_lead(canal_id) — 'proprio' | 'repassado' | NULL (canal
--                              inexistente/não informado — ambíguo, não
--                              inventamos origem). Reusa `canais.empresa_id`
--                              (004/taxonomia_canais): NULL = canal Supper/
--                              Matriz = repassado; preenchido = canal próprio
--                              de uma Full = proprio. Não cria coluna nova.
--   fn_pct_comissao_por_origem(empresa, canal) — pct + fonte, a função de
--                              resolução isolada.
--   fn_salvar_comissao_origem(...) — única porta de escrita, só Matriz (regra
--                              9 é explícita: "definida pela Matriz... não
--                              pela franquia" — sem abertura pra Coordenador
--                              aqui, diferente de outras configs desta frente,
--                              porque a frase da Lis nomeia só a Matriz).
--
-- BLAST RADIUS (decisão de design mais importante desta migration):
-- `fn_pct_comissao_por_origem` só aplica o override quando `p_empresa_id` é
-- modalidade FULL (`fn_bloco_performance(empresa) = 'full'`, D5 — mesma
-- derivação usada em V11.5.3, sem duplicar). Fora do contexto Full (franquia
-- individual, CLT, Master etc.) a função devolve o % normal de
-- `fn_pct_comissao_efetivo`, ignorando `comissao_origem_config` por completo.
-- Justificativa: "canal próprio DA FULL x repassado PELA MATRIZ" só tem
-- significado de negócio dentro da operação de uma Full — fora dela, a
-- maioria das propostas do sistema hoje nasce de canal `empresa_id IS NULL`
-- (Supper/repassado) só porque a distinção própria/repassado não existia até
-- a Frente 5; ligar o override globalmente mudaria retroativamente o valor de
-- comissão de TODA a base pra uma mudança pedida especificamente pra Full.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabela: parâmetro de comissão por origem (Matriz configura)
-- ---------------------------------------------------------------------------
create table if not exists public.comissao_origem_config (
  origem         text primary key check (origem in ('proprio', 'repassado')),
  pct            numeric(6,3) not null check (pct >= 0 and pct <= 100),
  ativo          boolean not null default false,
  descricao      text check (descricao is null or char_length(descricao) <= 300),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);

comment on table public.comissao_origem_config is
  'V11.5.8 (regra 9): % de comissão por origem do lead (proprio = canal da
   própria Full via canais.empresa_id; repassado = canal Supper/Matriz,
   canais.empresa_id NULL), só aplicável dentro do contexto de uma Franquia
   Full (ver fn_pct_comissao_por_origem). ativo=false (default) = configurado
   mas sem efeito ainda — liga só quando a Matriz decidir. Escrita só via
   fn_salvar_comissao_origem; sem grant de insert/update/delete pra
   authenticated.';

grant select on public.comissao_origem_config to authenticated;
grant all on public.comissao_origem_config to service_role;

alter table public.comissao_origem_config enable row level security;

-- Select liberado a qualquer authenticated: mesmo padrão das outras tabelas de
-- regra de comissão já em produção (comissao_regras/campanhas_elite, 047) —
-- o vendedor/franquia precisa poder ver a regra vigente, só não escrevê-la.
drop policy if exists comissao_origem_config_select on public.comissao_origem_config;
create policy comissao_origem_config_select on public.comissao_origem_config
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2) fn_origem_lead — 'proprio' | 'repassado' | NULL, a partir do canal.
--    Reusa canais.empresa_id (004) — NÃO cria coluna nova de origem.
-- ---------------------------------------------------------------------------
create or replace function public.fn_origem_lead(p_canal_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when c.empresa_id is not null then 'proprio' else 'repassado' end
    from public.canais c
   where c.id = p_canal_id;
$$;

comment on function public.fn_origem_lead(uuid) is
  'V11.5.8: origem do lead pela taxonomia única de canais (004) —
   canais.empresa_id preenchido = proprio (canal da própria Full);
   canais.empresa_id NULL = repassado (canal Supper/Matriz). p_canal_id NULL
   ou inexistente -> NULL (ambíguo; não inventa origem).';

revoke all on function public.fn_origem_lead(uuid) from public, anon;
grant execute on function public.fn_origem_lead(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) fn_pct_comissao_por_origem — a função de resolução isolada.
--    security definer + EXECUTE revogado de authenticated: mesmo tratamento
--    de fn_pct_comissao_efetivo (048/g4_2) — devolve o % NEGOCIADO de uma
--    empresa (via fallback), e isso não é pra vazar por RPC direta pra
--    qualquer authenticated sondar o % de qualquer empresa. Uso é interno
--    (trigger/RPC futuros), chamada só por service_role ou por outra function
--    security definer (que herda o owner, não o grant do caller).
-- ---------------------------------------------------------------------------
create or replace function public.fn_pct_comissao_por_origem(
  p_empresa_id uuid,
  p_canal_id uuid
)
returns table(pct numeric, fonte text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _origem text;
  _pct_override numeric;
begin
  -- Fora do contexto Full: ignora comissao_origem_config por completo (ver
  -- nota de "blast radius" no cabeçalho da migration).
  if coalesce(public.fn_bloco_performance(p_empresa_id), '') is distinct from 'full' then
    return query select r.pct, r.fonte from public.fn_pct_comissao_efetivo(p_empresa_id) r;
    return;
  end if;

  _origem := public.fn_origem_lead(p_canal_id);

  if _origem is not null then
    select o.pct into _pct_override
      from public.comissao_origem_config o
     where o.origem = _origem
       and o.ativo = true;

    if _pct_override is not null then
      return query select _pct_override, ('origem_' || _origem)::text;
      return;
    end if;
  end if;

  -- Sem override ativo pra essa origem (ou origem indeterminada): comporta-se
  -- exatamente como hoje, sem regressão pra quem nunca configurou nada.
  return query select r.pct, r.fonte from public.fn_pct_comissao_efetivo(p_empresa_id) r;
end;
$$;

comment on function public.fn_pct_comissao_por_origem(uuid, uuid) is
  'V11.5.8 (regra 9): % de comissão efetivo considerando origem do lead —
   só dentro do contexto de uma Franquia Full (fn_bloco_performance = full);
   fora dela, devolve fn_pct_comissao_efetivo sem alteração. Dentro do
   contexto Full: aplica comissao_origem_config.pct da origem resolvida
   (fn_origem_lead) SE existir linha ativa; senão cai no % normal
   (fn_pct_comissao_efetivo). NÃO É consumida ainda por
   _sync_comissao_lancamento/marcar_apolice_emitida (integração completa é
   task própria — ver cabeçalho). EXECUTE revogado de public/anon/authenticated
   pelo mesmo motivo de fn_pct_comissao_efetivo (vaza % negociado por empresa).';

revoke all on function public.fn_pct_comissao_por_origem(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_pct_comissao_por_origem(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4) fn_salvar_comissao_origem — única porta de escrita, só Matriz.
-- ---------------------------------------------------------------------------
create or replace function public.fn_salvar_comissao_origem(
  p_origem text,
  p_pct numeric,
  p_ativo boolean default true,
  p_descricao text default null
)
returns public.comissao_origem_config
language plpgsql
security definer
set search_path = public
as $$
declare
  _linha public.comissao_origem_config;
begin
  -- Regra 9 é explícita: "definida pela Matriz... não pela franquia". Sem
  -- abertura pra Coordenador aqui de propósito (diferente de outras RPCs
  -- desta frente) — a frase da Lis nomeia só a Matriz.
  if not public.has_role(auth.uid(), 'matriz') then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  if p_origem is null or p_origem not in ('proprio', 'repassado') then
    raise exception using
      errcode = '22023',
      message = 'origem_invalida',
      hint = 'use ''proprio'' ou ''repassado''.';
  end if;

  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception using errcode = '22023', message = 'pct_fora_da_faixa';
  end if;

  if p_descricao is not null and char_length(p_descricao) > 300 then
    raise exception using errcode = '22023', message = 'descricao_muito_longa';
  end if;

  insert into public.comissao_origem_config (origem, pct, ativo, descricao, atualizado_em, atualizado_por)
  values (p_origem, p_pct, coalesce(p_ativo, true), p_descricao, now(), auth.uid())
  on conflict (origem) do update
    set pct = excluded.pct,
        ativo = excluded.ativo,
        descricao = excluded.descricao,
        atualizado_em = now(),
        atualizado_por = auth.uid()
  returning * into _linha;

  return _linha;
end;
$$;

comment on function public.fn_salvar_comissao_origem(text, numeric, boolean, text) is
  'V11.5.8: única porta de escrita de comissao_origem_config — só Matriz
   (has_role(''matriz'')), sem exceção pra Coordenador (regra 9 nomeia só a
   Matriz). Upsert por origem (''proprio''/''repassado''). Faixa de pct
   (0..100) e tamanho de descricao (<=300) validados dentro da função.';

revoke all on function public.fn_salvar_comissao_origem(text, numeric, boolean, text) from public, anon;
grant execute on function public.fn_salvar_comissao_origem(text, numeric, boolean, text) to authenticated, service_role;
