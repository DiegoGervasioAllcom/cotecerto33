-- ===========================================================================
-- V11 · C14 (Frente 3, complemento) — remove a RPC cadastrar_franquia(jsonb)
--
-- Sem chamador desde que auth.cadastro.tsx foi removida (commit anterior):
-- o autocadastro espontâneo era o único caminho que passava por ela. O
-- caminho manual (C2/C3, criar_pendente_manual) e o Convite Supper
-- (cadastrar_franquia_admin, que fica) não dependem dela.
--
-- Não confundir com cadastrar_franquia_admin(jsonb, uuid) — essa continua:
-- é a que o Convite Supper usa (src/lib/convite.functions.ts).
-- ===========================================================================

drop function if exists public.cadastrar_franquia(jsonb);
