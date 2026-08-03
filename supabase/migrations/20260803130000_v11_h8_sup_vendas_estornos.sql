-- ===========================================================================
-- H8 (Frente 8/Hierarquia) — Supervisor de Vendas ganha Estornos
--
-- A migration H2 (20260729014449) seguiu o protótipo r40, que não dava
-- 'mestorno' ao cargo sup_vendas, contra o const MENUS dos Fluxos (11 áreas,
-- com Estornos) — divergência registrada em docs/ANALISE_LACUNAS_V11.md e
-- levada à Lis (docs/PERGUNTAS_PARA_LIS.md, item 3).
--
-- Resposta da Lis em 03/08/2026: o r40 esqueceu mesmo — vale a lista dos
-- Fluxos. sup_vendas passa de 10 para 11 áreas. O protótipo r41 já traz o
-- preset corrigido.
-- ===========================================================================

insert into public.cargo_areas (cargo_id, area_chave) values
  ('sup_vendas', 'mestorno')
on conflict do nothing;
