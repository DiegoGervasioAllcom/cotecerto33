-- ============================================================
-- 017: SLA de atendimento — devolve leads não atendidos à Matriz
-- ============================================================
-- Regra: lead distribuído a um vendedor que não tiver "Assumido e iniciado"
-- dentro de 3 minutos volta para a fila da Matriz (sem responsável/franquia)
-- com o registro do motivo no histórico (lead_eventos).

create or replace function public.expirar_leads_nao_atendidos(p_janela_seg int default 180)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_total int := 0;
  v_prev_resp uuid;
  v_prev_emp uuid;
  v_prev_dist timestamptz;
begin
  for v_rec in
    select id, responsavel_id, empresa_id, distribuido_em
      from public.leads
     where status_pipeline = 'novo'
       and responsavel_id is not null
       and ultimo_atendimento_em is null
       and bloqueado is not true
       and distribuido_em is not null
       and distribuido_em < now() - make_interval(secs => p_janela_seg)
     for update skip locked
  loop
    v_prev_resp := v_rec.responsavel_id;
    v_prev_emp  := v_rec.empresa_id;
    v_prev_dist := v_rec.distribuido_em;

    update public.leads
       set responsavel_id = null,
           empresa_id     = null,
           distribuido_em = null,
           atualizado_em  = now()
     where id = v_rec.id;

    insert into public.lead_eventos(lead_id, tipo, titulo, descricao, ator_id, meta)
    values (
      v_rec.id,
      'sla_expirado',
      'SLA expirado — devolvido à Matriz',
      'Lead não foi assumido em ' || p_janela_seg || 's após a distribuição e retornou para a fila da Matriz para nova redistribuição.',
      null,
      jsonb_build_object(
        'responsavel_anterior', v_prev_resp,
        'empresa_anterior',     v_prev_emp,
        'distribuido_em',       v_prev_dist,
        'janela_seg',           p_janela_seg
      )
    );

    v_total := v_total + 1;
  end loop;

  return v_total;
end$$;

grant execute on function public.expirar_leads_nao_atendidos(int) to authenticated, anon, service_role;

-- Agenda pg_cron a cada 30 segundos, se disponível.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
       from cron.job
      where jobname = 'expirar_leads_nao_atendidos';

    perform cron.schedule(
      'expirar_leads_nao_atendidos',
      '30 seconds',
      $cron$ select public.expirar_leads_nao_atendidos(180); $cron$
    );
  end if;
exception when others then
  -- Se a sintaxe '30 seconds' não for suportada, cai para 1 minuto.
  begin
    perform cron.schedule(
      'expirar_leads_nao_atendidos',
      '* * * * *',
      $cron$ select public.expirar_leads_nao_atendidos(180); $cron$
    );
  exception when others then
    null;
  end;
end$$;
