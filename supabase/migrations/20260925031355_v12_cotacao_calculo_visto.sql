-- ============================================================
-- V12.3.4 — marca quando o dono da cotação viu o cálculo pronto,
-- pra sumir o aviso "COTAÇÃO FINALIZADA" e o piscar do menu
-- "Em negociação" (protótipo r40). Gravado ao abrir a tela Em
-- negociação ou ao agir no aviso (Abrir cálculo / Depois).
--
-- Decisão de escrita: a policy `cot_iud` (`20240101000007_cotacoes.sql`,
-- `for all using/with check (responsavel_id = auth.uid())`) já é o
-- padrão vigente pra qualquer update do dono em `cotacoes` — a migration
-- anterior de V12 (`20260924020332_v12_pipeline_transmissao_fase.sql`)
-- reusou ela pro mesmo motivo. Ela é "ampla" (o dono pode mexer em
-- qualquer coluna, não só `calculo_visto_em`), mas essa amplitude já é
-- o modelo de dados de `cotacoes` desde a 007 — não é um risco NOVO
-- introduzido aqui, e criar uma RPC só pra esta coluna adicionaria uma
-- camada sem reduzir superfície real (o dono já pode, por exemplo,
-- reabrir o wizard e mudar `step_atual`/`status` livremente pelo mesmo
-- update direto). Optei por NÃO criar RPC: mais simples, mesma
-- superfície de segurança, consistente com o precedente já revisado.
-- O que a policy garante e o teste confirma: outro vendedor da MESMA
-- empresa não consegue marcar `calculo_visto_em` de uma cotação que não
-- é dele (nem via update de coluna única) — `with check` barra porque
-- `responsavel_id <> auth.uid()`.
-- ============================================================

alter table public.cotacoes
  add column if not exists calculo_visto_em timestamptz null;

comment on column public.cotacoes.calculo_visto_em is
  'Quando o dono (responsavel_id) viu a cotação calculada — some o aviso '
  '"COTAÇÃO FINALIZADA" e o menu "Em negociação" para de piscar. Gravado '
  'ao abrir a tela Em negociação ou ao agir no aviso (Abrir cálculo / Depois).';

-- Backfill: sem isso, logo após esta migration TODO vendedor receberia o
-- aviso "COTAÇÃO FINALIZADA" pra cada cotação `calculada`/`proposta`
-- antiga (coluna nova nasce null pra linha existente) — falso positivo em
-- massa no primeiro deploy. `atualizado_em` (não `criado_em`) é a coluna
-- mais adequada: reflete o último toque real na cotação (a própria
-- migration `20240101000007_cotacoes.sql` mantém `atualizado_em` via
-- trigger em todo update), então aproxima melhor "quando o cálculo ficou
-- pronto" do que a data de criação do rascunho. `coalesce(atualizado_em,
-- now())` é defesa em profundidade — a coluna é `not null` desde a origem,
-- então o `now()` nunca deve disparar na prática, mas custa nada manter.
-- Idempotente: só afeta linhas com `calculo_visto_em is null` (não
-- sobrescreve nada gravado por uso real caso a migration rode 2x).
update public.cotacoes
  set calculo_visto_em = coalesce(atualizado_em, now())
  where status in ('calculada', 'proposta')
    and calculo_visto_em is null;
