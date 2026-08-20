-- ===========================================================================
-- V11 · Personalização geral — Modelo Master, Modelo Supervisor e gate de
-- diretor no catálogo de produtos.
--
-- Fidelidade ao protótipo (cotecerto_prototipo_v11.html):
--   - MODELO_MASTER / accModeloMaster() (~L7094/7100): comissão do Master
--     sobre a equipe (franquias/vendedores) + Campanha Elite Master
--     (ELITE_MASTER, ~L7093) + alçada (já cobertos por desconto_politicas).
--   - MODELO_SUPERVISOR / accModeloSupervisor() (~L7095/7123): "Config
--     preservada" — hoje o Supervisor (Matriz) não é comissionado, mas a tela
--     de edição continua existindo, caso a regra volte a valer (comentário
--     literal em accSupModelo(), ~L7623).
--   - accModeloProdutos() (~L7204): catálogo de produtos (nome, jornada
--     derivada, toggle ativo, Auto fixo) — tabela `produtos` já existe
--     (20260730031442_v11_f3_produtos_e_escopo_do_acesso.sql), mas SEM gate
--     de diretor. `produtos_padrao` também tinha policy de escrita direta
--     pra matriz/coordenador sem senha — inconsistente com o padrão do
--     resto da tela "Personalização geral", que sempre exige diretor+senha
--     (20260803090000_v11_g6_1_gate_diretor_politicas.sql).
--
-- Padrão seguido: RPC security definer com p_senha, monta DE/PARA, chama
-- fn_registrar_alteracao (V11.0.5/V11.0.6) e só então grava — mesmo esqueleto
-- de fn_salvar_clt_config/fn_salvar_modelos_franquia.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) modelo_master_config — singleton (id='default')
-- ---------------------------------------------------------------------------
create table if not exists public.modelo_master_config (
  id              text primary key default 'default',
  comissao_grupo  text not null default '20%' check (char_length(comissao_grupo) between 1 and 20),
  royalties       text not null default '5%' check (char_length(royalties) between 1 and 20),
  base_calc       text not null default 'Comissão líquida da equipe (inclui renovações, menos estornos)'
                    check (char_length(base_calc) between 1 and 300),
  pagamento       text not null default '5º dia útil' check (char_length(pagamento) between 1 and 60),
  -- ELITE_MASTER: [[categoria, faixa_minima, bonus_pct], ...] — só o bônus é editável na tela.
  elite           jsonb not null default '[
    ["Bronze","≥ 200 mil","5%"],
    ["Prata","≥ 250 mil","10%"],
    ["Ouro","≥ 300 mil","25%"],
    ["Platinum","≥ 400 mil","40%"],
    ["Elite","≥ 500 mil","50%"]
  ]'::jsonb,
  atualizado_em   timestamptz not null default now()
);

comment on table public.modelo_master_config is
  'Padrão de comissão do Master franqueado sobre a equipe (franquias/vendedores
   supervisionados) + Campanha Elite Master. Espelha MODELO_MASTER/ELITE_MASTER
   do protótipo v11. Singleton (id=''default''). Editável só via
   fn_salvar_modelo_master (gate de diretor).';

alter table public.modelo_master_config enable row level security;
revoke all on public.modelo_master_config from public, anon, authenticated;
grant select on public.modelo_master_config to authenticated;
grant all on public.modelo_master_config to service_role;

drop policy if exists modelo_master_config_select on public.modelo_master_config;
create policy modelo_master_config_select on public.modelo_master_config
  for select to authenticated using (true);

insert into public.modelo_master_config (id) values ('default')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2) modelo_supervisor_config — singleton (id='default')
--
-- "Config preservada" (accSupModelo(), protótipo): hoje o Supervisor (Matriz)
-- não é comissionado em lugar nenhum do motor de comissão, mas a tela de
-- edição existe do mesmo jeito, caso a regra volte a valer.
-- ---------------------------------------------------------------------------
create table if not exists public.modelo_supervisor_config (
  id              text primary key default 'default',
  comissao_grupo  text not null default '15%' check (char_length(comissao_grupo) between 1 and 20),
  royalties       text not null default '5%' check (char_length(royalties) between 1 and 20),
  base_calc       text not null default 'Comissão líquida das franquias supervisionadas'
                    check (char_length(base_calc) between 1 and 300),
  pagamento       text not null default '5º dia útil' check (char_length(pagamento) between 1 and 60),
  atualizado_em   timestamptz not null default now()
);

comment on table public.modelo_supervisor_config is
  'Padrão de comissão do Supervisor (Matriz) sobre as franquias supervisionadas.
   Espelha MODELO_SUPERVISOR do protótipo v11. "Config preservada": hoje o
   Supervisor não é comissionado em nenhum lugar do motor de comissão — a tela
   existe caso a regra volte a valer. Singleton (id=''default''). Editável só
   via fn_salvar_modelo_supervisor (gate de diretor).';

alter table public.modelo_supervisor_config enable row level security;
revoke all on public.modelo_supervisor_config from public, anon, authenticated;
grant select on public.modelo_supervisor_config to authenticated;
grant all on public.modelo_supervisor_config to service_role;

drop policy if exists modelo_supervisor_config_select on public.modelo_supervisor_config;
create policy modelo_supervisor_config_select on public.modelo_supervisor_config
  for select to authenticated using (true);

insert into public.modelo_supervisor_config (id) values ('default')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3) fn_salvar_modelo_master(p_senha, p_comissao_grupo, p_royalties,
--    p_base_calc, p_pagamento, p_elite)
-- ---------------------------------------------------------------------------
create or replace function public.fn_salvar_modelo_master(
  p_senha          text,
  p_comissao_grupo text,
  p_royalties      text,
  p_base_calc      text,
  p_pagamento      text,
  p_elite          jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _antes public.modelo_master_config;
  _de_para jsonb := '[]'::jsonb;
begin
  select * into _antes from public.modelo_master_config where id = 'default';
  if _antes is null then
    raise exception 'Configuração do Modelo Master não encontrada.';
  end if;

  if _antes.comissao_grupo is distinct from p_comissao_grupo then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Modelo Master · % sobre a comissão da equipe', 'de', _antes.comissao_grupo, 'para', p_comissao_grupo));
  end if;
  if _antes.royalties is distinct from p_royalties then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Modelo Master · royalties + FPP', 'de', _antes.royalties, 'para', p_royalties));
  end if;
  if _antes.base_calc is distinct from p_base_calc then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Modelo Master · base de cálculo', 'de', _antes.base_calc, 'para', p_base_calc));
  end if;
  if _antes.pagamento is distinct from p_pagamento then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Modelo Master · pagamento', 'de', _antes.pagamento, 'para', p_pagamento));
  end if;
  if _antes.elite is distinct from p_elite then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Modelo Master · Campanha Elite', 'de', _antes.elite::text, 'para', p_elite::text));
  end if;

  perform public.fn_registrar_alteracao(
    'Personalização geral',
    'Modelo Master alterado (padrão + Campanha Elite)',
    p_senha,
    case when jsonb_array_length(_de_para) > 0 then _de_para else null end,
    null
  );

  update public.modelo_master_config
     set comissao_grupo = p_comissao_grupo,
         royalties = p_royalties,
         base_calc = p_base_calc,
         pagamento = p_pagamento,
         elite = p_elite,
         atualizado_em = now()
   where id = 'default';
end;
$function$;

revoke all on function public.fn_salvar_modelo_master(text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.fn_salvar_modelo_master(text, text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) fn_salvar_modelo_supervisor(p_senha, p_comissao_grupo, p_royalties,
--    p_base_calc, p_pagamento)
-- ---------------------------------------------------------------------------
create or replace function public.fn_salvar_modelo_supervisor(
  p_senha          text,
  p_comissao_grupo text,
  p_royalties      text,
  p_base_calc      text,
  p_pagamento      text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _antes public.modelo_supervisor_config;
  _de_para jsonb := '[]'::jsonb;
begin
  select * into _antes from public.modelo_supervisor_config where id = 'default';
  if _antes is null then
    raise exception 'Configuração do Modelo Supervisor não encontrada.';
  end if;

  if _antes.comissao_grupo is distinct from p_comissao_grupo then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Modelo Supervisor · % sobre a comissão das franquias', 'de', _antes.comissao_grupo, 'para', p_comissao_grupo));
  end if;
  if _antes.royalties is distinct from p_royalties then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Modelo Supervisor · royalties + FPP', 'de', _antes.royalties, 'para', p_royalties));
  end if;
  if _antes.base_calc is distinct from p_base_calc then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Modelo Supervisor · base de cálculo', 'de', _antes.base_calc, 'para', p_base_calc));
  end if;
  if _antes.pagamento is distinct from p_pagamento then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Modelo Supervisor · pagamento', 'de', _antes.pagamento, 'para', p_pagamento));
  end if;

  perform public.fn_registrar_alteracao(
    'Personalização geral',
    'Modelo Supervisor alterado (padrão)',
    p_senha,
    case when jsonb_array_length(_de_para) > 0 then _de_para else null end,
    null
  );

  update public.modelo_supervisor_config
     set comissao_grupo = p_comissao_grupo,
         royalties = p_royalties,
         base_calc = p_base_calc,
         pagamento = p_pagamento,
         atualizado_em = now()
   where id = 'default';
end;
$function$;

revoke all on function public.fn_salvar_modelo_supervisor(text, text, text, text, text) from public, anon;
grant execute on function public.fn_salvar_modelo_supervisor(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Gate de diretor no catálogo de produtos (produtos + produtos_padrao)
--
-- `produtos` já era select-only pra authenticated (sem policy de escrita
-- nenhuma — só service_role escrevia). `produtos_padrao` tinha policy de
-- escrita direta pra matriz/coordenador SEM senha — inconsistente com o
-- resto da tela. Revoga a escrita direta de ambas e centraliza em RPCs.
-- ---------------------------------------------------------------------------
drop policy if exists produtos_padrao_escrita on public.produtos_padrao;
revoke insert, update, delete on public.produtos_padrao from authenticated;
revoke insert, update, delete on public.produtos from authenticated;

-- 5a) fn_salvar_produtos_catalogo(p_senha, p_produtos, p_novo_nome)
--     p_produtos: [{id, nome, ativo}, ...] — upsert de nome/ativo dos produtos
--     existentes (Auto nunca muda ativo/nome via aqui — é fixo).
--     p_novo_nome: texto opcional — se preenchido, cria 1 produto novo
--     (tem_jornada=false, ativo=true, fixo=false), com id derivado do nome
--     (mesma lógica do salvarNovoProduto() do protótipo).
create or replace function public.fn_salvar_produtos_catalogo(
  p_senha     text,
  p_produtos  jsonb default '[]'::jsonb,
  p_novo_nome text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _de_para jsonb := '[]'::jsonb;
  _item jsonb;
  _antes public.produtos;
  _novo_id text;
  _novo_nome text;
begin
  for _item in select * from jsonb_array_elements(p_produtos)
  loop
    select * into _antes from public.produtos where id = _item->>'id';
    if _antes is null then continue; end if;
    if _antes.fixo then continue; end if; -- Auto é fixo: ignora qualquer tentativa de alterar por aqui

    if _antes.nome is distinct from (_item->>'nome') then
      _de_para := _de_para || jsonb_build_array(jsonb_build_object(
        'campo', format('Produtos · %s · nome', _antes.nome), 'de', _antes.nome, 'para', _item->>'nome'));
    end if;
    if _antes.ativo is distinct from (_item->>'ativo')::boolean then
      _de_para := _de_para || jsonb_build_array(jsonb_build_object(
        'campo', format('Produtos · %s · ativo', _antes.nome), 'de', _antes.ativo::text, 'para', (_item->>'ativo')));
    end if;
  end loop;

  if p_novo_nome is not null and length(trim(p_novo_nome)) > 0 then
    _novo_nome := trim(p_novo_nome);
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Produtos · novo produto', 'de', '—', 'para', _novo_nome));
  end if;

  perform public.fn_registrar_alteracao(
    'Personalização geral',
    'Catálogo de produtos alterado',
    p_senha,
    case when jsonb_array_length(_de_para) > 0 then _de_para else null end,
    null
  );

  for _item in select * from jsonb_array_elements(p_produtos)
  loop
    update public.produtos
       set nome = _item->>'nome',
           ativo = (_item->>'ativo')::boolean
     where id = _item->>'id'
       and fixo = false;
  end loop;

  if _novo_nome is not null then
    _novo_id := lower(regexp_replace(_novo_nome, '[^a-zA-Z0-9]', '', 'g'));
    if _novo_id is null or length(_novo_id) = 0 then
      _novo_id := 'p' || extract(epoch from now())::bigint::text;
    end if;
    _novo_id := left(_novo_id, 12);
    if exists (select 1 from public.produtos where id = _novo_id) then
      _novo_id := _novo_id || extract(epoch from now())::bigint::text;
    end if;
    insert into public.produtos (id, nome, fixo, ativo, tem_jornada, ordem)
    values (_novo_id, _novo_nome, false, true, false,
      coalesce((select max(ordem) from public.produtos), 0) + 1);
  end if;
end;
$function$;

revoke all on function public.fn_salvar_produtos_catalogo(text, jsonb, text) from public, anon;
grant execute on function public.fn_salvar_produtos_catalogo(text, jsonb, text) to authenticated;

-- 5b) fn_salvar_produtos_padrao(p_senha, p_bloco, p_produto_ids)
--     Substitui o conjunto de produtos padrão de um bloco ('interno'/'externo')
--     pela lista informada — o Auto sempre volta via fn_produtos_padrao() (union
--     com o fixo), então não precisa estar na lista.
create or replace function public.fn_salvar_produtos_padrao(
  p_senha        text,
  p_bloco        text,
  p_produto_ids  jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _antes text[];
  _depois text[];
  _de_para jsonb;
begin
  if p_bloco not in ('interno', 'externo') then
    raise exception 'Bloco inválido: %', p_bloco;
  end if;

  select array_agg(produto_id order by produto_id) into _antes
    from public.produtos_padrao where bloco = p_bloco;

  select array_agg(value order by value) into _depois
    from jsonb_array_elements_text(p_produto_ids);

  if coalesce(_antes, array[]::text[]) is distinct from coalesce(_depois, array[]::text[]) then
    _de_para := jsonb_build_array(jsonb_build_object(
      'campo', format('Produtos padrão · %s', p_bloco),
      'de', array_to_string(coalesce(_antes, array[]::text[]), ', '),
      'para', array_to_string(coalesce(_depois, array[]::text[]), ', ')));
  end if;

  perform public.fn_registrar_alteracao(
    'Personalização geral',
    'Produtos padrão alterados',
    p_senha,
    _de_para,
    null
  );

  delete from public.produtos_padrao
   where bloco = p_bloco
     and produto_id not in (select value from jsonb_array_elements_text(p_produto_ids))
     and produto_id not in (select id from public.produtos where fixo);

  insert into public.produtos_padrao (bloco, produto_id)
  select p_bloco, v.value from jsonb_array_elements_text(p_produto_ids) v(value)
  on conflict do nothing;
end;
$function$;

revoke all on function public.fn_salvar_produtos_padrao(text, text, jsonb) from public, anon;
grant execute on function public.fn_salvar_produtos_padrao(text, text, jsonb) to authenticated;
