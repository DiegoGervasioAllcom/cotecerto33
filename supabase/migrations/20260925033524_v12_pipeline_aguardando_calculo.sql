-- ============================================================
-- V12.3.4 (parte 2) — corrige `public.pipeline_leads_etapa`
-- (`20260924162114_v12_pipeline_kanban_paginado.sql`) pra bater com
-- `leadEtapaBucket()` (src/lib/lead-etapa.ts), que já foi atualizado:
-- cotação `enviada_quiver`/`erro_quiver` (`AGUARDANDO_CALCULO_STATUSES`)
-- agora cai no bucket 'negociacao', não mais no fallback 'novo' — o
-- vendedor já mandou pro robô/API da Quiver e está aguardando o preço
-- (ou lidando com um erro do robô), não é mais um lead "novo".
--
-- ÚNICA mudança real: a linha do `case`
--   `when cr.cotacao_status in ('calculada', 'proposta') then 'negociacao'`
-- vira
--   `when cr.cotacao_status in ('calculada', 'proposta', 'enviada_quiver',
--        'erro_quiver') then 'negociacao'`
-- — resto da definição (CTEs, colunas, ordem, `security_invoker = true`)
-- preservado byte a byte em relação à migration anterior.
--
-- `create or replace view` basta aqui: a lista/ordem/tipo de colunas não
-- muda (só o valor computado da coluna `etapa`), então não há conflito de
-- "cannot change name/type of column" nem precisa de drop/recreate em
-- cascata. `pipeline_resumo_etapas` (a única dependente, mesma migration
-- de origem) é uma view comum — não materializada — sobre
-- `pipeline_leads_etapa`; ela recalcula automaticamente a cada SELECT, sem
-- precisar ser recriada. Nenhuma function/RPC depende de nenhuma das
-- duas views (confirmado via grep em `supabase/migrations` e
-- `pg_depend`/`\d+` local). Ainda assim, reemito o grant de
-- `pipeline_resumo_etapas` por completude/idempotência — não é
-- estritamente necessário (o grant já sobrevive ao `create or replace` da
-- view-base), mas deixa a migration auto-suficiente se lida isolada.
-- ============================================================

create or replace view public.pipeline_leads_etapa
with (security_invoker = true) as
with cotacao_recente as (
  select distinct on (c.lead_id)
    c.id as cotacao_id,
    c.lead_id,
    c.status as cotacao_status,
    c.ramo,
    c.step_atual,
    c.transmissao_fase,
    c.atualizado_em as cotacao_atualizado_em,
    v.marca_nome,
    v.modelo_nome,
    v.ano_modelo
  from public.cotacoes c
  left join public.cotacao_veiculo v on v.cotacao_id = c.id
  where c.lead_id is not null
  order by c.lead_id, c.atualizado_em desc, c.criado_em desc, c.id desc
),
transmissao_aberta as (
  select distinct on (t.cotacao_id)
    t.cotacao_id,
    t.status as transmissao_status
  from public.cotacao_transmissoes t
  where t.status in ('enviada', 'falha')
  order by t.cotacao_id, t.criado_em desc, t.id desc
),
proposta_transmitida as (
  select distinct on (p.lead_id)
    p.lead_id,
    p.numero as proposta_numero,
    p.transmissao_status as proposta_transmissao_status
  from public.propostas p
  where p.lead_id is not null
    and p.transmissao_status = 'transmitida'
  order by p.lead_id, p.atualizado_em desc, p.criado_em desc, p.id desc
)
select
  l.id as lead_id,
  l.empresa_id,
  l.responsavel_id,
  l.nome,
  l.contato,
  l.status_pipeline,
  l.valor,
  l.origem,
  l.motivo_perda,
  l.bloqueado,
  l.em_avaliacao_matriz,
  l.criado_em,
  l.atualizado_em,
  cr.cotacao_id,
  cr.ramo,
  cr.cotacao_status,
  cr.step_atual,
  cr.transmissao_fase,
  cr.marca_nome,
  cr.modelo_nome,
  cr.ano_modelo,
  ta.transmissao_status as transmissao_aberta_status,
  pt.proposta_numero,
  pt.proposta_transmissao_status,
  (case
    when l.status_pipeline = 'perdido' then 'perdido'
    when pt.lead_id is not null then 'fechamento'
    when ta.cotacao_id is not null or cr.step_atual = 6 then 'finalizacao'
    when cr.cotacao_status in ('calculada', 'proposta', 'enviada_quiver', 'erro_quiver') then 'negociacao'
    when cr.cotacao_status in ('rascunho') then 'cotacao'
    else 'novo'
  end) as etapa
from public.leads l
left join cotacao_recente cr on cr.lead_id = l.id
left join transmissao_aberta ta on ta.cotacao_id = cr.cotacao_id
left join proposta_transmitida pt on pt.lead_id = l.id;

grant select on public.pipeline_leads_etapa to authenticated, service_role;

create or replace view public.pipeline_resumo_etapas
with (security_invoker = true) as
select
  etapa,
  count(*) as total,
  sum(valor) as valor_total
from public.pipeline_leads_etapa
group by etapa;

grant select on public.pipeline_resumo_etapas to authenticated, service_role;
