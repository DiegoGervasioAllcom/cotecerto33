-- ============================================================
-- 007: Cotações (wizard Novo Lead) — tabelas dedicadas
-- ============================================================

create type if not exists public.cotacao_status as enum (
  'rascunho','calculada','proposta','aceita','perdida'
);

-- ---------- COTAÇÕES (núcleo) ----------
create table if not exists public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  responsavel_id uuid references auth.users(id) on delete set null,
  status public.cotacao_status not null default 'rascunho',
  step_atual smallint not null default 0,
  ramo text not null default 'Automóvel',
  numero serial,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.cotacoes to authenticated;
grant all on public.cotacoes to service_role;
alter table public.cotacoes enable row level security;

create index if not exists cotacoes_empresa_idx on public.cotacoes(empresa_id);
create index if not exists cotacoes_resp_idx on public.cotacoes(responsavel_id);
create index if not exists cotacoes_lead_idx on public.cotacoes(lead_id);

drop policy if exists cot_select on public.cotacoes;
create policy cot_select on public.cotacoes for select to authenticated using (
  responsavel_id = auth.uid()
  or empresa_id in (select empresa_id from public.profiles where id=auth.uid())
  or exists (select 1 from public.profiles p where p.id=auth.uid() and p.perfil in ('matriz','master'))
);
drop policy if exists cot_iud on public.cotacoes;
create policy cot_iud on public.cotacoes for all to authenticated
  using (responsavel_id = auth.uid())
  with check (responsavel_id = auth.uid());

-- ---------- SECÇÕES (1:1) ----------
create table if not exists public.cotacao_segurado (
  cotacao_id uuid primary key references public.cotacoes(id) on delete cascade,
  cpf_cnpj text, pessoa text, nome text, nome_social text, nascimento date,
  sexo text, estado_civil text, celular text, tel_res text, email text,
  cep text, logradouro text, bairro text, cidade text, uf text, sms_optin boolean default false
);
create table if not exists public.cotacao_seguro (
  cotacao_id uuid primary key references public.cotacoes(id) on delete cascade,
  tipo_seguro text, ramo text, categoria text,
  vig_ini date, vig_fim date,
  cia_atual text, apolice_atual text, ci_atual text, classe_bonus text
);
create table if not exists public.cotacao_veiculo (
  cotacao_id uuid primary key references public.cotacoes(id) on delete cascade,
  placa text, chassi text, renavam text,
  marca_codigo text, marca_nome text,
  modelo_codigo text, modelo_nome text,
  ano_modelo text, ano_fab text, combustivel text, cor text,
  zero_km boolean, blindado boolean, alienado boolean, banco text,
  uso_comercial text, km_mensal text, fipe_valor text
);
create table if not exists public.cotacao_perfil (
  cotacao_id uuid primary key references public.cotacoes(id) on delete cascade,
  condutor_mesmo boolean default true,
  cond_cpf text, cond_nome text, cond_nasc date, cond_sexo text, cond_estado_civil text,
  profissao text, cep_pernoite text,
  garagem_resid boolean, garagem_trab boolean, garagem_esc boolean,
  jovens_18_25 boolean
);
create table if not exists public.cotacao_coberturas (
  cotacao_id uuid primary key references public.cotacoes(id) on delete cascade,
  tipo_cobertura text, casco text, casco_valor text, franquia text,
  app_morte text, app_invalidez text, dmh text, rcf_dm text, rcf_dc text,
  vidros boolean, carro_reserva text, assist_24 text
);

-- ---------- PRÊMIOS (1:N) ----------
create table if not exists public.cotacao_premios (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cotacoes(id) on delete cascade,
  seguradora text not null,
  cobertura text,
  premio numeric(14,2) not null default 0,
  selecionada boolean default false,
  criado_em timestamptz not null default now()
);
create index if not exists cot_premios_cot_idx on public.cotacao_premios(cotacao_id);

-- grants & RLS para as filhas (mesma policy: herda do dono via cotação)
do $$
declare t text;
begin
  foreach t in array array[
    'cotacao_segurado','cotacao_seguro','cotacao_veiculo',
    'cotacao_perfil','cotacao_coberturas','cotacao_premios'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('grant all on public.%I to service_role;', t);
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_rw on public.%I;', t, t);
    execute format($f$
      create policy %I_rw on public.%I for all to authenticated
      using (exists (select 1 from public.cotacoes c where c.id = %I.cotacao_id and (
        c.responsavel_id = auth.uid()
        or c.empresa_id in (select empresa_id from public.profiles where id=auth.uid())
        or exists (select 1 from public.profiles p where p.id=auth.uid() and p.perfil in ('matriz','master'))
      )))
      with check (exists (select 1 from public.cotacoes c where c.id = %I.cotacao_id and c.responsavel_id = auth.uid()));
    $f$, t, t, t, t);
  end loop;
end $$;

-- ---------- RPC: salvar rascunho (upsert atômico) ----------
drop function if exists public.salvar_cotacao_rascunho(uuid, jsonb);
create or replace function public.salvar_cotacao_rascunho(p_cotacao_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _cot_id uuid := p_cotacao_id;
  _empresa uuid;
  _user uuid := auth.uid();
  _lead_id uuid;
  _step smallint := coalesce((p_payload->>'step_atual')::smallint, 0);
  _nome text := coalesce(p_payload->'segurado'->>'nome', '');
  _contato text := coalesce(p_payload->'segurado'->>'celular', p_payload->'segurado'->>'email', '');
begin
  if _user is null then raise exception 'Não autenticado'; end if;
  select empresa_id into _empresa from public.profiles where id = _user;
  if _empresa is null then raise exception 'Usuário sem empresa'; end if;

  -- 1) cotação núcleo
  if _cot_id is null then
    insert into public.cotacoes (empresa_id, responsavel_id, status, step_atual, ramo)
    values (_empresa, _user, 'rascunho', _step, coalesce(p_payload->'seguro'->>'ramo','Automóvel'))
    returning id into _cot_id;

    -- cria lead vinculado
    insert into public.leads (empresa_id, responsavel_id, origem, nome, contato, status_pipeline)
    values (_empresa, _user, 'cotacao', nullif(_nome,''), nullif(_contato,''), 'cotacao')
    returning id into _lead_id;

    update public.cotacoes set lead_id = _lead_id where id = _cot_id;
  else
    update public.cotacoes
       set step_atual = _step,
           ramo = coalesce(p_payload->'seguro'->>'ramo', ramo),
           atualizado_em = now()
     where id = _cot_id;
    update public.leads
       set nome = coalesce(nullif(_nome,''), nome),
           contato = coalesce(nullif(_contato,''), contato),
           atualizado_em = now()
     where id = (select lead_id from public.cotacoes where id = _cot_id);
  end if;

  -- 2) seções (upsert)
  insert into public.cotacao_segurado(cotacao_id, cpf_cnpj, pessoa, nome, nome_social, nascimento, sexo, estado_civil, celular, tel_res, email, cep, logradouro, bairro, cidade, uf, sms_optin)
  values (_cot_id,
    p_payload->'segurado'->>'cpf', p_payload->'segurado'->>'pessoa',
    p_payload->'segurado'->>'nome', p_payload->'segurado'->>'nome_social',
    nullif(p_payload->'segurado'->>'nasc','')::date,
    p_payload->'segurado'->>'sexo', p_payload->'segurado'->>'estado_civil',
    p_payload->'segurado'->>'celular', p_payload->'segurado'->>'tel_res', p_payload->'segurado'->>'email',
    p_payload->'segurado'->>'cep', p_payload->'segurado'->>'logradouro', p_payload->'segurado'->>'bairro',
    p_payload->'segurado'->>'cidade', p_payload->'segurado'->>'uf',
    coalesce((p_payload->'segurado'->>'sms_optin')::boolean, false))
  on conflict (cotacao_id) do update set
    cpf_cnpj=excluded.cpf_cnpj, pessoa=excluded.pessoa, nome=excluded.nome, nome_social=excluded.nome_social,
    nascimento=excluded.nascimento, sexo=excluded.sexo, estado_civil=excluded.estado_civil,
    celular=excluded.celular, tel_res=excluded.tel_res, email=excluded.email,
    cep=excluded.cep, logradouro=excluded.logradouro, bairro=excluded.bairro,
    cidade=excluded.cidade, uf=excluded.uf, sms_optin=excluded.sms_optin;

  insert into public.cotacao_seguro(cotacao_id, tipo_seguro, ramo, categoria, vig_ini, vig_fim, cia_atual, apolice_atual, ci_atual, classe_bonus)
  values (_cot_id,
    p_payload->'seguro'->>'tipo_seguro', p_payload->'seguro'->>'ramo', p_payload->'seguro'->>'categoria',
    nullif(p_payload->'seguro'->>'vig_ini','')::date, nullif(p_payload->'seguro'->>'vig_fim','')::date,
    p_payload->'seguro'->>'cia_atual', p_payload->'seguro'->>'apolice_atual',
    p_payload->'seguro'->>'ci_atual', p_payload->'seguro'->>'classe_bonus')
  on conflict (cotacao_id) do update set
    tipo_seguro=excluded.tipo_seguro, ramo=excluded.ramo, categoria=excluded.categoria,
    vig_ini=excluded.vig_ini, vig_fim=excluded.vig_fim,
    cia_atual=excluded.cia_atual, apolice_atual=excluded.apolice_atual,
    ci_atual=excluded.ci_atual, classe_bonus=excluded.classe_bonus;

  insert into public.cotacao_veiculo(cotacao_id, placa, chassi, renavam, marca_codigo, marca_nome, modelo_codigo, modelo_nome, ano_modelo, ano_fab, combustivel, cor, zero_km, blindado, alienado, banco, uso_comercial, km_mensal, fipe_valor)
  values (_cot_id,
    p_payload->'veiculo'->>'placa', p_payload->'veiculo'->>'chassi', p_payload->'veiculo'->>'renavam',
    p_payload->'veiculo'->>'marca_codigo', p_payload->'veiculo'->>'marca_nome',
    p_payload->'veiculo'->>'modelo_codigo', p_payload->'veiculo'->>'modelo_nome',
    p_payload->'veiculo'->>'ano_modelo', p_payload->'veiculo'->>'ano_fab',
    p_payload->'veiculo'->>'combustivel', p_payload->'veiculo'->>'cor',
    coalesce((p_payload->'veiculo'->>'zero_km')::boolean,false),
    coalesce((p_payload->'veiculo'->>'blindado')::boolean,false),
    coalesce((p_payload->'veiculo'->>'alienado')::boolean,false),
    p_payload->'veiculo'->>'banco', p_payload->'veiculo'->>'uso_comercial',
    p_payload->'veiculo'->>'km_mensal', p_payload->'veiculo'->>'fipe_valor')
  on conflict (cotacao_id) do update set
    placa=excluded.placa, chassi=excluded.chassi, renavam=excluded.renavam,
    marca_codigo=excluded.marca_codigo, marca_nome=excluded.marca_nome,
    modelo_codigo=excluded.modelo_codigo, modelo_nome=excluded.modelo_nome,
    ano_modelo=excluded.ano_modelo, ano_fab=excluded.ano_fab, combustivel=excluded.combustivel,
    cor=excluded.cor, zero_km=excluded.zero_km, blindado=excluded.blindado, alienado=excluded.alienado,
    banco=excluded.banco, uso_comercial=excluded.uso_comercial, km_mensal=excluded.km_mensal,
    fipe_valor=excluded.fipe_valor;

  insert into public.cotacao_perfil(cotacao_id, condutor_mesmo, cond_cpf, cond_nome, cond_nasc, cond_sexo, cond_estado_civil, profissao, cep_pernoite, garagem_resid, garagem_trab, garagem_esc, jovens_18_25)
  values (_cot_id,
    coalesce((p_payload->'perfil'->>'condutor_mesmo')::boolean,true),
    p_payload->'perfil'->>'cond_cpf', p_payload->'perfil'->>'cond_nome',
    nullif(p_payload->'perfil'->>'cond_nasc','')::date,
    p_payload->'perfil'->>'cond_sexo', p_payload->'perfil'->>'cond_estado_civil',
    p_payload->'perfil'->>'profissao', p_payload->'perfil'->>'cep_pernoite',
    coalesce((p_payload->'perfil'->>'garagem_resid')::boolean,false),
    coalesce((p_payload->'perfil'->>'garagem_trab')::boolean,false),
    coalesce((p_payload->'perfil'->>'garagem_esc')::boolean,false),
    coalesce((p_payload->'perfil'->>'jovens_18_25')::boolean,false))
  on conflict (cotacao_id) do update set
    condutor_mesmo=excluded.condutor_mesmo, cond_cpf=excluded.cond_cpf, cond_nome=excluded.cond_nome,
    cond_nasc=excluded.cond_nasc, cond_sexo=excluded.cond_sexo, cond_estado_civil=excluded.cond_estado_civil,
    profissao=excluded.profissao, cep_pernoite=excluded.cep_pernoite,
    garagem_resid=excluded.garagem_resid, garagem_trab=excluded.garagem_trab,
    garagem_esc=excluded.garagem_esc, jovens_18_25=excluded.jovens_18_25;

  insert into public.cotacao_coberturas(cotacao_id, tipo_cobertura, casco, casco_valor, franquia, app_morte, app_invalidez, dmh, rcf_dm, rcf_dc, vidros, carro_reserva, assist_24)
  values (_cot_id,
    p_payload->'coberturas'->>'tipo_cobertura', p_payload->'coberturas'->>'casco',
    p_payload->'coberturas'->>'casco_valor', p_payload->'coberturas'->>'franquia',
    p_payload->'coberturas'->>'app_morte', p_payload->'coberturas'->>'app_invalidez',
    p_payload->'coberturas'->>'dmh', p_payload->'coberturas'->>'rcf_dm', p_payload->'coberturas'->>'rcf_dc',
    coalesce((p_payload->'coberturas'->>'vidros')::boolean,false),
    p_payload->'coberturas'->>'carro_reserva', p_payload->'coberturas'->>'assist_24')
  on conflict (cotacao_id) do update set
    tipo_cobertura=excluded.tipo_cobertura, casco=excluded.casco, casco_valor=excluded.casco_valor,
    franquia=excluded.franquia, app_morte=excluded.app_morte, app_invalidez=excluded.app_invalidez,
    dmh=excluded.dmh, rcf_dm=excluded.rcf_dm, rcf_dc=excluded.rcf_dc,
    vidros=excluded.vidros, carro_reserva=excluded.carro_reserva, assist_24=excluded.assist_24;

  -- prêmios (substitui se vier no payload)
  if p_payload ? 'premios' then
    delete from public.cotacao_premios where cotacao_id = _cot_id;
    insert into public.cotacao_premios(cotacao_id, seguradora, cobertura, premio)
    select _cot_id, x->>'seguradora', x->>'cobertura', coalesce((x->>'premio')::numeric, 0)
    from jsonb_array_elements(p_payload->'premios') x;
    update public.cotacoes set status = 'calculada' where id = _cot_id and status = 'rascunho';
  end if;

  return _cot_id;
end $$;

grant execute on function public.salvar_cotacao_rascunho(uuid, jsonb) to authenticated;
