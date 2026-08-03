-- ===========================================================================
-- V11 · D2 (Frente 4) — salvar a régua de performance, com gate de diretor
--
-- `fn_registrar_alteracao` (V11.0.5/V11.0.6) já faz TUDO que essa RPC precisa
-- de governança: confere diretor+senha e grava no histórico append-only. Não
-- reinventa nada — só monta o DE/PARA e aplica o UPDATE depois que o gate
-- passar (se `fn_registrar_alteracao` levantar exceção, a transação inteira
-- desfaz e a régua não muda).
--
-- Diferente do protótipo (que salva a régua `full` sem gate nenhum): aqui os
-- TRÊS blocos passam pelo mesmo diretor+senha — decisão registrada em
-- docs/PLANO_REGUA_V11.md (a régua é global por bloco, não por franquia;
-- deixar qualquer Full editar sem gate mudaria o critério de todas as outras
-- Fulls ao mesmo tempo).
-- ===========================================================================

create or replace function public.fn_salvar_regua_performance(
  p_bloco text,
  p_senha text,
  p_janela_dias int,
  p_conv_atencao_pct numeric,
  p_conv_travado_pct numeric,
  p_dias_atencao int,
  p_dias_travado int,
  p_cancelamentos_limite int,
  p_pausa_leads_ativa boolean,
  p_notifica_supervisor boolean
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _uid uuid := auth.uid();
  _antes public.regua_performance_config;
  _de_para jsonb := '[]'::jsonb;
begin
  if p_bloco not in ('interno', 'rede', 'full') then
    raise exception 'Bloco inválido: %', p_bloco;
  end if;
  if p_conv_travado_pct > p_conv_atencao_pct then
    raise exception 'A conversão de Travado não pode ser maior que a de Atenção.';
  end if;
  if p_dias_atencao > p_dias_travado then
    raise exception 'Os dias de Travado não podem ser menores que os de Atenção.';
  end if;

  select * into _antes from public.regua_performance_config where bloco = p_bloco;
  if _antes is null then
    raise exception 'Régua do bloco % não encontrada.', p_bloco;
  end if;

  -- `de_para` de historico_alteracoes exige array [{campo,de,para},...]
  -- (V11.0.6) — só entram os campos que de fato mudaram.
  if _antes.janela_dias is distinct from p_janela_dias then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Régua · janela (dias)', 'de', _antes.janela_dias::text, 'para', p_janela_dias::text));
  end if;
  if _antes.conv_atencao_pct is distinct from p_conv_atencao_pct then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Régua · conversão mínima (Atenção)', 'de', _antes.conv_atencao_pct::text, 'para', p_conv_atencao_pct::text));
  end if;
  if _antes.conv_travado_pct is distinct from p_conv_travado_pct then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Régua · conversão mínima (Travado)', 'de', _antes.conv_travado_pct::text, 'para', p_conv_travado_pct::text));
  end if;
  if _antes.dias_atencao is distinct from p_dias_atencao then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Régua · dias sem venda (Atenção)', 'de', _antes.dias_atencao::text, 'para', p_dias_atencao::text));
  end if;
  if _antes.dias_travado is distinct from p_dias_travado then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Régua · dias sem venda (Travado)', 'de', _antes.dias_travado::text, 'para', p_dias_travado::text));
  end if;
  if _antes.cancelamentos_limite is distinct from p_cancelamentos_limite then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Régua · cancelamentos na janela', 'de', _antes.cancelamentos_limite::text, 'para', p_cancelamentos_limite::text));
  end if;
  if _antes.pausa_leads_ativa is distinct from p_pausa_leads_ativa then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Régua · pausar distribuição de leads', 'de', _antes.pausa_leads_ativa::text, 'para', p_pausa_leads_ativa::text));
  end if;
  if _antes.notifica_supervisor is distinct from p_notifica_supervisor then
    _de_para := _de_para || jsonb_build_array(jsonb_build_object(
      'campo', 'Régua · notificar supervisor', 'de', _antes.notifica_supervisor::text, 'para', p_notifica_supervisor::text));
  end if;

  -- Levanta exceção se não for diretor com senha correta — nada abaixo roda.
  perform public.fn_registrar_alteracao(
    'Performance',
    format('Régua de performance · %s', p_bloco),
    p_senha,
    case when jsonb_array_length(_de_para) > 0 then _de_para else null end,
    null
  );

  update public.regua_performance_config
     set janela_dias = p_janela_dias,
         conv_atencao_pct = p_conv_atencao_pct,
         conv_travado_pct = p_conv_travado_pct,
         dias_atencao = p_dias_atencao,
         dias_travado = p_dias_travado,
         cancelamentos_limite = p_cancelamentos_limite,
         pausa_leads_ativa = p_pausa_leads_ativa,
         notifica_supervisor = p_notifica_supervisor,
         atualizado_em = now(),
         atualizado_por = _uid
   where bloco = p_bloco;
end;
$function$;

comment on function public.fn_salvar_regua_performance(text, text, int, numeric, numeric, int, int, int, boolean, boolean) is
  'V11 D2: salva a régua de um bloco (interno/rede/full), com gate de diretor
   via fn_registrar_alteracao. Os três blocos passam pelo mesmo gate — diverge
   do protótipo, que deixava o bloco full sem senha.';

revoke all on function public.fn_salvar_regua_performance(text, text, int, numeric, numeric, int, int, int, boolean, boolean) from public, anon;
grant execute on function public.fn_salvar_regua_performance(text, text, int, numeric, numeric, int, int, int, boolean, boolean) to authenticated;
