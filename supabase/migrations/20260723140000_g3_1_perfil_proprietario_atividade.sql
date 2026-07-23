-- ===========================================================================
-- G3.1 — Passo 4 (Perfil) do wizard "Novo lead": campos que faltavam para
-- bater com o protótipo v10 E com o contrato real da API de cotação
-- (Quiver — ver doc/EXTERNAL_API_GUIDE.md e src/api/validators/
-- cotacao.validator.ts do projeto /Users/diego.gervasio/Documents/playwright).
--
-- Substitui os 3 checkboxes de garagem (garagem_resid/trab/esc — nunca
-- bateram nem com o protótipo nem com a API) por `tipo_garagem` (select
-- único de 4 valores, igual ao protótipo e ao guia da Quiver).
--
-- Adiciona o bloco "Proprietário do veículo" (só relevante quando o
-- segurado NÃO é o proprietário) e o bloco "Atividade" (obrigatório na
-- Quiver quando cotacao_veiculo.tipo_uso <> 'Particular').
--
-- `jovens_18_25_detalhes` fica em jsonb (array de {nome,idade,parentesco})
-- — mesmo padrão de antifurto_detalhes/acessorios_detalhes (G2.1): não é
-- enviado à Quiver (que só consome o flag pessoas17a25), é só um detalhe
-- interno útil pro vendedor.
--
-- Recria salvar_cotacao_rascunho incluindo os novos campos no upsert de
-- cotacao_perfil e removendo as referências a garagem_resid/trab/esc.
-- ===========================================================================

alter table public.cotacao_perfil
  drop column if exists garagem_resid,
  drop column if exists garagem_trab,
  drop column if exists garagem_esc;

alter table public.cotacao_perfil
  add column if not exists tipo_garagem                  text,
  add column if not exists seg_proprietario               boolean not null default true,
  add column if not exists relacao_com_proprietario       text,
  add column if not exists proprietario_tipo_pessoa       text,
  add column if not exists proprietario_cpf               text,
  add column if not exists proprietario_cnpj              text,
  add column if not exists proprietario_nome              text,
  add column if not exists proprietario_nome_social       text,
  add column if not exists proprietario_sexo              text,
  add column if not exists proprietario_nascimento        date,
  add column if not exists proprietario_estado_civil      text,
  add column if not exists cond_relacao                   text,
  add column if not exists cond_nome_social                text,
  add column if not exists cond_tempo_habilitacao          text,
  add column if not exists tipo_residencia                text,
  add column if not exists tipo_atividade_empresa         text,
  add column if not exists ramo_atividade                 text,
  add column if not exists profissao_principal_condutor   text,
  add column if not exists seguro_corretor_proximo        boolean,
  add column if not exists jovens_18_25_detalhes          jsonb not null default '[]'::jsonb;

alter table public.cotacao_perfil
  drop constraint if exists cotacao_perfil_tipo_garagem_tam,
  add  constraint cotacao_perfil_tipo_garagem_tam check (char_length(tipo_garagem) <= 100),
  drop constraint if exists cotacao_perfil_relacao_com_proprietario_tam,
  add  constraint cotacao_perfil_relacao_com_proprietario_tam check (char_length(relacao_com_proprietario) <= 100),
  drop constraint if exists cotacao_perfil_proprietario_tipo_pessoa_tam,
  add  constraint cotacao_perfil_proprietario_tipo_pessoa_tam check (char_length(proprietario_tipo_pessoa) <= 20),
  drop constraint if exists cotacao_perfil_proprietario_cpf_tam,
  add  constraint cotacao_perfil_proprietario_cpf_tam check (char_length(proprietario_cpf) <= 20),
  drop constraint if exists cotacao_perfil_proprietario_cnpj_tam,
  add  constraint cotacao_perfil_proprietario_cnpj_tam check (char_length(proprietario_cnpj) <= 20),
  drop constraint if exists cotacao_perfil_proprietario_nome_tam,
  add  constraint cotacao_perfil_proprietario_nome_tam check (char_length(proprietario_nome) <= 150),
  drop constraint if exists cotacao_perfil_proprietario_nome_social_tam,
  add  constraint cotacao_perfil_proprietario_nome_social_tam check (char_length(proprietario_nome_social) <= 150),
  drop constraint if exists cotacao_perfil_proprietario_sexo_tam,
  add  constraint cotacao_perfil_proprietario_sexo_tam check (char_length(proprietario_sexo) <= 30),
  drop constraint if exists cotacao_perfil_proprietario_estado_civil_tam,
  add  constraint cotacao_perfil_proprietario_estado_civil_tam check (char_length(proprietario_estado_civil) <= 30),
  drop constraint if exists cotacao_perfil_cond_relacao_tam,
  add  constraint cotacao_perfil_cond_relacao_tam check (char_length(cond_relacao) <= 50),
  drop constraint if exists cotacao_perfil_cond_nome_social_tam,
  add  constraint cotacao_perfil_cond_nome_social_tam check (char_length(cond_nome_social) <= 150),
  drop constraint if exists cotacao_perfil_cond_tempo_habilitacao_tam,
  add  constraint cotacao_perfil_cond_tempo_habilitacao_tam check (char_length(cond_tempo_habilitacao) <= 10),
  drop constraint if exists cotacao_perfil_tipo_residencia_tam,
  add  constraint cotacao_perfil_tipo_residencia_tam check (char_length(tipo_residencia) <= 30),
  drop constraint if exists cotacao_perfil_tipo_atividade_empresa_tam,
  add  constraint cotacao_perfil_tipo_atividade_empresa_tam check (char_length(tipo_atividade_empresa) <= 30),
  drop constraint if exists cotacao_perfil_ramo_atividade_tam,
  add  constraint cotacao_perfil_ramo_atividade_tam check (char_length(ramo_atividade) <= 150),
  drop constraint if exists cotacao_perfil_profissao_principal_condutor_tam,
  add  constraint cotacao_perfil_profissao_principal_condutor_tam check (char_length(profissao_principal_condutor) <= 150),
  drop constraint if exists cotacao_perfil_jovens_18_25_detalhes_arr,
  add  constraint cotacao_perfil_jovens_18_25_detalhes_arr check (jsonb_typeof(jovens_18_25_detalhes) = 'array');

comment on column public.cotacao_perfil.tipo_garagem            is 'Tipo de garagem do segurado (G3.1) — 4 valores do protótipo/guia Quiver.';
comment on column public.cotacao_perfil.seg_proprietario         is 'Segurado é o proprietário do veículo? (G3.1) — default true.';
comment on column public.cotacao_perfil.jovens_18_25_detalhes    is 'Detalhe dos condutores 17-25 anos (nome/idade/parentesco — G3.1). Não enviado à Quiver (só o flag pessoas17a25 é); uso interno do vendedor.';

-- ---- Recria a RPC incluindo os novos campos de cotacao_perfil -----------
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
    update public.cotacoes set status = 'calculada' where id = _cot_id and status = 'rascunho';
  end if;

  return _cot_id;
end;
$$;

grant execute on function public.salvar_cotacao_rascunho(uuid, jsonb) to authenticated;
