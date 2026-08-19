-- ===========================================================================
-- Régua de performance: gente nova (sem lead nenhum na janela) não trava
--
-- Bug relatado: vendedores recém-cadastrados, sem nenhum lead recebido
-- ainda, estavam sendo marcados performance_status='travado' pelo job
-- diário — impedindo-os de RECEBER leads (pausa_leads_ativa exclui
-- 'travado' da distribuição automática), um ciclo vicioso: travado por não
-- vender, mas nunca recebe lead pra poder vender.
--
-- Causa raiz (dois caminhos, ambos por D3/D4 tratarem "sem amostra" igual a
-- "amostra ruim"):
--   (a) fn_calcular_performance_pessoa (D3) devolvia conversao_pct = 0
--       quando não havia nenhum lead na janela (_leads = 0) — 0% é sempre
--       menor que qualquer conv_travado_pct configurado (15/12/12%), então
--       travava por conversão desde o 1º dia de cadastro.
--   (b) dias_sem_venda, pra quem nunca vendeu, conta desde profiles.
--       created_at — então mesmo corrigindo (a), um cadastro de mais de
--       dias_travado (15/20/18) dias sem ter recebido nenhum lead travaria
--       de qualquer jeito por esse critério isolado.
--
-- Decisão do usuário (19/08/2026): sem nenhum lead na janela = sem dado pra
-- avaliar = fica 'ativo' (não 'atenção', não 'travado') até receber pelo
-- menos 1 lead — daí a régua passa a valer normalmente.
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

  -- Sem nenhum lead na janela: não há amostra pra calcular conversão —
  -- NULL ("não avaliável"), não 0 ("avaliado e péssimo"). É o job (D4) quem
  -- decide não travar por falta de dado (ver 20260819030000).
  _conversao_pct := case when _leads > 0 then round((_vendas::numeric / _leads) * 100, 2) else null end;

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
  'V11 D3 (+ fix gente nova, 20260819030000): números da janela deslizante
   (dias corridos) de uma pessoa — leads, cotações, propostas, vendas,
   conversão% (NULL sem nenhum lead na janela — sem amostra, não "0% ruim"),
   cancelamentos, dias sem venda, comissão e meta pró-rata. Não decide
   status — isso é do job (D4). Retorno no mesmo formato gravado em
   profiles.performance_motivo.';

create or replace function public.recalcular_regua_performance()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pessoa record;
  v_regua public.regua_performance_config;
  v_calc jsonb;
  v_leads int;
  v_conversao numeric;
  v_cancelamentos int;
  v_dias_sem_venda int;
  v_travado boolean;
  v_atencao boolean;
  v_status text;
  v_atualizados int := 0;
begin
  -- Gate: a função varre profiles de TODAS as empresas (job global). Só o
  -- cron (sem auth.uid()) ou a Matriz podem disparar manualmente — mesmo
  -- padrão de `criar_leads_renovacao` (G6.1).
  if auth.uid() is not null
     and not exists (
       select 1 from public.user_roles
        where user_id = auth.uid() and role = 'matriz'
     ) then
    raise exception 'permissão negada: só a Matriz pode disparar recalcular_regua_performance';
  end if;

  for v_pessoa in
    select p.id as profile_id,
      case
        when m.id is null then 'interno'
        when m.tipo = 'clt' then 'interno'
        when m.modalidade = 'full' then 'full'
        else 'rede'
      end as bloco
      from public.profiles p
      join public.empresas e on e.id = p.empresa_id
      left join public.modelos_franquia m on m.id = e.modelo_id
     where p.status = 'aprovada'
       and p.desligado_em is null
       and (
         exists (
           select 1 from public.user_roles ur
            where ur.user_id = p.id and ur.role = 'vendedor'
         )
         or (
           m.modalidade = 'individual'
           and exists (
             select 1 from public.user_roles ur
              where ur.user_id = p.id and ur.role = 'franqueado'
           )
         )
       )
  loop
    select * into v_regua
      from public.regua_performance_config
     where bloco = v_pessoa.bloco;
    if v_regua is null then
      continue;
    end if;

    v_calc := public.fn_calcular_performance_pessoa(v_pessoa.profile_id, v_pessoa.bloco);
    v_leads := (v_calc ->> 'leads')::int;
    v_conversao := (v_calc ->> 'conversao_pct')::numeric;
    v_cancelamentos := (v_calc ->> 'cancelamentos')::int;
    v_dias_sem_venda := (v_calc ->> 'dias_sem_venda')::int;

    if v_leads = 0 then
      -- Sem nenhum lead na janela: não há dado pra avaliar — fica 'ativo'
      -- até receber pelo menos 1 lead. Sem isto, gente nova travava por
      -- conversão=0% (sempre menor que qualquer limite configurado) ou por
      -- dias_sem_venda (contado desde o cadastro), ficando presa num ciclo
      -- vicioso: travado por não vender, mas nunca recebe lead pra vender.
      v_travado := false;
      v_atencao := false;
    else
      v_travado := v_conversao < v_regua.conv_travado_pct
        or v_cancelamentos >= v_regua.cancelamentos_limite
        or v_dias_sem_venda >= v_regua.dias_travado;

      v_atencao := not v_travado
        and (v_conversao < v_regua.conv_atencao_pct or v_dias_sem_venda >= v_regua.dias_atencao);
    end if;

    v_status := case when v_travado then 'travado' when v_atencao then 'atencao' else 'ativo' end;

    perform set_config('regua.internal_write', 'true', true);
    update public.profiles
       set performance_status = v_status,
           performance_motivo = v_calc,
           performance_calculado_em = now()
     where id = v_pessoa.profile_id;

    v_atualizados := v_atualizados + 1;
  end loop;

  return jsonb_build_object('atualizados', v_atualizados);
end;
$function$;

comment on function public.recalcular_regua_performance() is
  'V11 D4 (+ fix gente nova, 20260819030000): job diário (pg_cron) que
   recalcula o sinal de performance de todo CLT interno/vendedor de rede/
   franqueado Individual-como-vendedor, via D3 + limites de
   regua_performance_config. Sem nenhum lead na janela, fica ''ativo'' —
   não avalia conversão/dias-sem-venda sem amostra. Franqueado Full não é
   avaliado — só o time dele.';

grant execute on function public.recalcular_regua_performance() to authenticated, service_role;
