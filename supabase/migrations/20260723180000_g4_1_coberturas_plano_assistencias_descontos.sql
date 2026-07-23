-- ===========================================================================
-- G4.1 — Passo 5 (Coberturas) do wizard "Novo lead": campos que faltavam
-- para bater com o protótipo v10 E com o contrato real da API de cotação
-- (Quiver — ver doc/EXTERNAL_API_GUIDE.md, src/api/validators/
-- cotacao.validator.ts e src/api/docs/openapi.yaml do projeto
-- /Users/diego.gervasio/Documents/playwright, objeto `cobertura`).
--
-- Não mexe em tipo_cobertura/casco/casco_valor/franquia/vidros/
-- carro_reserva/assist_24 (já existentes, usados em cotacoes.$id.tsx) —
-- só adiciona os campos novos do protótipo/Quiver.
--
-- descontos_agravos / comissoes: jsonb por seguradora (mesmo padrão de
-- antifurto_detalhes/acessorios_detalhes — G2.1), não vão no payload da
-- Quiver (não existem no objeto `cobertura` real), só uso interno da
-- negociação com a matriz. condicoes_especiais: jsonb com os 3 switches
-- "Worksite/Affinity" do protótipo (também não vai à Quiver).
-- ===========================================================================

alter table public.cotacao_coberturas
  add column if not exists modalidade                    text,
  add column if not exists percentual_ajuste              text,
  add column if not exists franquia_primeira_opcao        text,
  add column if not exists franquia_segunda_opcao         text,
  add column if not exists danos_morais                   text,
  add column if not exists despesas_extras                text,
  add column if not exists pequenos_reparos                boolean,
  add column if not exists mais_assistencias               boolean,
  add column if not exists mais_assistencias_seguradora    text,
  add column if not exists descontos_agravos              jsonb not null default '{}'::jsonb,
  add column if not exists comissoes                       jsonb not null default '{}'::jsonb,
  add column if not exists condicoes_especiais            jsonb not null default '{}'::jsonb;

alter table public.cotacao_coberturas
  drop constraint if exists cotacao_coberturas_modalidade_tam,
  add  constraint cotacao_coberturas_modalidade_tam check (char_length(modalidade) <= 50),
  drop constraint if exists cotacao_coberturas_percentual_ajuste_tam,
  add  constraint cotacao_coberturas_percentual_ajuste_tam check (char_length(percentual_ajuste) <= 10),
  drop constraint if exists cotacao_coberturas_franquia_primeira_opcao_tam,
  add  constraint cotacao_coberturas_franquia_primeira_opcao_tam check (char_length(franquia_primeira_opcao) <= 30),
  drop constraint if exists cotacao_coberturas_franquia_segunda_opcao_tam,
  add  constraint cotacao_coberturas_franquia_segunda_opcao_tam check (char_length(franquia_segunda_opcao) <= 30),
  drop constraint if exists cotacao_coberturas_danos_morais_tam,
  add  constraint cotacao_coberturas_danos_morais_tam check (char_length(danos_morais) <= 100),
  drop constraint if exists cotacao_coberturas_despesas_extras_tam,
  add  constraint cotacao_coberturas_despesas_extras_tam check (char_length(despesas_extras) <= 30),
  drop constraint if exists cotacao_coberturas_mais_assistencias_seguradora_tam,
  add  constraint cotacao_coberturas_mais_assistencias_seguradora_tam check (char_length(mais_assistencias_seguradora) <= 50),
  drop constraint if exists cotacao_coberturas_descontos_agravos_obj,
  add  constraint cotacao_coberturas_descontos_agravos_obj check (jsonb_typeof(descontos_agravos) = 'object'),
  drop constraint if exists cotacao_coberturas_comissoes_obj,
  add  constraint cotacao_coberturas_comissoes_obj check (jsonb_typeof(comissoes) = 'object'),
  drop constraint if exists cotacao_coberturas_condicoes_especiais_obj,
  add  constraint cotacao_coberturas_condicoes_especiais_obj check (jsonb_typeof(condicoes_especiais) = 'object');

comment on column public.cotacao_coberturas.descontos_agravos is 'Desconto/agravo e regras específicas por seguradora (G4.1) — chaves = nome da seguradora. Não enviado à Quiver (não existe no objeto cobertura real); uso interno de negociação com a matriz.';
comment on column public.cotacao_coberturas.comissoes is 'Percentual de comissão por seguradora (G4.1) — chaves = nome da seguradora. Não enviado à Quiver; uso interno.';
comment on column public.cotacao_coberturas.condicoes_especiais is 'Condições especiais Worksite/Affinity/planos populares (G4.1). Não enviado à Quiver; uso interno.';

-- ---- Recria a RPC incluindo os novos campos de cotacao_coberturas -------
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

  insert into public.cotacao_veiculo(
    cotacao_id, placa, chassi, renavam, marca_codigo, marca_nome, modelo_codigo, modelo_nome,
    ano_modelo, ano_fab, combustivel, cor, zero_km, blindado, alienado, banco, uso_comercial, km_mensal, fipe_valor,
    tipo_uso, uso_trabalho, uso_estudo, uso_comercial_dois_dias, categoria_taxi, utilizacao_locadora,
    condutores_que_utilizam, chassi_remarcado, leilao, isencao_imposto, pcd_cnh_especial, valor_adaptacao_pcd,
    possui_antifurto_porto, hdi_seguros_basico, antifurto, antifurto_detalhes, cep_circulacao, num_passageiros,
    blindagem, cobertura_blindagem, valor_blindagem, com_franquia_blindagem,
    kit_gas, cobertura_kit_gas, valor_kit_gas, com_franquia_kit_gas,
    acessorios, kit_acessorios, opcionais, equipamentos, acessorios_detalhes
  )
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
    p_payload->'veiculo'->>'km_mensal', p_payload->'veiculo'->>'fipe_valor',
    p_payload->'veiculo'->>'tipo_uso', p_payload->'veiculo'->>'uso_trabalho', p_payload->'veiculo'->>'uso_estudo',
    (p_payload->'veiculo'->>'uso_comercial_dois_dias')::boolean,
    p_payload->'veiculo'->>'categoria_taxi', p_payload->'veiculo'->>'utilizacao_locadora',
    p_payload->'veiculo'->>'condutores_que_utilizam',
    (p_payload->'veiculo'->>'chassi_remarcado')::boolean,
    p_payload->'veiculo'->>'leilao',
    p_payload->'veiculo'->>'isencao_imposto',
    (p_payload->'veiculo'->>'pcd_cnh_especial')::boolean,
    p_payload->'veiculo'->>'valor_adaptacao_pcd',
    (p_payload->'veiculo'->>'possui_antifurto_porto')::boolean,
    (p_payload->'veiculo'->>'hdi_seguros_basico')::boolean,
    p_payload->'veiculo'->>'antifurto',
    coalesce(p_payload->'veiculo'->'antifurto_detalhes', '{}'::jsonb),
    p_payload->'veiculo'->>'cep_circulacao', p_payload->'veiculo'->>'num_passageiros',
    (p_payload->'veiculo'->>'blindagem')::boolean,
    p_payload->'veiculo'->>'cobertura_blindagem', p_payload->'veiculo'->>'valor_blindagem',
    (p_payload->'veiculo'->>'com_franquia_blindagem')::boolean,
    (p_payload->'veiculo'->>'kit_gas')::boolean,
    (p_payload->'veiculo'->>'cobertura_kit_gas')::boolean,
    p_payload->'veiculo'->>'valor_kit_gas',
    (p_payload->'veiculo'->>'com_franquia_kit_gas')::boolean,
    (p_payload->'veiculo'->>'acessorios')::boolean,
    (p_payload->'veiculo'->>'kit_acessorios')::boolean,
    (p_payload->'veiculo'->>'opcionais')::boolean,
    (p_payload->'veiculo'->>'equipamentos')::boolean,
    coalesce(p_payload->'veiculo'->'acessorios_detalhes', '{}'::jsonb)
  )
  on conflict (cotacao_id) do update set
    placa=excluded.placa, chassi=excluded.chassi, renavam=excluded.renavam,
    marca_codigo=excluded.marca_codigo, marca_nome=excluded.marca_nome,
    modelo_codigo=excluded.modelo_codigo, modelo_nome=excluded.modelo_nome,
    ano_modelo=excluded.ano_modelo, ano_fab=excluded.ano_fab,
    combustivel=excluded.combustivel, cor=excluded.cor,
    zero_km=excluded.zero_km, blindado=excluded.blindado, alienado=excluded.alienado,
    banco=excluded.banco, uso_comercial=excluded.uso_comercial,
    km_mensal=excluded.km_mensal, fipe_valor=excluded.fipe_valor,
    tipo_uso=excluded.tipo_uso, uso_trabalho=excluded.uso_trabalho, uso_estudo=excluded.uso_estudo,
    uso_comercial_dois_dias=excluded.uso_comercial_dois_dias,
    categoria_taxi=excluded.categoria_taxi, utilizacao_locadora=excluded.utilizacao_locadora,
    condutores_que_utilizam=excluded.condutores_que_utilizam,
    chassi_remarcado=excluded.chassi_remarcado, leilao=excluded.leilao, isencao_imposto=excluded.isencao_imposto,
    pcd_cnh_especial=excluded.pcd_cnh_especial, valor_adaptacao_pcd=excluded.valor_adaptacao_pcd,
    possui_antifurto_porto=excluded.possui_antifurto_porto, hdi_seguros_basico=excluded.hdi_seguros_basico,
    antifurto=excluded.antifurto,
    antifurto_detalhes=excluded.antifurto_detalhes,
    cep_circulacao=excluded.cep_circulacao, num_passageiros=excluded.num_passageiros,
    blindagem=excluded.blindagem, cobertura_blindagem=excluded.cobertura_blindagem,
    valor_blindagem=excluded.valor_blindagem, com_franquia_blindagem=excluded.com_franquia_blindagem,
    kit_gas=excluded.kit_gas, cobertura_kit_gas=excluded.cobertura_kit_gas,
    valor_kit_gas=excluded.valor_kit_gas, com_franquia_kit_gas=excluded.com_franquia_kit_gas,
    acessorios=excluded.acessorios, kit_acessorios=excluded.kit_acessorios,
    opcionais=excluded.opcionais, equipamentos=excluded.equipamentos,
    acessorios_detalhes=excluded.acessorios_detalhes;

  insert into public.cotacao_perfil(
    cotacao_id, condutor_mesmo, cond_cpf, cond_nome, cond_nasc, cond_sexo, cond_estado_civil,
    cond_relacao, cond_nome_social, cond_tempo_habilitacao,
    profissao, cep_pernoite, tipo_garagem,
    seg_proprietario, relacao_com_proprietario, proprietario_tipo_pessoa,
    proprietario_cpf, proprietario_cnpj, proprietario_nome, proprietario_nome_social,
    proprietario_sexo, proprietario_nascimento, proprietario_estado_civil,
    tipo_residencia, tipo_atividade_empresa, ramo_atividade, profissao_principal_condutor,
    seguro_corretor_proximo, jovens_18_25, jovens_18_25_detalhes
  )
  values (_cot_id,
    coalesce((p_payload->'perfil'->>'condutor_mesmo')::boolean, true),
    p_payload->'perfil'->>'cond_cpf', p_payload->'perfil'->>'cond_nome',
    nullif(p_payload->'perfil'->>'cond_nasc','')::date,
    p_payload->'perfil'->>'cond_sexo', p_payload->'perfil'->>'cond_estado_civil',
    p_payload->'perfil'->>'cond_relacao', p_payload->'perfil'->>'cond_nome_social',
    p_payload->'perfil'->>'cond_tempo_habilitacao',
    p_payload->'perfil'->>'profissao', p_payload->'perfil'->>'cep_pernoite',
    p_payload->'perfil'->>'tipo_garagem',
    coalesce((p_payload->'perfil'->>'seg_proprietario')::boolean, true),
    p_payload->'perfil'->>'relacao_com_proprietario', p_payload->'perfil'->>'proprietario_tipo_pessoa',
    p_payload->'perfil'->>'proprietario_cpf', p_payload->'perfil'->>'proprietario_cnpj',
    p_payload->'perfil'->>'proprietario_nome', p_payload->'perfil'->>'proprietario_nome_social',
    p_payload->'perfil'->>'proprietario_sexo',
    nullif(p_payload->'perfil'->>'proprietario_nascimento','')::date,
    p_payload->'perfil'->>'proprietario_estado_civil',
    p_payload->'perfil'->>'tipo_residencia', p_payload->'perfil'->>'tipo_atividade_empresa',
    p_payload->'perfil'->>'ramo_atividade', p_payload->'perfil'->>'profissao_principal_condutor',
    (p_payload->'perfil'->>'seguro_corretor_proximo')::boolean,
    coalesce((p_payload->'perfil'->>'jovens_18_25')::boolean,false),
    coalesce(p_payload->'perfil'->'jovens_18_25_detalhes', '[]'::jsonb))
  on conflict (cotacao_id) do update set
    condutor_mesmo=excluded.condutor_mesmo, cond_cpf=excluded.cond_cpf, cond_nome=excluded.cond_nome,
    cond_nasc=excluded.cond_nasc, cond_sexo=excluded.cond_sexo, cond_estado_civil=excluded.cond_estado_civil,
    cond_relacao=excluded.cond_relacao, cond_nome_social=excluded.cond_nome_social,
    cond_tempo_habilitacao=excluded.cond_tempo_habilitacao,
    profissao=excluded.profissao, cep_pernoite=excluded.cep_pernoite, tipo_garagem=excluded.tipo_garagem,
    seg_proprietario=excluded.seg_proprietario, relacao_com_proprietario=excluded.relacao_com_proprietario,
    proprietario_tipo_pessoa=excluded.proprietario_tipo_pessoa,
    proprietario_cpf=excluded.proprietario_cpf, proprietario_cnpj=excluded.proprietario_cnpj,
    proprietario_nome=excluded.proprietario_nome, proprietario_nome_social=excluded.proprietario_nome_social,
    proprietario_sexo=excluded.proprietario_sexo, proprietario_nascimento=excluded.proprietario_nascimento,
    proprietario_estado_civil=excluded.proprietario_estado_civil,
    tipo_residencia=excluded.tipo_residencia, tipo_atividade_empresa=excluded.tipo_atividade_empresa,
    ramo_atividade=excluded.ramo_atividade, profissao_principal_condutor=excluded.profissao_principal_condutor,
    seguro_corretor_proximo=excluded.seguro_corretor_proximo,
    jovens_18_25=excluded.jovens_18_25, jovens_18_25_detalhes=excluded.jovens_18_25_detalhes;

  insert into public.cotacao_coberturas(
    cotacao_id, tipo_cobertura, casco, casco_valor, franquia, app_morte, app_invalidez, dmh, rcf_dm, rcf_dc,
    vidros, carro_reserva, assist_24,
    modalidade, percentual_ajuste, franquia_primeira_opcao, franquia_segunda_opcao,
    danos_morais, despesas_extras, pequenos_reparos,
    mais_assistencias, mais_assistencias_seguradora,
    descontos_agravos, comissoes, condicoes_especiais
  )
  values (_cot_id,
    p_payload->'coberturas'->>'tipo_cobertura', p_payload->'coberturas'->>'casco',
    p_payload->'coberturas'->>'casco_valor', p_payload->'coberturas'->>'franquia',
    p_payload->'coberturas'->>'app_morte', p_payload->'coberturas'->>'app_invalidez',
    p_payload->'coberturas'->>'dmh', p_payload->'coberturas'->>'rcf_dm', p_payload->'coberturas'->>'rcf_dc',
    coalesce((p_payload->'coberturas'->>'vidros')::boolean,false),
    p_payload->'coberturas'->>'carro_reserva', p_payload->'coberturas'->>'assist_24',
    p_payload->'coberturas'->>'modalidade', p_payload->'coberturas'->>'percentual_ajuste',
    p_payload->'coberturas'->>'franquia_primeira_opcao', p_payload->'coberturas'->>'franquia_segunda_opcao',
    p_payload->'coberturas'->>'danos_morais', p_payload->'coberturas'->>'despesas_extras',
    (p_payload->'coberturas'->>'pequenos_reparos')::boolean,
    (p_payload->'coberturas'->>'mais_assistencias')::boolean,
    p_payload->'coberturas'->>'mais_assistencias_seguradora',
    coalesce(p_payload->'coberturas'->'descontos_agravos', '{}'::jsonb),
    coalesce(p_payload->'coberturas'->'comissoes', '{}'::jsonb),
    coalesce(p_payload->'coberturas'->'condicoes_especiais', '{}'::jsonb))
  on conflict (cotacao_id) do update set
    tipo_cobertura=excluded.tipo_cobertura, casco=excluded.casco, casco_valor=excluded.casco_valor,
    franquia=excluded.franquia, app_morte=excluded.app_morte, app_invalidez=excluded.app_invalidez,
    dmh=excluded.dmh, rcf_dm=excluded.rcf_dm, rcf_dc=excluded.rcf_dc,
    vidros=excluded.vidros, carro_reserva=excluded.carro_reserva, assist_24=excluded.assist_24,
    modalidade=excluded.modalidade, percentual_ajuste=excluded.percentual_ajuste,
    franquia_primeira_opcao=excluded.franquia_primeira_opcao, franquia_segunda_opcao=excluded.franquia_segunda_opcao,
    danos_morais=excluded.danos_morais, despesas_extras=excluded.despesas_extras,
    pequenos_reparos=excluded.pequenos_reparos,
    mais_assistencias=excluded.mais_assistencias, mais_assistencias_seguradora=excluded.mais_assistencias_seguradora,
    descontos_agravos=excluded.descontos_agravos, comissoes=excluded.comissoes,
    condicoes_especiais=excluded.condicoes_especiais;

  if jsonb_typeof(p_payload->'premios') = 'array' then
    delete from public.cotacao_premios where cotacao_id = _cot_id;
    insert into public.cotacao_premios(cotacao_id, seguradora, cobertura, premio)
    select _cot_id, x->>'seguradora', x->>'cobertura', coalesce((x->>'premio')::numeric, 0)
    from jsonb_array_elements(p_payload->'premios') as x;
    update public.cotacoes set status = 'calculada' where id = _cot_id and status = 'rascunho';
  end if;

  return _cot_id;
end;
$$;

grant execute on function public.salvar_cotacao_rascunho(uuid, jsonb) to authenticated;
