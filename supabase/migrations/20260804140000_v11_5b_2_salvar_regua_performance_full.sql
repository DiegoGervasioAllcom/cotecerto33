-- ===========================================================================
-- V11.5b.2 (Frente 5b — Franquia Full) — a Full salva a própria régua de
-- performance, sem senha de diretor
--
-- `fn_salvar_regua_performance` (D2) exige diretor+senha pros TRÊS blocos —
-- decisão certa pra 'interno'/'rede' (política global da Matriz), mas errada
-- pro bloco 'full': o r41 confirma que `perfSaveGate('full')` salva direto,
-- sem `dirGate`. Esta é uma RPC IRMÃ, só pro bloco 'full' — não altera D2.
--
-- O bloco 'full' continua UMA LINHA COMPARTILHADA em regua_performance_config
-- (D1) — não uma linha por empresa. O r41 confirma isso mesmo (`PERF_RULES.full`
-- é um objeto único, não indexado por franquia); qualquer Full que salvar
-- muda o critério de todas as Fulls ao mesmo tempo, igual já valia pro D2.
--
-- Sem `p_notifica_supervisor`: o r41 confirma que esse toggle não existe pro
-- scope 'full' (`perfRulesCard`: "(scope==='full'?'':tg('notificaSup',...))")
-- — por isso a coluna `notifica_supervisor` nem entra no UPDATE abaixo.
--
-- Gate por identidade (mesmo padrão de V11.5b.1/fn_registrar_alteracao_franquia
-- e de V11.5.3/fn_salvar_sla_empresa): franqueado dono da própria empresa, e
-- essa empresa resolve pro bloco 'full' (fn_bloco_performance, D5).
--
-- Validações de negócio copiadas de D2 (travado não pode ser "melhor" que
-- atenção, dias de travado não podem ser menores que os de atenção) — mesmas
-- regras, não inventa nada novo.
-- ===========================================================================

create or replace function public.fn_salvar_regua_performance_full(
  p_empresa_id uuid,
  p_janela_dias int,
  p_conv_atencao_pct numeric,
  p_conv_travado_pct numeric,
  p_dias_atencao int,
  p_dias_travado int,
  p_cancelamentos_limite int,
  p_pausa_leads_ativa boolean
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
  if not (
    public.has_role(_uid, 'franqueado')
    and exists (
      select 1 from public.profiles p
       where p.id = _uid
         and p.empresa_id = p_empresa_id
    )
    and public.fn_bloco_performance(p_empresa_id) = 'full'
  ) then
    raise exception 'Só a própria Franquia Full pode salvar a própria régua de performance'
      using hint = 'Gate por identidade (franqueado dono da empresa + modalidade Full), não por senha de diretor.';
  end if;

  if p_conv_travado_pct > p_conv_atencao_pct then
    raise exception 'A conversão de Travado não pode ser maior que a de Atenção.';
  end if;
  if p_dias_atencao > p_dias_travado then
    raise exception 'Os dias de Travado não podem ser menores que os de Atenção.';
  end if;

  select * into _antes from public.regua_performance_config where bloco = 'full';
  if _antes is null then
    raise exception 'Régua do bloco full não encontrada.';
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

  -- Levanta exceção se não passar o gate de identidade — nada abaixo roda.
  perform public.fn_registrar_alteracao_franquia(
    p_empresa_id,
    'Performance',
    'Régua própria do time alterada',
    case when jsonb_array_length(_de_para) > 0 then _de_para else null end
  );

  update public.regua_performance_config
     set janela_dias = p_janela_dias,
         conv_atencao_pct = p_conv_atencao_pct,
         conv_travado_pct = p_conv_travado_pct,
         dias_atencao = p_dias_atencao,
         dias_travado = p_dias_travado,
         cancelamentos_limite = p_cancelamentos_limite,
         pausa_leads_ativa = p_pausa_leads_ativa,
         atualizado_em = now(),
         atualizado_por = _uid
   where bloco = 'full';
end;
$function$;

comment on function public.fn_salvar_regua_performance_full(uuid, int, numeric, numeric, int, int, int, boolean) is
  'V11.5b.2: a Franquia Full salva a própria régua de performance (bloco full,
   linha COMPARTILHADA de regua_performance_config — D1), sem senha de diretor.
   Gate por identidade (franqueado dono da empresa + modalidade Full via
   fn_bloco_performance). Sem p_notifica_supervisor — esse toggle não existe
   pro scope full (r41). Grava histórico via fn_registrar_alteracao_franquia
   (V11.5b.1). Irmã de fn_salvar_regua_performance (D2), que continua com o
   gate de diretor pros blocos interno/rede.';

revoke all on function public.fn_salvar_regua_performance_full(uuid, int, numeric, numeric, int, int, int, boolean) from public, anon;
grant execute on function public.fn_salvar_regua_performance_full(uuid, int, numeric, numeric, int, int, int, boolean) to authenticated;
