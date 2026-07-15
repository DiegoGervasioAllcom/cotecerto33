-- ============================================================
-- D2 — faixas de valor em colunas monetárias/percentuais
--
-- Defesa em profundidade: complementa a validação já feita na RPC
-- lancar_ajuste_comissao (S3, valor > 0) com CHECK no banco, e cobre
-- as demais colunas monetárias/percentuais que hoje só confiam no
-- front/RPC para não receber valores inválidos.
--
-- Regras:
--   - comissao_lancamentos.valor: > 0 (0 já é bloqueado a montante na RPC;
--     aqui reforça também para o trigger automático e qualquer outro path).
--   - Demais colunas monetárias (leads.valor, oportunidades.valor,
--     propostas.valor, propostas.premio, propostas.comissao_valor,
--     cotacao_premios.premio): >= 0 — zero é estado legítimo (default 0 /
--     coalesce(...,0) no código).
--   - Percentuais (propostas.comissao_pct, modelos_franquia.perc_comissao_padrao,
--     empresas.perc_comissao): faixa 0..100.
--
-- Colunas nullable permanecem nullable — o CHECK passa naturalmente em NULL.
-- ============================================================

do $$ begin
  alter table public.comissao_lancamentos
    add constraint comissao_lancamentos_valor_positivo check (valor > 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.leads
    add constraint leads_valor_nao_negativo check (valor >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.oportunidades
    add constraint oportunidades_valor_nao_negativo check (valor >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas
    add constraint propostas_valor_nao_negativo check (valor >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas
    add constraint propostas_premio_nao_negativo check (premio >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas
    add constraint propostas_comissao_valor_nao_negativo check (comissao_valor >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.propostas
    add constraint propostas_comissao_pct_faixa check (comissao_pct between 0 and 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotacao_premios
    add constraint cotacao_premios_premio_nao_negativo check (premio >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.modelos_franquia
    add constraint modelos_franquia_perc_comissao_padrao_faixa
    check (perc_comissao_padrao between 0 and 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.empresas
    add constraint empresas_perc_comissao_faixa check (perc_comissao between 0 and 100);
exception when duplicate_object then null; end $$;
