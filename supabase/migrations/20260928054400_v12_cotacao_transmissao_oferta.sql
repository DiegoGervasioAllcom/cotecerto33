-- ============================================================
-- V12: snapshot best-effort da oferta escolhida para transmitir
-- (seguradora, produto_id, produto, forma_pagamento, parcelas, premio),
-- gravado quando o vendedor escolhe a oferta no Cálculo, pra o
-- wizard reabrir na Transmissão (sub-passo Dados complementares)
-- mesmo antes da primeira tentativa real de transmissão.
--
-- Sem dado pessoal: só campos da oferta (seguradora/produto/condições
-- de pagamento), nunca dados do segurado.
--
-- Não precisa de policy/RPC nova: a policy cot_iud (for all, using +
-- with check responsavel_id = auth.uid()) já cobre update dessa coluna
-- (ver 20240101000007_cotacoes.sql e 20260924020332_v12_pipeline_transmissao_fase.sql).
-- ============================================================

alter table public.cotacoes
  add column if not exists transmissao_oferta jsonb null;

do $$ begin
  alter table public.cotacoes
    add constraint cotacoes_transmissao_oferta_shape_check
    check (
      transmissao_oferta is null
      or jsonb_typeof(transmissao_oferta) = 'object'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacoes
    add constraint cotacoes_transmissao_oferta_size_check
    check (
      transmissao_oferta is null
      or char_length(transmissao_oferta::text) <= 2000
    );
exception when duplicate_object then null; end $$;
