-- ===========================================================================
-- V11.5b.3 (Frente 5b — Franquia Full) — complementos de comissão do próprio
-- time, sem senha de diretor
--
-- "Modelo CLT" pra Full = leitura do modelo global da Matriz (clt_config,
-- singleton — fora do escopo desta migration) + edição dos "Complementos do
-- time", que SÃO da franquia. r41 (`FULL_COM`/`fullComCard()`) confirma os 4
-- campos: comissão de venda do vendedor (%), comissão na renovação (%), bônus
-- de campanha, meta padrão da equipe — herdados por vendedor novo, com
-- exceção por pessoa configurável em outro lugar (fora de escopo aqui).
--
-- TIPOS de bonus_campanha/meta_padrao_equipe: TEXT LIVRE, não numérico. r41
-- trata os dois como texto com unidade embutida — 'bonus:"+5% acima da meta"'
-- e 'equipeMeta:"12 vendas/mês"' — não são um número puro nem seguem um
-- formato fixo (percentual vs. contagem/período). Forçar numeric perderia
-- informação que o próprio protótipo manda livre.
--
-- comissao_venda_pct/comissao_renovacao_pct SÃO numeric(5,2) por decisão do
-- plano (não do r41 — lá aparecem como texto com "%", ex. "40%") porque são
-- percentuais que entram em conta de comissão de fato; texto livre exigiria
-- parsing frágil na hora de aplicar a régua de comissionamento.
--
-- 1 linha por empresa Full (PK empresa_id) — diferente da régua de
-- performance (V11.5b.2), que é 1 linha COMPARTILHADA: aqui cada Full tem o
-- próprio modelo geral do time, coerente com "matrizinha" (regra 8).
--
-- Escrita só via fn_salvar_complementos_full — mesmo padrão de
-- sla_empresa_config (V11.5.3): sem grant de insert/update/delete pra
-- authenticated, só a RPC (security definer) escreve.
-- ===========================================================================

create table if not exists public.full_comissao_complementos (
  empresa_id             uuid primary key references public.empresas(id) on delete cascade,
  comissao_venda_pct     numeric(5,2) not null check (comissao_venda_pct between 0 and 100),
  comissao_renovacao_pct numeric(5,2) not null check (comissao_renovacao_pct between 0 and 100),
  bonus_campanha         text check (bonus_campanha is null or char_length(bonus_campanha) <= 200),
  meta_padrao_equipe     text check (meta_padrao_equipe is null or char_length(meta_padrao_equipe) <= 200),
  atualizado_em          timestamptz not null default now(),
  atualizado_por         uuid references auth.users(id) on delete set null
);

comment on table public.full_comissao_complementos is
  'V11.5b.3: complementos de comissão do time da Franquia Full (regra 8,
   "matrizinha") — comissão de venda/renovação (%) + bônus de campanha/meta da
   equipe (texto livre, r41: unidade embutida, ex. "12 vendas/mês"). 1 linha
   por empresa. Escrita só via fn_salvar_complementos_full.';

comment on column public.full_comissao_complementos.bonus_campanha is
  'Texto livre (r41: ex. "+5% acima da meta") — não é percentual fixo.';
comment on column public.full_comissao_complementos.meta_padrao_equipe is
  'Texto livre (r41: ex. "12 vendas/mês") — mistura contagem e período, não é
   um número puro.';

grant select on public.full_comissao_complementos to authenticated;
grant all on public.full_comissao_complementos to service_role;

alter table public.full_comissao_complementos enable row level security;

drop policy if exists full_comissao_complementos_select on public.full_comissao_complementos;
create policy full_comissao_complementos_select on public.full_comissao_complementos
  for select to authenticated
  using (empresa_id in (select public.empresas_visiveis(auth.uid())));

-- Sem policy de insert/update/delete: só via RPC security definer abaixo.

-- ---------------------------------------------------------------------------
-- fn_salvar_complementos_full — única porta de escrita.
-- ---------------------------------------------------------------------------
create or replace function public.fn_salvar_complementos_full(
  p_empresa_id uuid,
  p_comissao_venda_pct numeric,
  p_comissao_renovacao_pct numeric,
  p_bonus_campanha text,
  p_meta_padrao_equipe text
) returns public.full_comissao_complementos
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _uid uuid := auth.uid();
  _antes public.full_comissao_complementos;
  _linha public.full_comissao_complementos;
  _de_para jsonb := '[]'::jsonb;
begin
  if not (
    public.has_role(_uid, 'franqueado')
    and exists (
      select 1 from public.profiles p
       where p.id = _uid
         and p.empresa_id = p_empresa_id
    )
    and public.fn_bloco_performance(p_empresa_id) = 'full'
  ) then
    raise exception 'Só a própria Franquia Full pode salvar os complementos do próprio time'
      using hint = 'Gate por identidade (franqueado dono da empresa + modalidade Full), não por senha de diretor.';
  end if;

  if p_comissao_venda_pct is null or p_comissao_venda_pct < 0 or p_comissao_venda_pct > 100 then
    raise exception 'Comissão de venda precisa estar entre 0 e 100.';
  end if;
  if p_comissao_renovacao_pct is null or p_comissao_renovacao_pct < 0 or p_comissao_renovacao_pct > 100 then
    raise exception 'Comissão na renovação precisa estar entre 0 e 100.';
  end if;
  if p_bonus_campanha is not null and char_length(p_bonus_campanha) > 200 then
    raise exception 'Bônus de campanha muito longo (máximo 200 caracteres).';
  end if;
  if p_meta_padrao_equipe is not null and char_length(p_meta_padrao_equipe) > 200 then
    raise exception 'Meta padrão da equipe muito longa (máximo 200 caracteres).';
  end if;

  select * into _antes from public.full_comissao_complementos where empresa_id = p_empresa_id;

  if _antes is null or _antes.comissao_venda_pct is distinct from p_comissao_venda_pct then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Comissão de venda do vendedor (%)',
      'de', coalesce(_antes.comissao_venda_pct::text, '—'), 'para', p_comissao_venda_pct::text));
  end if;
  if _antes is null or _antes.comissao_renovacao_pct is distinct from p_comissao_renovacao_pct then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Comissão na renovação (%)',
      'de', coalesce(_antes.comissao_renovacao_pct::text, '—'), 'para', p_comissao_renovacao_pct::text));
  end if;
  if _antes is null or _antes.bonus_campanha is distinct from p_bonus_campanha then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Bônus de campanha',
      'de', coalesce(_antes.bonus_campanha, '—'), 'para', coalesce(p_bonus_campanha, '—')));
  end if;
  if _antes is null or _antes.meta_padrao_equipe is distinct from p_meta_padrao_equipe then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Meta padrão da equipe',
      'de', coalesce(_antes.meta_padrao_equipe, '—'), 'para', coalesce(p_meta_padrao_equipe, '—')));
  end if;

  -- Levanta exceção se não passar o gate de identidade — nada abaixo roda.
  perform public.fn_registrar_alteracao_franquia(
    p_empresa_id,
    'Comissionamento',
    'Complementos do time alterados',
    case when jsonb_array_length(_de_para) > 0 then _de_para else null end
  );

  insert into public.full_comissao_complementos
    (empresa_id, comissao_venda_pct, comissao_renovacao_pct, bonus_campanha, meta_padrao_equipe, atualizado_em, atualizado_por)
  values
    (p_empresa_id, p_comissao_venda_pct, p_comissao_renovacao_pct, p_bonus_campanha, p_meta_padrao_equipe, now(), _uid)
  on conflict (empresa_id) do update
    set comissao_venda_pct = excluded.comissao_venda_pct,
        comissao_renovacao_pct = excluded.comissao_renovacao_pct,
        bonus_campanha = excluded.bonus_campanha,
        meta_padrao_equipe = excluded.meta_padrao_equipe,
        atualizado_em = now(),
        atualizado_por = excluded.atualizado_por
  returning * into _linha;

  return _linha;
end;
$function$;

comment on function public.fn_salvar_complementos_full(uuid, numeric, numeric, text, text) is
  'V11.5b.3: única porta de escrita de full_comissao_complementos. Gate por
   identidade (franqueado dono da empresa + modalidade Full via
   fn_bloco_performance) — nunca senha de diretor. Upsert por empresa_id.
   Grava histórico via fn_registrar_alteracao_franquia (V11.5b.1), área
   Comissionamento.';

revoke all on function public.fn_salvar_complementos_full(uuid, numeric, numeric, text, text) from public, anon;
grant execute on function public.fn_salvar_complementos_full(uuid, numeric, numeric, text, text) to authenticated;
