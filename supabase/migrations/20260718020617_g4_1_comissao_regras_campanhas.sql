-- ===========================================================================
-- 047 (G4.1) — Motor de comissão: tabelas de regras + campanhas Elite
--
-- Só estrutura + seeds + RLS desta fatia. O MOTOR (cálculo/RPC) vem nas
-- fatias G4.3/G4.4 — não confundir "regra parametrizada" com "cálculo".
--
-- - comissao_regras: 1 regra vigente por papel (sem versionamento por ora),
--   parâmetros livres em jsonb validados de forma genérica (padrão D4).
-- - campanhas_elite: campanhas por faixa de volume (bônus %); 1 campanha
--   vigente por tipo (elite_franqueado/elite_master), mesmo padrão simples.
-- ===========================================================================

-- ---------- Funções auxiliares de validação de shape (padrão D4) ----------

-- true se `j` é objeto e cada valor de primeiro nível é string, number
-- (não-negativo), boolean ou array — genérico o bastante pra não engessar
-- os parâmetros de cada papel (faixas propriamente ditas seguem em outra
-- estrutura, ex.: clt_config, ou em campanhas_elite.faixas).
create or replace function public.jsonb_comissao_regras_ok(j jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(j) = 'object'
    and coalesce(
      (
        select bool_and(
          jsonb_typeof(v) in ('string', 'boolean', 'array')
          or (jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric >= 0)
        )
        from jsonb_each(j) as t(k, v)
      ),
      true
    );
$$;

-- true se `j` é array não-vazio de objetos {minimo: number >=0, bonus_pct:
-- number entre 0 e 100} — shape das faixas de campanhas_elite.
create or replace function public.jsonb_faixas_bonus_ok(j jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(j) = 'array'
    and jsonb_array_length(j) > 0
    and coalesce(
      (
        select bool_and(
          jsonb_typeof(e) = 'object'
          and (e ? 'minimo')
          and jsonb_typeof(e -> 'minimo') = 'number'
          and (e ->> 'minimo')::numeric >= 0
          and (e ? 'bonus_pct')
          and jsonb_typeof(e -> 'bonus_pct') = 'number'
          and (e ->> 'bonus_pct')::numeric between 0 and 100
        )
        from jsonb_array_elements(j) e
      ),
      false
    );
$$;

-- ---------- comissao_regras ----------

create table if not exists public.comissao_regras (
  id uuid primary key default gen_random_uuid(),
  papel text not null unique
    check (papel in ('vendedor_clt', 'franquia_individual', 'franquia_full', 'master', 'supervisor')),
  parametros jsonb not null default '{}'::jsonb,
  descricao text check (descricao is null or char_length(descricao) <= 300),
  atualizado_em timestamptz not null default now()
);

do $$ begin
  alter table public.comissao_regras
    add constraint comissao_regras_parametros_shape check (public.jsonb_comissao_regras_ok(parametros));
exception when duplicate_object then null; end $$;

-- select liberado a qualquer authenticated; insert/update/delete também
-- concedidos (RLS abaixo restringe a matriz via has_role) — sem isso o grant
-- de tabela barra a escrita antes mesmo da policy ser avaliada.
grant select, insert, update, delete on public.comissao_regras to authenticated;
grant all on public.comissao_regras to service_role;

alter table public.comissao_regras enable row level security;

drop policy if exists comissao_regras_select on public.comissao_regras;
create policy comissao_regras_select on public.comissao_regras
  for select to authenticated using (true);

drop policy if exists comissao_regras_admin on public.comissao_regras;
create policy comissao_regras_admin on public.comissao_regras
  for all to authenticated
  using (public.has_role(auth.uid(), 'matriz'))
  with check (public.has_role(auth.uid(), 'matriz'));

-- ---------- campanhas_elite ----------

create table if not exists public.campanhas_elite (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) <= 150),
  tipo text not null unique check (tipo in ('elite_franqueado', 'elite_master')),
  faixas jsonb not null,
  ativa boolean not null default true,
  periodo text check (periodo is null or char_length(periodo) <= 50),
  criado_em timestamptz not null default now()
);

do $$ begin
  alter table public.campanhas_elite
    add constraint campanhas_elite_faixas_shape check (public.jsonb_faixas_bonus_ok(faixas));
exception when duplicate_object then null; end $$;

grant select, insert, update, delete on public.campanhas_elite to authenticated;
grant all on public.campanhas_elite to service_role;

alter table public.campanhas_elite enable row level security;

drop policy if exists campanhas_elite_select on public.campanhas_elite;
create policy campanhas_elite_select on public.campanhas_elite
  for select to authenticated using (true);

drop policy if exists campanhas_elite_admin on public.campanhas_elite;
create policy campanhas_elite_admin on public.campanhas_elite
  for all to authenticated
  using (public.has_role(auth.uid(), 'matriz'))
  with check (public.has_role(auth.uid(), 'matriz'));

-- ---------- Seeds (idempotentes) ----------

insert into public.comissao_regras (papel, parametros, descricao) values
  ('vendedor_clt', '{"fonte": "clt_config", "estorno_dias": 90}'::jsonb,
    'Comissão do vendedor CLT segue as faixas progressivas de clt_config; estorno em até 90 dias.'),
  ('franquia_individual', '{"fonte": "modelos_franquia.perc_comissao_padrao", "renovacao_pct": 20}'::jsonb,
    'Franquia individual: percentual padrão do modelo de franquia; renovação com percentual próprio.'),
  ('franquia_full', '{"fonte": "modelos_franquia.perc_comissao_padrao", "override_equipe_pct": 0}'::jsonb,
    'Franquia full: percentual padrão do modelo, mais override sobre a equipe (definido por empresa).'),
  ('master', '{"override_equipe_pct_padrao": 20, "fonte_override": "empresas.perc_equipe"}'::jsonb,
    'Master: override padrão sobre a equipe, sobrescrito por empresas.perc_equipe quando definido.'),
  ('supervisor', '{"fonte_pct": "profiles.comissao_modelo"}'::jsonb,
    'Supervisor: percentual de comissão vem de profiles.comissao_modelo.')
on conflict (papel) do update
  set parametros = excluded.parametros,
      descricao = excluded.descricao,
      atualizado_em = now();

insert into public.campanhas_elite (nome, tipo, faixas, ativa, periodo) values
  ('Elite Franqueado', 'elite_franqueado',
    '[{"minimo": 50000, "bonus_pct": 5}, {"minimo": 75000, "bonus_pct": 10}, {"minimo": 100000, "bonus_pct": 20}, {"minimo": 150000, "bonus_pct": 30}]'::jsonb,
    true, 'trimestral'),
  ('Elite Master', 'elite_master',
    '[{"minimo": 200000, "bonus_pct": 5}, {"minimo": 300000, "bonus_pct": 15}, {"minimo": 400000, "bonus_pct": 30}, {"minimo": 500000, "bonus_pct": 50}]'::jsonb,
    true, 'trimestral')
on conflict (tipo) do update
  set nome = excluded.nome,
      faixas = excluded.faixas,
      ativa = excluded.ativa,
      periodo = excluded.periodo;
