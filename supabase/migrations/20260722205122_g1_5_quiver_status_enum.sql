-- ===========================================================================
-- G1.5 — Novos valores de cotacao_status para a integração com a API da
-- Quiver (robô que calcula prêmios reais via portal da seguradora).
--
-- 'enviada_quiver'  : POST /cotacao feito, aguardando o webhook de resposta.
-- 'erro_quiver'     : webhook voltou com erro, sem prêmios ou placa não
--                      encontrada (motivo em cotacoes.quiver_mensagem).
--
-- Novos valores de enum precisam ser commitados antes de serem usados —
-- por isso ficam isolados nesta migration (ver 20240101000027, mesmo
-- padrão). O uso real (função registrar_premios_quiver) fica na próxima
-- migration (g1_5b_quiver_integracao).
-- ===========================================================================

alter type public.cotacao_status add value if not exists 'enviada_quiver';
alter type public.cotacao_status add value if not exists 'erro_quiver';
