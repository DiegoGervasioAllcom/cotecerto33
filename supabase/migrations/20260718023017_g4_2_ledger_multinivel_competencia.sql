-- ===========================================================================
-- 048 (G4.2) — Ledger multinível de comissão + competência (26→25)
--
-- Aditiva. Sistema em produção desde 16/07 — nada destrutivo de dados.
-- Mexe em objetos vivos de `comissao_lancamentos` (038): índice único
-- (proposta_id, tipo) vira (proposta_id, tipo, beneficiario_id) para permitir
-- crédito simultâneo ao vendedor E a um beneficiário de override (master/
-- supervisor/franquia) na MESMA proposta; e no trigger `_sync_comissao_lancamento`
-- (troca o fallback fixo de 16% por um % efetivo resolvido a partir de
-- empresas.perc_comissao → modelos_franquia.perc_comissao_padrao → 16 como
-- último recurso — o "16" só morre de vez na fatia G4.4, quando o motor de
-- regras substituir esse fallback).
--
-- Também alinha `marcar_apolice_emitida` (037) ao mesmo % efetivo: hoje ela
-- tinha o MESMO 16% hardcoded como fallback de `comissao_pct`/`comissao_valor`
-- quando ninguém informa `p_comissao_pct`. Extraída a resolução do % numa
-- função só (`fn_pct_comissao_efetivo`) reaproveitada pelo trigger e pela RPC,
-- pra não duplicar a regra em dois lugares.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Colunas novas em comissao_lancamentos (aditivas, nullable)
-- ---------------------------------------------------------------------------
alter table public.comissao_lancamentos
  add column if not exists beneficiario_id uuid references public.profiles(id) on delete set null,
  add column if not exists papel text,
  add column if not exists competencia text,
  add column if not exists regra jsonb;

do $$ begin
  alter table public.comissao_lancamentos
    add constraint comissao_lancamentos_papel_valido
    check (papel is null or papel in (
      'vendedor_clt', 'franquia_individual', 'franquia_full', 'master', 'supervisor'
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.comissao_lancamentos
    add constraint comissao_lancamentos_competencia_formato
    check (competencia is null or competencia ~ '^\d{4}-(0[1-9]|1[0-2])$');
exception when duplicate_object then null; end $$;

comment on column public.comissao_lancamentos.beneficiario_id is
  'Quem RECEBE o lançamento. Nos lançamentos legados (pré-048) é sempre igual a
   vendedor_id (backfill). Com overrides multinível, master/supervisor/franquia
   também podem ser beneficiários de um crédito referente à mesma proposta.';
comment on column public.comissao_lancamentos.papel is
  'Papel do beneficiário no momento do lançamento. NULL nos legados: o dado
   histórico não distingue se o vendedor_id era CLT, franqueado etc. — não dá
   pra inferir com certeza, então deixamos NULL em vez de arriscar um valor
   errado (documentado no backfill abaixo).';
comment on column public.comissao_lancamentos.competencia is
  'Período de competência (formato YYYY-MM), regra de corte 26→25: ver
   fn_competencia().';
comment on column public.comissao_lancamentos.regra is
  'Snapshot jsonb de como o valor foi calculado (auditoria), ex.:
   {"pct": 50, "fonte": "empresa"} | {"pct": 16, "fonte": "fallback"}.';

-- ---------------------------------------------------------------------------
-- 2) fn_competencia — período de produção 26→25
--    Dia >= 26 do mês conta para a competência do mês SEGUINTE.
--    Ex.: 2026-07-10 -> '2026-07' ; 2026-07-28 -> '2026-08'.
--    `at time zone` não é IMMUTABLE (depende do catálogo de fusos / DST), por
--    isso a função é STABLE (não IMMUTABLE, apesar do pedido) — documentado.
-- ---------------------------------------------------------------------------
create or replace function public.fn_competencia(ts timestamptz)
returns text
language sql
stable
as $$
  select to_char(
    (
      (ts at time zone 'America/Sao_Paulo')::date
      + case when extract(day from (ts at time zone 'America/Sao_Paulo')) >= 26
             then interval '1 month'
             else interval '0'
        end
    ),
    'YYYY-MM'
  );
$$;

comment on function public.fn_competencia(timestamptz) is
  'Competência (YYYY-MM) no período de produção 26->25: dia >= 26 conta pra
   competência do mês seguinte. STABLE (não IMMUTABLE): depende de "at time
   zone" com fuso America/Sao_Paulo, que não é imutável no catálogo do
   Postgres (DST/histórico de fusos podem mudar).';

-- ---------------------------------------------------------------------------
-- 3) fn_pct_comissao_efetivo — % efetivo de comissão de uma empresa
--    empresas.perc_comissao -> modelos_franquia.perc_comissao_padrao -> 16
--    (fallback fixo; morre na fatia G4.4 com o motor de regras completo).
--    security definer: usada SÓ internamente por trigger/RPC (que já rodam como
--    owner). Execute revogado de public/authenticated — expor via RPC direta
--    deixaria qualquer usuário sondar o % negociado de qualquer empresa,
--    contornando a RLS de empresas.
-- ---------------------------------------------------------------------------
create or replace function public.fn_pct_comissao_efetivo(p_empresa_id uuid)
returns table(pct numeric, fonte text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _perc_empresa numeric;
  _perc_modelo  numeric;
begin
  select e.perc_comissao, m.perc_comissao_padrao
    into _perc_empresa, _perc_modelo
    from public.empresas e
    left join public.modelos_franquia m on m.id = e.modelo_id
   where e.id = p_empresa_id;

  if _perc_empresa is not null then
    return query select _perc_empresa, 'empresa';
  elsif _perc_modelo is not null then
    return query select _perc_modelo, 'modelo';
  else
    return query select 16::numeric, 'fallback';
  end if;
end $$;

comment on function public.fn_pct_comissao_efetivo(uuid) is
  'Resolve o % de comissão efetivo de uma empresa: empresas.perc_comissao ->
   modelos_franquia.perc_comissao_padrao -> 16 (fallback fixo, morre no G4.4).
   Reaproveitada por _sync_comissao_lancamento (trigger) e marcar_apolice_emitida
   (RPC de transmissão) pra não duplicar a regra.';

-- Postgres concede EXECUTE a PUBLIC por padrão em funções novas — revogação
-- explícita obrigatória (a função vaza % negociado se chamável via RPC direta).
revoke execute on function public.fn_pct_comissao_efetivo(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Backfill (idempotente: where beneficiario_id is null)
--    papel fica NULL nos legados — ver comentário na coluna acima.
-- ---------------------------------------------------------------------------
update public.comissao_lancamentos
   set beneficiario_id = vendedor_id,
       competencia = public.fn_competencia(criado_em)
 where beneficiario_id is null;

-- ---------------------------------------------------------------------------
-- 5) Índice único: (proposta_id, tipo) -> (proposta_id, tipo, beneficiario_id)
--    Permite crédito pro vendedor E pro beneficiário de override na mesma
--    proposta; mantém a proteção anti-duplicata por beneficiário.
--    Ajustes manuais (proposta_id null) continuam sem colidir entre si —
--    comportamento padrão de índice único com NULL, mantido de propósito.
-- ---------------------------------------------------------------------------
drop index if exists public.cclanc_proposta_tipo_uq;

create unique index if not exists cclanc_proposta_tipo_benef_uq
  on public.comissao_lancamentos(proposta_id, tipo, beneficiario_id);

-- ---------------------------------------------------------------------------
-- 6) Trigger _sync_comissao_lancamento: % efetivo em vez de *0.16 fixo,
--    preenche beneficiario_id / competencia / regra. Não repete os backfills
--    de dados antigos da 038 (o backfill de linhas pré-existentes já rodou lá;
--    o backfill desta migration só completa as colunas novas, acima).
-- ---------------------------------------------------------------------------
create or replace function public._sync_comissao_lancamento()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_valor  numeric;
  v_ref    text;
  v_pct    numeric;
  v_fonte  text;
  v_comp   text;
  v_regra  jsonb;
begin
  if new.comissao_valor is not null then
    v_valor := new.comissao_valor;
    -- snapshot consistente com o ramo calculado: registra também o pct da
    -- proposta (pode ser null se o valor foi informado sem pct).
    v_regra := jsonb_build_object('fonte', 'comissao_valor_informado', 'pct', new.comissao_pct);
  else
    select pct, fonte into v_pct, v_fonte from public.fn_pct_comissao_efetivo(new.empresa_id);
    v_valor := coalesce(new.premio, new.valor, 0) * coalesce(v_pct, 16) / 100.0;
    v_regra := jsonb_build_object('pct', coalesce(v_pct, 16), 'fonte', coalesce(v_fonte, 'fallback'));
  end if;

  v_ref  := coalesce(new.apolice_numero, new.numero, new.id::text);
  v_comp := public.fn_competencia(coalesce(new.pago_em, new.emitida_em, now()));

  -- CRÉDITO: marcou pago_em (e antes não estava pago) e tem responsável
  if new.pago_em is not null
     and (tg_op='INSERT' or old.pago_em is distinct from new.pago_em)
     and new.responsavel_id is not null
     and coalesce(v_valor,0) > 0
     and new.cancelada_em is null then
    insert into public.comissao_lancamentos
      (vendedor_id, empresa_id, proposta_id, tipo, valor, descricao, referencia, seguradora,
       origem, beneficiario_id, competencia, regra)
    values
      (new.responsavel_id, new.empresa_id, new.id, 'credito', v_valor,
       'Comissão paga · ' || coalesce(new.seguradora,'—'),
       v_ref, new.seguradora, 'auto', new.responsavel_id, v_comp, v_regra)
    on conflict (proposta_id, tipo, beneficiario_id) do nothing;
  end if;

  -- DÉBITO: marcou cancelada_em (estorno) e havia crédito anterior
  if new.cancelada_em is not null
     and (tg_op='INSERT' or old.cancelada_em is distinct from new.cancelada_em)
     and new.responsavel_id is not null
     and coalesce(v_valor,0) > 0 then
    insert into public.comissao_lancamentos
      (vendedor_id, empresa_id, proposta_id, tipo, valor, descricao, referencia, seguradora,
       origem, beneficiario_id, competencia, regra)
    values
      (new.responsavel_id, new.empresa_id, new.id, 'debito', v_valor,
       'Estorno de comissão · ' || coalesce(new.cancelamento_motivo,'cancelamento'),
       v_ref, new.seguradora, 'auto', new.responsavel_id, v_comp, v_regra)
    on conflict (proposta_id, tipo, beneficiario_id) do nothing;
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 7) marcar_apolice_emitida (037): mesmo % efetivo em vez do 16 hardcoded,
--    só quando p_comissao_pct/comissao_pct não vierem informados.
-- ---------------------------------------------------------------------------
create or replace function public.marcar_apolice_emitida(
  p_proposta_id uuid,
  p_apolice text,
  p_tipo_venda text default null,
  p_forma_pagamento text default null,
  p_comissao_pct numeric default null
) returns void language plpgsql security definer set search_path=public as $$
declare
  _premio numeric;
  _empresa_id uuid;
  _comissao_pct_atual numeric;
  _pct_efetivo numeric;
  _fonte_efetiva text;
  _pct_final numeric;
begin
  select premio, empresa_id, comissao_pct
    into _premio, _empresa_id, _comissao_pct_atual
    from public.propostas where id = p_proposta_id;

  if p_comissao_pct is not null then
    _pct_final := p_comissao_pct;
  elsif _comissao_pct_atual is not null then
    _pct_final := _comissao_pct_atual;
  else
    select pct, fonte into _pct_efetivo, _fonte_efetiva
      from public.fn_pct_comissao_efetivo(_empresa_id);
    _pct_final := coalesce(_pct_efetivo, 16);
  end if;

  update public.propostas
     set apolice_numero  = coalesce(p_apolice, apolice_numero),
         tipo_venda      = coalesce(p_tipo_venda, tipo_venda, 'novo'),
         forma_pagamento = coalesce(p_forma_pagamento, forma_pagamento),
         comissao_pct    = _pct_final,
         comissao_valor  = coalesce(_premio,0) * (_pct_final / 100.0),
         emitida_em      = coalesce(emitida_em, now()),
         status          = 'transmitida',
         atualizado_em   = now()
   where id = p_proposta_id
     and (responsavel_id = auth.uid()
          or public.has_role(auth.uid(),'matriz')
          or public.has_role(auth.uid(),'master'));
end $$;
grant execute on function public.marcar_apolice_emitida(uuid,text,text,text,numeric) to authenticated;

comment on function public.marcar_apolice_emitida(uuid,text,text,text,numeric) is
  'G4.2: quando p_comissao_pct e o comissao_pct já gravado na proposta vêm nulos,
   resolve o % via fn_pct_comissao_efetivo (empresas.perc_comissao ->
   modelos_franquia.perc_comissao_padrao -> 16 fallback) em vez do 16 fixo
   antigo. Mesma função usada pelo trigger _sync_comissao_lancamento — regra
   única, sem duplicação.';

-- ---------------------------------------------------------------------------
-- 8) View: saldo por beneficiário + competência (+ empresa)
-- ---------------------------------------------------------------------------
create or replace view public.v_comissao_por_competencia
with (security_invoker = true) as
select
  beneficiario_id,
  competencia,
  empresa_id,
  sum(case when tipo='credito' then valor else 0 end) as total_creditos,
  sum(case when tipo='debito'  then valor else 0 end) as total_debitos,
  sum(case when tipo='credito' then valor else -valor end) as saldo,
  count(*) filter (where tipo='credito') as qtd_creditos,
  count(*) filter (where tipo='debito')  as qtd_debitos
from public.comissao_lancamentos
where beneficiario_id is not null and competencia is not null
group by beneficiario_id, competencia, empresa_id;

grant select on public.v_comissao_por_competencia to authenticated;
