-- ============================================================
-- V12 Pipeline: views server-side para o Kanban com paginação.
--
-- `pipeline_leads_etapa` calcula, por linha, a mesma "etapa automática"
-- que `leadEtapaBucket()` em src/lib/lead-etapa.ts deriva no client hoje
-- (cotação mais recente do lead, tentativa de transmissão em aberto,
-- proposta transmitida). Isso existe pra permitir cursor pagination real
-- (`responsavel_id, atualizado_em desc, id desc`) sem trazer todos os
-- leads pro front só pra bucketizar em JS.
--
-- ATENÇÃO — duplicação de regra: se `leadEtapaBucket()` mudar em
-- src/lib/lead-etapa.ts, o `case` do campo `etapa` abaixo precisa mudar
-- junto. O teste de equivalência client/view (T2 desta frente) existe
-- pra pegar esse esquecimento.
--
-- Melhoria implícita achada na validação manual (T0): a CTE
-- `proposta_transmitida` agora sempre pega a proposta transmitida mais
-- recente por lead (`order by atualizado_em desc, criado_em desc, id
-- desc`) — antes, o client não tinha `.order()` nenhum nessa consulta e
-- pegava uma linha arbitrária quando havia mais de uma proposta
-- transmitida pro mesmo lead.
--
-- Sem view própria pra "resumo por ramo" (decisão da T0): o filtro de
-- Tipo de seguro do Kanban consulta
-- `select ramo, count(*) from pipeline_leads_etapa where ramo is not
-- null group by ramo` direto, sem view dedicada.
--
-- Grant explícito pra `service_role` também (não só `authenticated`):
-- views não herdam grant de tabela, e views novas não têm nenhum default
-- privilege implícito pra `service_role` — sem isso, os testes que leem
-- a view via client admin (service_role), como o de equivalência acima,
-- falham com "permission denied for view" (achado só em CI, porque o
-- ambiente local de desenvolvimento tem defaults mais permissivos que
-- mascaram a ausência do grant — não confie só em `test:db` local pra
-- validar grant/RLS de objeto novo, sempre confira o resultado do CI).
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
    when cr.cotacao_status in ('calculada', 'proposta') then 'negociacao'
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

-- ---------- Índices de suporte ----------

-- Cursor de paginação do Kanban: filtra por vendedor e ordena por
-- `atualizado_em desc, id desc` (desempate estável).
create index if not exists idx_leads_responsavel_cursor
  on public.leads (responsavel_id, atualizado_em desc, id desc);

-- `propostas(lead_id)` já tem índice líder em `idx_propostas_lead_marcos_funil`
-- (lead_id, transmitida_em, emitida_em) — cobre a busca por `lead_id` da CTE
-- `proposta_transmitida` acima; não precisa de índice novo.
