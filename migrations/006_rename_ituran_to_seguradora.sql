-- ===========================================================================
-- CoteCerto 3.3 — Migração 006
-- Renomeia colunas ituran_* para seguradora_* em clt_config
-- ===========================================================================

alter table public.clt_config rename column ituran_planos to seguradora_planos;
alter table public.clt_config rename column ituran_adic   to seguradora_adic;
