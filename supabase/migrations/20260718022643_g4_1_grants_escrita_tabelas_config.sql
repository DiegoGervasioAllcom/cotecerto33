-- G4.1 (correção de inconsistência pré-existente, achada em revisão):
-- clt_config (005), modelos_franquia (002), seguradoras (010) e configuracoes_gerais
-- (034) têm policy de escrita matriz-only (`for all ... has_role(matriz)`), mas o
-- grant de tabela para `authenticated` era só de `select`. Como o grant é avaliado
-- ANTES da RLS, as escritas diretas do front (configuracoes.tsx / acessos.tsx)
-- falhavam com `permission denied` (42501) mesmo para a matriz.
--
-- Concede escrita para `authenticated` no mesmo padrão de mensagens_prontas (009)
-- e empresas (001): o grant abre a porta, a RLS matriz-only continua sendo a
-- barreira real (teste: tests/db/rls-grants-escrita-config.test.ts).

grant insert, update, delete on public.clt_config to authenticated;
grant insert, update, delete on public.modelos_franquia to authenticated;
grant insert, update, delete on public.seguradoras to authenticated;
grant insert, update, delete on public.configuracoes_gerais to authenticated;
