-- ===========================================================================
-- V11 · D4 (Frente 4) — job diário que recalcula o sinal da régua
--
-- Itera todo perfil elegível (CLT interno, vendedor de rede, franqueado
-- Individual-como-vendedor — franqueado Full em si NÃO entra, só o time
-- dele, que tem role='vendedor'), chama D3 e decide o sinal comparando
-- contra os limites do bloco em `regua_performance_config`.
--
-- Critério (decisão #1 do PLANO_REGUA_V11.md — dias sem venda passam a
-- valer de verdade, em OU com conversão/cancelamentos, igual ao
-- `statusPerf()` do protótipo pro resto):
--   travado: conversão < convTravado OU cancelamentos >= limite OU dias sem
--            venda >= diasTravado
--   atenção: (não travado) E (conversão < convAtencao OU dias sem venda >= diasAtencao)
--   ativo:   nenhum dos dois
--
-- Escreve em profiles via `set_config('regua.internal_write','true',true)`
-- (mesma trava do D1) — não depende de `auth.role()='service_role'`, porque
-- o pg_cron roda a função direto no Postgres, sem contexto de JWT.
-- ===========================================================================

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
        when m.tipo = 'clt' then 'interno'
        when m.modalidade = 'full' then 'full'
        else 'rede'
      end as bloco
      from public.profiles p
      join public.empresas e on e.id = p.empresa_id
      join public.modelos_franquia m on m.id = e.modelo_id
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
    v_conversao := (v_calc ->> 'conversao_pct')::numeric;
    v_cancelamentos := (v_calc ->> 'cancelamentos')::int;
    v_dias_sem_venda := (v_calc ->> 'dias_sem_venda')::int;

    v_travado := v_conversao < v_regua.conv_travado_pct
      or v_cancelamentos >= v_regua.cancelamentos_limite
      or v_dias_sem_venda >= v_regua.dias_travado;

    v_atencao := not v_travado
      and (v_conversao < v_regua.conv_atencao_pct or v_dias_sem_venda >= v_regua.dias_atencao);

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
  'V11 D4: job diário (pg_cron) que recalcula o sinal de performance de todo
   CLT interno/vendedor de rede/franqueado Individual-como-vendedor, via D3 +
   limites de regua_performance_config. Franqueado Full não é avaliado — só
   o time dele.';

revoke all on function public.recalcular_regua_performance() from public, anon;
grant execute on function public.recalcular_regua_performance() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Agendamento diário via pg_cron, mesmo horário do cron de renovação (06:00)
-- — decisão #5 do plano. Best-effort: produção pode não conceder privilégio
-- ao pg_cron; não pode falhar a migration nesse caso.
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when insufficient_privilege then
    return;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
       from cron.job
      where jobname = 'recalcular_regua_performance';

    perform cron.schedule(
      'recalcular_regua_performance',
      '0 6 * * *',
      $cron$ select public.recalcular_regua_performance(); $cron$
    );
  end if;
exception when insufficient_privilege then
  null;
end$$;
