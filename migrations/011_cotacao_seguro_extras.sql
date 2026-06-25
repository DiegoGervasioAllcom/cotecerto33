-- 011: persistência de seguradoras selecionadas e demais campos do Step 2

alter table public.cotacao_seguro
  add column if not exists seguradoras_sel text[] default '{}',
  add column if not exists tipo_calculo text,
  add column if not exists tipo_cobertura text,
  add column if not exists grupo_producao text,
  add column if not exists campanha text,
  add column if not exists observacoes text;

-- Recria a RPC incluindo os novos campos no upsert de cotacao_seguro
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
  _segs text[];
begin
  if _user is null then raise exception 'Não autenticado'; end if;
  select empresa_id into _empresa from public.profiles where id = _user;
  if _empresa is null then raise exception 'Usuário sem empresa'; end if;

  if _cot_id is null then
    insert into public.cotacoes (empresa_id, responsavel_id, status, step_atual, ramo)
    values (_empresa, _user, 'rascunho', _step, coalesce(p_payload->'seguro'->>'ramo','Automóvel'))
    returning id into _cot_id;

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

  -- seguradoras_sel: aceita array JSON
  _segs := case
    when jsonb_typeof(p_payload->'seguro'->'seguradoras_sel') = 'array'
      then array(select jsonb_array_elements_text(p_payload->'seguro'->'seguradoras_sel'))
    else null
  end;

  insert into public.cotacao_seguro(cotacao_id, tipo_seguro, ramo, categoria, vig_ini, vig_fim, cia_atual, apolice_atual, ci_atual, classe_bonus, seguradoras_sel, tipo_calculo, tipo_cobertura, grupo_producao, campanha, observacoes)
  values (_cot_id,
    p_payload->'seguro'->>'tipo_seguro', p_payload->'seguro'->>'ramo', p_payload->'seguro'->>'categoria',
    nullif(p_payload->'seguro'->>'vig_ini','')::date, nullif(p_payload->'seguro'->>'vig_fim','')::date,
    p_payload->'seguro'->>'cia_atual', p_payload->'seguro'->>'apolice_atual',
    p_payload->'seguro'->>'ci_atual', p_payload->'seguro'->>'classe_bonus',
    coalesce(_segs, '{}'),
    p_payload->'seguro'->>'tipo_calculo', p_payload->'seguro'->>'tipo_cobertura',
    p_payload->'seguro'->>'grupo_producao', p_payload->'seguro'->>'campanha',
    p_payload->'seguro'->>'observacoes')
  on conflict (cotacao_id) do update set
    tipo_seguro=excluded.tipo_seguro, ramo=excluded.ramo, categoria=excluded.categoria,
    vig_ini=excluded.vig_ini, vig_fim=excluded.vig_fim,
    cia_atual=excluded.cia_atual, apolice_atual=excluded.apolice_atual,
    ci_atual=excluded.ci_atual, classe_bonus=excluded.classe_bonus,
    seguradoras_sel = coalesce(excluded.seguradoras_sel, public.cotacao_seguro.seguradoras_sel),
    tipo_calculo=excluded.tipo_calculo, tipo_cobertura=excluded.tipo_cobertura,
    grupo_producao=excluded.grupo_producao, campanha=excluded.campanha,
    observacoes=excluded.observacoes;

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
    ano_modelo=excluded.ano_modelo, ano_fab=excluded.ano_fab,
    combustivel=excluded.combustivel, cor=excluded.cor,
    zero_km=excluded.zero_km, blindado=excluded.blindado, alienado=excluded.alienado,
    banco=excluded.banco, uso_comercial=excluded.uso_comercial,
    km_mensal=excluded.km_mensal, fipe_valor=excluded.fipe_valor;

  insert into public.cotacao_perfil(cotacao_id, condutor_mesmo, cond_cpf, cond_nome, cond_nasc, cond_sexo, cond_estado_civil, profissao, cep_pernoite, garagem_resid, garagem_trab, garagem_esc, jovens_18_25)
  values (_cot_id,
    coalesce((p_payload->'perfil'->>'condutor_mesmo')::boolean, true),
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

  if jsonb_typeof(p_payload->'premios') = 'array' then
    delete from public.cotacao_premios where cotacao_id = _cot_id;
    insert into public.cotacao_premios(cotacao_id, seguradora, cobertura, premio)
    select _cot_id, x->>'seguradora', x->>'cobertura', coalesce((x->>'premio')::numeric, 0)
    from jsonb_array_elements(p_payload->'premios') as x;
  end if;

  return _cot_id;
end;
$$;

grant execute on function public.salvar_cotacao_rascunho(uuid, jsonb) to authenticated;
