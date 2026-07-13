-- ===========================================================================
-- CoteCerto 3.3 — Aplica tipo 'matriz' na empresa matriz do seed
-- Rode APÓS a migration 025 (em transação separada).
-- ===========================================================================

update public.empresas
   set tipo = 'matriz'
 where nome = 'Matriz CoteCerto'
   and tipo::text <> 'matriz';
