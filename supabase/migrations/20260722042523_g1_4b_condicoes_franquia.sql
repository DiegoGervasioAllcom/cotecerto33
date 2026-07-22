-- ===========================================================================
-- G1.4b — "Condições adicionais" da Franquia (dia de pagamento, bônus de
-- campanha, faixa Elite) migram de Vendedor CLT para Franquia.
--
-- A 044 (g1_4_campos_classificacao_acesso) tinha colocado esses 4 campos só
-- em profiles (vendedor CLT), mas o protótipo v10 os coloca na classificação
-- de Franquia (PJ), em "Condições adicionais". Ajustando para bater com o
-- protótipo: Franquia ganha as mesmas 4 colunas (mesmos tipos/checks).
--
-- As colunas em profiles NÃO são removidas nesta migration: o motor de
-- comissão CLT (g4_3_motor_clt) ainda lê profiles.faixa_elite_valor/pct por
-- vendedor. A tela de Classificar acesso deixa de coletar esses 4 campos
-- para Vendedor CLT (fica só em Franquia) — profiles.dia_pagamento/
-- bonus_campanha/faixa_elite_valor/faixa_elite_pct ficam sem escritor até
-- uma tela dedicada de edição de vendedor ser construída.
-- ===========================================================================

alter table public.empresas
  add column if not exists dia_pagamento     integer,
  add column if not exists bonus_campanha    numeric(12,2),
  add column if not exists faixa_elite_valor numeric(12,2),
  add column if not exists faixa_elite_pct   numeric(5,2);

alter table public.empresas
  drop constraint if exists empresas_dia_pagamento_faixa,
  add  constraint empresas_dia_pagamento_faixa
       check (dia_pagamento is null or (dia_pagamento >= 1 and dia_pagamento <= 31));
alter table public.empresas
  drop constraint if exists empresas_bonus_campanha_nao_neg,
  add  constraint empresas_bonus_campanha_nao_neg
       check (bonus_campanha is null or bonus_campanha >= 0);
alter table public.empresas
  drop constraint if exists empresas_faixa_elite_valor_nao_neg,
  add  constraint empresas_faixa_elite_valor_nao_neg
       check (faixa_elite_valor is null or faixa_elite_valor >= 0);
alter table public.empresas
  drop constraint if exists empresas_faixa_elite_pct_faixa,
  add  constraint empresas_faixa_elite_pct_faixa
       check (faixa_elite_pct is null or (faixa_elite_pct >= 0 and faixa_elite_pct <= 100));

comment on column public.empresas.dia_pagamento     is 'Franquia: dia de pagamento (1-31) — G1.4b.';
comment on column public.empresas.bonus_campanha    is 'Franquia: bônus de campanha — G1.4b.';
comment on column public.empresas.faixa_elite_valor is 'Franquia: faixa Elite — acima de R$ X a comissão passa a %. G1.4b.';
comment on column public.empresas.faixa_elite_pct   is 'Franquia: faixa Elite — % aplicado acima do valor. G1.4b.';

-- ---- Modelo "Full" (protótipo v10 tem Individual x Full; seed só tinha
-- Individual — nenhum modelo de franquia exemplificava modalidade='full') --
insert into public.modelos_franquia (nome, tipo, perc_comissao_padrao, descricao, ordem, params, modalidade)
select 'Full', 'franqueada', 50.0, 'Modelo Full — franqueado com equipe de vendedores', 6,
  '{"leads":"15-20","comVenda":"50%","comRenov":"20%","incentivo":"—","software":"R$ 120/mês","franquia":"R$ 12.000","royalties":"5%"}'::jsonb,
  'full'
where not exists (select 1 from public.modelos_franquia where nome = 'Full');
