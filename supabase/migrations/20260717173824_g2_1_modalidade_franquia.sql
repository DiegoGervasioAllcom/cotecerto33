-- ===========================================================================
-- 046 (G2.1) — Modalidade da franquia: individual | full (flag real)
--
-- Substitui a heurística interina "nome contém 'full'" (usada em G1.4/G1.5/G1.6a)
-- por uma coluna explícita em modelos_franquia. Só se aplica a modelos de tipo
-- 'franqueada' (modelos 'clt' ficam com modalidade NULL — não se aplica).
--
-- Backfill: preserva o comportamento atual — modelos cujo nome contém "full"
-- viram 'full'; os demais franqueada viram 'individual'. Novos modelos definem
-- a modalidade explicitamente no editor (front).
-- ===========================================================================

alter table public.modelos_franquia
  add column if not exists modalidade text;

alter table public.modelos_franquia
  drop constraint if exists modelos_franquia_modalidade_valida,
  add  constraint modelos_franquia_modalidade_valida
       check (modalidade is null or modalidade in ('individual', 'full'));

-- Backfill idempotente (só onde ainda está nulo), preservando a heurística atual.
update public.modelos_franquia
   set modalidade = case
         when nome ilike '%full%' then 'full'
         else 'individual'
       end
 where tipo = 'franqueada'
   and modalidade is null;

comment on column public.modelos_franquia.modalidade is
  'Modalidade da franquia (G2.1): individual = opera como vendedor, sem equipe; full = gere equipe própria (área de grupo). NULL para modelos CLT. Substitui a heurística de nome.';
