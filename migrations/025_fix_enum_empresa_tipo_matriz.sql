-- ===========================================================================
-- CoteCerto 3.3 — Corrige enum empresa_tipo para aceitar 'matriz'
-- IMPORTANTE: Postgres não permite usar um novo valor de enum na mesma
-- transação em que ele foi adicionado. Rode esta migration e depois a 026.
-- ===========================================================================

alter type public.empresa_tipo add value if not exists 'matriz';
