-- ===========================================================================
-- Onda 3 / R.8 — Renovação de seguro sempre falhava no robô Quiver por
-- faltar campos do bloco "Dados da apólice anterior" (StepSeguro.tsx).
-- `cia_atual`/`apolice_atual` já cobriam seguradoraAnterior/apoliceAnterior
-- (reaproveitadas via mapeamento em useCotacaoRascunho.ts); faltam colunas
-- para os outros 5 campos obrigatórios em Renovação. Todas nullable: não é
-- retroativo, cotações antigas não têm esse dado.
--
-- Tipos seguem o padrão já existente na tabela: campos livres/seleção como
-- `cia_atual`/`apolice_atual` são text; datas de vigência seguem `vig_ini`/
-- `vig_fim`, que são date.
-- ===========================================================================

alter table public.cotacao_seguro
  add column if not exists sucursal_anterior text,
  add column if not exists cobertura_anterior text,
  add column if not exists status_apolice_anterior text,
  add column if not exists inicio_vigencia_anterior date,
  add column if not exists fim_vigencia_anterior date;
