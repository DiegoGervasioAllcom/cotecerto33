-- ===========================================================================
-- CoteCerto 3.3 — Adiciona 'qualificando' ao enum lead_status
-- Necessário para o trigger de distribuição automática.
-- Rode esta migration sozinha (novos valores de enum precisam ser commitados
-- antes de serem usados).
-- ===========================================================================

alter type public.lead_status add value if not exists 'qualificando';
