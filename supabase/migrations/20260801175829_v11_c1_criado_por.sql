-- ===========================================================================
-- V11 · C1 (Frente 3) — log de quem acionou o cadastro manual · exceção
--
-- O pendente com convite já se explica por `convite_id` (quem criou o convite está
-- em `convites.criado_por`). O pendente manual (`convite_id is null`) não tinha
-- nenhum registro de quem o criou até agora — só o autocadastro espontâneo de
-- `auth.cadastro.tsx` alimentava esse caminho, sem log nenhum de responsável.
--
-- Não é caso para `historico_alteracoes` (Frente 0): aquela tabela é para mudança de
-- POLÍTICA, com diretor + senha conferida no servidor — usar ela aqui forçaria um
-- mecanismo caro numa ação operacional simples. Uma coluna em `empresas` basta.
-- ===========================================================================

alter table public.empresas
  add column if not exists criado_por uuid
    references public.profiles(id) on delete set null;

comment on column public.empresas.criado_por is
  'V11 C1: quem acionou o cadastro manual · exceção (RPC criar_pendente_manual). NULL
   quando o pedido nasceu de um convite (o log já é convites.criado_por) ou de um
   cadastro legado anterior a esta coluna.';

create index if not exists idx_empresas_criado_por on public.empresas(criado_por);
