-- ===========================================================================
-- V11 · C11 (Frente 3) — retirar vendedor_solicitacoes
--
-- Decisão do plano (docs/PLANO_CADASTROS_V11.md): o Convite Supper já faz o
-- trabalho de `vendedor_solicitacoes`/G1.6c — melhor, porque cria o usuário
-- direto na aprovação (`aprovar_acesso`), sem o passo manual que faltava aqui
-- ("aprovar só libera o pedido, a Matriz ainda cria em Usuários"). Manter os
-- dois seria manter um caminho paralelo e incompleto.
--
-- Confirmado com o responsável (03/08/2026): produção ainda não está em uso,
-- sem dados reais em `vendedor_solicitacoes` — DROP direto, sem migração de
-- dados. O "Convidar" do Master (escopo master, ConvidarModal) já cobre
-- "Vendedor · da minha operação" e "Vendedor · de uma Franquia Full".
-- ===========================================================================

drop function if exists public.solicitar_vendedor(text, text, text, text);
drop function if exists public.resolver_solicitacao_vendedor(uuid, boolean, text);
drop table if exists public.vendedor_solicitacoes;
