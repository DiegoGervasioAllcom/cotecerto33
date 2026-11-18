-- Perguntas obrigatórias do wizard que o vendedor ainda não respondeu
-- (selects que começam em "Selecione"). O banco guarda os valores com
-- default (boolean/texto), então "não escolhido" não cabe nas colunas
-- existentes: esta lista guarda as chaves pendentes para que um rascunho
-- reaberto continue bloqueando o Calcular até o vendedor responder.
--
-- Vazio (default) = tudo respondido; é o estado de todas as cotações
-- existentes e das criadas pelo mobile. Escrita pelo dono via a policy
-- `cot_iud` já vigente (mesmo precedente de `calculo_visto_em`): não é uma
-- superfície nova — é só estado de UX do formulário, sem dinheiro/alçada.
alter table public.cotacoes
  add column if not exists campos_pendentes text[] not null default '{}'::text[];

alter table public.cotacoes
  drop constraint if exists cotacoes_campos_pendentes_tam;
alter table public.cotacoes
  add constraint cotacoes_campos_pendentes_tam
  check (cardinality(campos_pendentes) <= 40);

comment on column public.cotacoes.campos_pendentes is
  'Chaves das perguntas obrigatórias do wizard ainda não respondidas pelo '
  'vendedor (ex.: zeroKm, perfil:garagem). Vazio = tudo respondido.';
