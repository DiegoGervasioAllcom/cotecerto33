-- ===========================================================================
-- V11 · D3 (Frente 4) — números da janela deslizante da régua de performance
--
-- `fn_calcular_performance_pessoa` só CALCULA — não decide status (ativo/
-- atenção/travado); isso é do job (D4), que compara esses números contra os
-- limites de `regua_performance_config`. O retorno é o mesmo formato gravado
-- em `profiles.performance_motivo` (D1), pro modal de resumo (D9) não
-- precisar recalcular nada, só ler o que já foi persistido.
--
-- Só `service_role` executa. Não é exposta pro cliente: qualquer autenticado
-- poder chamar isso pra um `profile_id` arbitrário vazaria leads/propostas/
-- comissão de terceiros — o único consumidor previsto (D4, e futuramente D6)
-- já roda como job/RPC security definer, sem precisar desse grant.
--
-- Janela em dias corridos (não mês-calendário) — as views `v_vendedor_kpis`/
-- `v_franquia_kpis` são mês-fixo e usam a tabela legada `oportunidades`; D3
-- usa `propostas` (fluxo real de venda: gerada → transmitida → paga/cancelada).
-- ===========================================================================

create or replace function public.fn_calcular_performance_pessoa(p_profile_id uuid, p_bloco text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  _janela_dias int;
  _desde timestamptz;
  _leads int;
  _cotacoes int;
  _propostas int;
  _vendas int;
  _cancelamentos int;
  _conversao_pct numeric;
  _comissao numeric;
  _ultima_venda_em timestamptz;
  _dias_sem_venda int;
  _ano int;
  _mes int;
  _meta_vendas_mes int;
  _meta_vendas_prorata numeric;
begin
  if p_bloco not in ('interno', 'rede', 'full') then
    raise exception 'Bloco inválido: %', p_bloco;
  end if;

  select janela_dias into _janela_dias
    from public.regua_performance_config
   where bloco = p_bloco;
  if _janela_dias is null then
    raise exception 'Régua do bloco % não encontrada.', p_bloco;
  end if;
  _desde := now() - (_janela_dias || ' days')::interval;

  select count(*) into _leads
    from public.leads
   where responsavel_id = p_profile_id
     and criado_em >= _desde;

  select count(*) into _cotacoes
    from public.cotacoes
   where responsavel_id = p_profile_id
     and criado_em >= _desde;

  select count(*) into _propostas
    from public.propostas
   where responsavel_id = p_profile_id
     and criado_em >= _desde;

  -- "venda" = proposta emitida (status vira 'transmitida' só em
  -- marcar_apolice_emitida) dentro da janela. Uma venda cancelada depois some
  -- daqui (status vira 'cancelada') e entra em `_cancelamentos` — não conta
  -- nos dois ao mesmo tempo.
  select count(*) into _vendas
    from public.propostas
   where responsavel_id = p_profile_id
     and status = 'transmitida'
     and emitida_em >= _desde;

  -- cancelamento é sobre QUANDO cancelou, não sobre a janela em que a venda
  -- original foi criada — mesma convenção de `cancelada_em is null` usada em
  -- G3/G4 pra proposta "ainda válida".
  select count(*) into _cancelamentos
    from public.propostas
   where responsavel_id = p_profile_id
     and cancelada_em >= _desde;

  _conversao_pct := case when _leads > 0 then round((_vendas::numeric / _leads) * 100, 2) else 0 end;

  select coalesce(sum(case when tipo = 'credito' then valor else -valor end), 0) into _comissao
    from public.comissao_lancamentos
   where beneficiario_id = p_profile_id
     and criado_em >= _desde;

  -- dias sem venda: da última proposta emitida (histórico completo, não só a
  -- janela) até agora; sem venda nenhuma ainda, conta desde o cadastro.
  select max(emitida_em) into _ultima_venda_em
    from public.propostas
   where responsavel_id = p_profile_id
     and status = 'transmitida';
  if _ultima_venda_em is null then
    select created_at into _ultima_venda_em from public.profiles where id = p_profile_id;
  end if;
  _dias_sem_venda := floor(extract(epoch from (now() - _ultima_venda_em)) / 86400);

  -- meta é mensal (ano/mês) — pró-rata pra janela em dias corridos, já que
  -- não existe meta nativa por janela deslizante.
  _ano := extract(year from now());
  _mes := extract(month from now());
  select meta_vendas into _meta_vendas_mes
    from public.metas
   where escopo = 'usuario' and ref_id = p_profile_id and ano = _ano and mes = _mes;
  _meta_vendas_prorata := case
    when _meta_vendas_mes is not null then round(_meta_vendas_mes * _janela_dias / 30.0, 1)
    else null
  end;

  return jsonb_build_object(
    'bloco', p_bloco,
    'janela_dias', _janela_dias,
    'desde', _desde,
    'leads', _leads,
    'cotacoes', _cotacoes,
    'propostas', _propostas,
    'vendas', _vendas,
    'conversao_pct', _conversao_pct,
    'cancelamentos', _cancelamentos,
    'dias_sem_venda', _dias_sem_venda,
    'comissao', _comissao,
    'meta_vendas_mes', _meta_vendas_mes,
    'meta_vendas_prorata', _meta_vendas_prorata
  );
end;
$function$;

comment on function public.fn_calcular_performance_pessoa(uuid, text) is
  'V11 D3: números da janela deslizante (dias corridos) de uma pessoa — leads,
   cotações, propostas, vendas, conversão%, cancelamentos, dias sem venda,
   comissão e meta pró-rata. Não decide status — isso é do job (D4). Retorno
   no mesmo formato gravado em profiles.performance_motivo.';

revoke all on function public.fn_calcular_performance_pessoa(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_calcular_performance_pessoa(uuid, text) to service_role;
