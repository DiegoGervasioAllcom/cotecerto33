-- ===========================================================================
-- V12.3.8 — CHECK de valores válidos na coluna `ramo`
--
-- Catálogo de produtos/tipos de seguro (protótipo V12, `PRODUTOS`/
-- `produtosAtivos`): Auto (id 'auto', rótulo no banco 'Automóvel' — é o valor
-- já usado como default desde a 007/20240101000007_cotacoes.sql), Moto, Vida,
-- Residencial, Celular. Hoje só o ramo Automóvel tem jornada implementada
-- (wizard completo); os demais existem no catálogo mas ainda não têm telas —
-- o CHECK já reserva os rótulos para quando as jornadas forem entregues.
--
-- `cotacoes.ramo` é `not null default 'Automóvel'` (nunca chega null).
-- `cotacao_seguro.ramo` é preenchido só quando o wizard salva a etapa
-- "Seguro" (`salvar_wizard_step`/`salvar_cotacao_rascunho`), então fica null
-- até lá — o CHECK precisa permitir null nessa tabela.
--
-- Não há linha legada fora da lista (grep em /migrations e
-- supabase/migrations: todo insert/update de `ramo` usa coalesce(...,
-- 'Automóvel') ou vem do payload do próprio wizard, que só oferece estes 5
-- produtos). `leads` e `premiacao_campanhas` não têm coluna `ramo`/tipo de
-- seguro equivalente — não se aplica.
-- ===========================================================================

do $$ begin
  alter table public.cotacoes
    add constraint cotacoes_ramo_valido
    check (ramo in ('Automóvel','Moto','Vida','Residencial','Celular'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_seguro
    add constraint cotacao_seguro_ramo_valido
    check (ramo is null or ramo in ('Automóvel','Moto','Vida','Residencial','Celular'));
exception when duplicate_object then null; end $$;
