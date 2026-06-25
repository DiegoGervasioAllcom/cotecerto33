-- ===========================================================================
-- CoteCerto 3.3 — Migração 005
-- Personalização geral: Modelo Franquia (CRUD com parâmetros) + Modelo CLT
-- ===========================================================================

-- ---------- MODELOS DE FRANQUIA: parâmetros + ordem ----------
alter table public.modelos_franquia add column if not exists params jsonb not null default '{}'::jsonb;
alter table public.modelos_franquia add column if not exists ordem integer not null default 0;

-- Seed dos 5 modelos padrão (Smart, Conecta, Light, Link, Flex)
insert into public.modelos_franquia (nome, tipo, perc_comissao_padrao, descricao, ordem, params)
values
  ('Smart',  'franqueada', 50.0, 'Modelo Smart',  1,
    '{"leads":"8-10","comVenda":"50%","comRenov":"20%","incentivo":"—","software":"—","franquia":"R$ 6.000","royalties":"5%"}'::jsonb),
  ('Conecta','franqueada', 50.0, 'Modelo Conecta',2,
    '{"leads":"8-10","comVenda":"50%","comRenov":"20%","incentivo":"—","software":"R$ 120/mês","franquia":"R$ 499","royalties":"5%"}'::jsonb),
  ('Light',  'franqueada', 50.0, 'Modelo Light',  3,
    '{"leads":"4-5","comVenda":"50%","comRenov":"20%","incentivo":"—","software":"—","franquia":"R$ 4.000","royalties":"5%"}'::jsonb),
  ('Link',   'franqueada', 60.0, 'Modelo Link',   4,
    '{"leads":"não recebe","comVenda":"60%","comRenov":"20%","incentivo":"—","software":"—","franquia":"R$ 2.000","royalties":"5%"}'::jsonb),
  ('Flex',   'franqueada', 30.0, 'Modelo Flex',   5,
    '{"leads":"10-15","comVenda":"30-35%","comRenov":"não recebe","incentivo":"R$ 100/dia","software":"—","franquia":"Isento","royalties":"5%"}'::jsonb)
on conflict do nothing;

-- ---------- CONFIGURAÇÃO MODELO CLT (singleton) ----------
create table if not exists public.clt_config (
  id text primary key default 'default',
  progressiva    jsonb not null default '[]'::jsonb,
  fator_novas    jsonb not null default '[]'::jsonb,
  fator_remalho  jsonb not null default '[]'::jsonb,
  ituran_planos  jsonb not null default '[]'::jsonb,
  ituran_adic    jsonb not null default '[]'::jsonb,
  regras         jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now()
);

grant select on public.clt_config to authenticated;
grant all on public.clt_config to service_role;
alter table public.clt_config enable row level security;

drop policy if exists clt_select on public.clt_config;
create policy clt_select on public.clt_config
  for select to authenticated using (true);

drop policy if exists clt_admin on public.clt_config;
create policy clt_admin on public.clt_config
  for all to authenticated
  using (public.has_role(auth.uid(),'matriz'))
  with check (public.has_role(auth.uid(),'matriz'));

insert into public.clt_config (id, progressiva, fator_novas, fator_remalho, ituran_planos, ituran_adic, regras)
values (
  'default',
  '[["0,01 – 40.000","2,00%"],["40.001 – 55.000","2,25%"],["55.001 – 65.000","2,50%"],["65.001 – 75.000","2,75%"],["75.001 – 85.000","3,00%"],["85.001 – 100.000","3,25%"],["100.001+","3,50%"]]'::jsonb,
  '[["< 17","70%"],["17 a 18","80%"],["18,01 a 19","90%"],["19,01 a 20","95%"],["Acima de 20%","100%"]]'::jsonb,
  '[["< 14","70%"],["14 a 15","80%"],["15,01 a 16","90%"],["16,01 a 17","95%"],["Acima de 17%","100%"]]'::jsonb,
  '[["Rastreador","20,00"],["Ituran com Seguro (Roubo e Furto)","30,00"],["+ Perda Total (PT)","40,00"],["+ Terceiros","40,00"],["+ PT + Terceiros","50,00"],["Seguro Completo","60,00"],["Light (Roubo e Furto)","30,00"],["Light + Terceiros","40,00"],["One (R&F) 75%/90% Fipe","30,00"]]'::jsonb,
  '[["Assist auto + resid","2,50"],["Lataria e pintura + martelinho","3,80"],["Vidros","3,80"],["Acessórios + FLR","3,58"],["Lataria + FLR","5,83"],["Lataria + FLR + vidros","8,08"],["Lataria + FLR + vidros + buracos","9,65"],["Carro reserva","0,75"],["Pneu, roda, suspensão","3,80"],["Lataria + farol, lanterna, retrov","3,80"],["Assist moto + resid","3,55"],["Lataria + FLR + Buracos (Moto)","3,80"],["Seguro Autopeças","3,66"],["Seguro Conteúdo","3,98"]]'::jsonb,
  '{"apuracao_ini":"26","apuracao_fim":"25","pagamento":"5º dia útil","iof":"7,38%","rules":["Pagamento de comissão + salário + DSR.","Estorno integral de vendas canceladas em até 90 dias.","Sem comissão sobre juros, IOF, instalação de rastreador/deslocamento ou vendas não concluídas."]}'::jsonb
)
on conflict (id) do nothing;
