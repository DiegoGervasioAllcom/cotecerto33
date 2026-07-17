-- ===========================================================================
-- 044 (G1.4) — Campos da classificação de acesso (colunas dedicadas + checks)
--
-- Persiste os campos condicionais do modal "Classificar acesso" (MAPA seção 5).
-- Colunas dedicadas e tipadas (não JSONB) porque alimentam o motor de comissão
-- (G4): checks de integridade (>= 0, pct 0-100, dia 1-31) no padrão do D2.
--
-- Separação natural por nível:
--   - empresas (PJ): franquia (isenta, leads_dia) e master (perc_equipe, royalties).
--   - profiles (PF): vendedor CLT (salário, faixa Elite, bônus, dia pgto, leads,
--     equipe) e supervisor (comissao_modelo, royalties).
--
-- "Franquias que vai supervisionar" NÃO é coluna: resolve-se pela hierarquia
-- (profiles.superior_id dos donos das franquias aponta para o supervisor).
-- superior_id / modelo_id / perc_comissao já existem (042 e anteriores).
-- ===========================================================================

-- ---- empresas (classificação PJ) ------------------------------------------
alter table public.empresas
  add column if not exists isenta        boolean,
  add column if not exists leads_dia     integer,
  add column if not exists perc_equipe   numeric(5,2),
  add column if not exists royalties_fpp numeric(12,2);

alter table public.empresas
  drop constraint if exists empresas_leads_dia_nao_neg,
  add  constraint empresas_leads_dia_nao_neg
       check (leads_dia is null or leads_dia >= 0);
alter table public.empresas
  drop constraint if exists empresas_perc_equipe_faixa,
  add  constraint empresas_perc_equipe_faixa
       check (perc_equipe is null or (perc_equipe >= 0 and perc_equipe <= 100));
alter table public.empresas
  drop constraint if exists empresas_royalties_fpp_nao_neg,
  add  constraint empresas_royalties_fpp_nao_neg
       check (royalties_fpp is null or royalties_fpp >= 0);

comment on column public.empresas.isenta        is 'Franquia isenta (controle de isenção — G1.4).';
comment on column public.empresas.leads_dia      is 'Leads/dia alocados à franquia (G1.4).';
comment on column public.empresas.perc_equipe    is 'Master: % sobre a comissão da equipe (padrão 20). Config lida pelo G4.';
comment on column public.empresas.royalties_fpp  is 'Master: royalties + FPP. Config lida pelo G4.';

-- ---- profiles (classificação PF) ------------------------------------------
alter table public.profiles
  add column if not exists leads_dia         integer,
  add column if not exists salario_base      numeric(12,2),
  add column if not exists bonus_campanha    numeric(12,2),
  add column if not exists dia_pagamento     integer,
  add column if not exists faixa_elite_valor numeric(12,2),
  add column if not exists faixa_elite_pct   numeric(5,2),
  add column if not exists comissao_modelo   numeric(5,2),
  add column if not exists royalties         numeric(12,2),
  add column if not exists equipe            text;

alter table public.profiles
  drop constraint if exists profiles_leads_dia_nao_neg,
  add  constraint profiles_leads_dia_nao_neg
       check (leads_dia is null or leads_dia >= 0);
alter table public.profiles
  drop constraint if exists profiles_salario_base_nao_neg,
  add  constraint profiles_salario_base_nao_neg
       check (salario_base is null or salario_base >= 0);
alter table public.profiles
  drop constraint if exists profiles_bonus_campanha_nao_neg,
  add  constraint profiles_bonus_campanha_nao_neg
       check (bonus_campanha is null or bonus_campanha >= 0);
alter table public.profiles
  drop constraint if exists profiles_dia_pagamento_faixa,
  add  constraint profiles_dia_pagamento_faixa
       check (dia_pagamento is null or (dia_pagamento >= 1 and dia_pagamento <= 31));
alter table public.profiles
  drop constraint if exists profiles_faixa_elite_valor_nao_neg,
  add  constraint profiles_faixa_elite_valor_nao_neg
       check (faixa_elite_valor is null or faixa_elite_valor >= 0);
alter table public.profiles
  drop constraint if exists profiles_faixa_elite_pct_faixa,
  add  constraint profiles_faixa_elite_pct_faixa
       check (faixa_elite_pct is null or (faixa_elite_pct >= 0 and faixa_elite_pct <= 100));
alter table public.profiles
  drop constraint if exists profiles_comissao_modelo_faixa,
  add  constraint profiles_comissao_modelo_faixa
       check (comissao_modelo is null or (comissao_modelo >= 0 and comissao_modelo <= 100));
alter table public.profiles
  drop constraint if exists profiles_royalties_nao_neg,
  add  constraint profiles_royalties_nao_neg
       check (royalties is null or royalties >= 0);
alter table public.profiles
  drop constraint if exists profiles_equipe_tam,
  add  constraint profiles_equipe_tam
       check (equipe is null or char_length(equipe) <= 120);

comment on column public.profiles.leads_dia         is 'Vendedor CLT: leads/dia (G1.4).';
comment on column public.profiles.salario_base      is 'Vendedor CLT: salário base. Config lida pelo G4.';
comment on column public.profiles.bonus_campanha    is 'Vendedor CLT: bônus de campanha. Config lida pelo G4.';
comment on column public.profiles.dia_pagamento     is 'Vendedor CLT: dia de pagamento (1-31).';
comment on column public.profiles.faixa_elite_valor is 'Vendedor CLT: faixa Elite — acima de R$ X a comissão passa a %. Config G4.';
comment on column public.profiles.faixa_elite_pct   is 'Vendedor CLT: faixa Elite — % aplicado acima do valor. Config G4.';
comment on column public.profiles.comissao_modelo   is 'Supervisor: comissão modelo supervisor (%). Config lida pelo G4.';
comment on column public.profiles.royalties         is 'Supervisor: royalties. Config lida pelo G4.';
comment on column public.profiles.equipe            is 'Vendedor CLT: equipe/grupo a que pertence (rótulo).';
