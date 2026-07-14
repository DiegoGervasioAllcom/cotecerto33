-- ============================================================
-- Fix: buraco de RLS de ESCRITA em public.propostas (S-gap)
-- ============================================================
-- 20240101000009_venda_real.sql criou "prop_select" (leitura por
-- responsavel_id/empresa/matriz/master) e "prop_iud" (FOR ALL: só o
-- responsavel_id ou matriz escreve), mas nunca dropou as policies
-- legadas do loop genérico de 20240101000001_init.sql
-- ("propostas_select"/"propostas_insert"/"propostas_update"/"propostas_delete",
-- escopadas por empresa_id in empresas_visiveis(auth.uid())).
--
-- Como policies permissivas do mesmo comando se somam por OR, a
-- "propostas_update" legada continuava ativa em paralelo a "prop_iud" e
-- permitia que QUALQUER colega da mesma empresa/rede editasse (status,
-- prêmio etc.) uma proposta alheia — não só o responsável.
--
-- Todas as escritas legítimas em propostas passam por RPCs
-- `security definer` (transmitir_proposta, marcar_apolice_emitida,
-- marcar_pagamento, cancelar_apolice) ou pelo trigger
-- `_gerar_proposta_de_premio` (também definer) — todas ignoram RLS.
-- Não há nenhum insert/update/delete direto de propostas pelo cliente.
--
-- Fix: dropar as 4 policies legadas do loop, deixando só:
--  - prop_select: leitura por responsavel_id/empresa/matriz/master.
--  - prop_iud:    escrita (insert/update/delete) só pelo responsavel_id
--                 ou matriz.
drop policy if exists "propostas_select" on public.propostas;
drop policy if exists "propostas_insert" on public.propostas;
drop policy if exists "propostas_update" on public.propostas;
drop policy if exists "propostas_delete" on public.propostas;
