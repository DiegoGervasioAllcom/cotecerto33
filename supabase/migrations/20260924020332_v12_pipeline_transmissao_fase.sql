-- ============================================================
-- V12 pipeline: persiste o sub-passo da Etapa 7 (transmissão)
-- pré-envio, pra o Pipeline do Vendedor mostrar granularidade real
-- no card do Kanban sem esperar a transmissão de verdade pro robô.
--
-- Os 3 valores espelham o tipo `Fase` de
-- src/components/venda/novo-lead/steps/transmissao/StepTransmissao.tsx
-- ('dados' | 'confirmacao' | 'pagamento' | 'resultado') — o 4º valor
-- ('resultado') não é persistido aqui: nesse ponto já existe uma linha
-- real em cotacao_transmissoes.
--
-- Não precisa de policy/RPC nova: a policy cot_iud (for all, using +
-- with check responsavel_id = auth.uid()) já cobre update dessa coluna.
-- ============================================================

alter table public.cotacoes
  add column if not exists transmissao_fase text null;

do $$ begin
  alter table public.cotacoes
    add constraint cotacoes_transmissao_fase_check
    check (transmissao_fase is null or transmissao_fase in ('dados','confirmacao','pagamento'));
exception when duplicate_object then null; end $$;
