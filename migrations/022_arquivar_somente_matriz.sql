-- 022: Arquivar somente leads que estão com a Matriz
-- Regra: só pode arquivar leads que não estejam distribuídos
-- (sem responsável e sem franquia) OU que estejam em avaliação da matriz.
-- Arquivados também ficam fora da fila de SLA/expiração.

create or replace function public.arquivar_lead(p_lead uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp uuid;
  v_resp uuid;
  v_aval boolean;
begin
  select empresa_id, responsavel_id, coalesce(em_avaliacao_matriz, false)
    into v_emp, v_resp, v_aval
    from public.leads where id = p_lead;

  if v_resp is not null and not v_aval then
    raise exception 'Apenas leads que estão com a Matriz podem ser arquivados.';
  end if;
  if v_emp is not null and not v_aval then
    raise exception 'Apenas leads que estão com a Matriz podem ser arquivados.';
  end if;

  update public.leads
     set arquivado = true,
         arquivado_em = now(),
         atualizado_em = now()
   where id = p_lead;

  insert into public.lead_eventos (lead_id, tipo, titulo, descricao, meta)
  values (p_lead, 'arquivado', 'Arquivado', 'Lead arquivado',
          jsonb_build_object('empresa_id', v_emp, 'responsavel_id', v_resp));
end;
$$;

grant execute on function public.arquivar_lead(uuid) to authenticated;

-- SLA: não expira leads arquivados (defensivo — não devem estar distribuídos).
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
       and coalesce(arquivado, false) = false
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
      v_rec.id, 'sla_expirado', 'SLA expirado — devolvido à Matriz',
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
