-- ============================================================
-- 018: SLA — também expira leads bloqueados (devolvem à Matriz)
-- ============================================================
create or replace function public.expirar_leads_nao_atendidos(p_janela_seg int default 180)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_total int := 0;
begin
  for v_rec in
    select id, responsavel_id, empresa_id, distribuido_em
      from public.leads
     where status_pipeline = 'novo'
       and responsavel_id is not null
       and ultimo_atendimento_em is null
       and distribuido_em is not null
       and distribuido_em < now() - make_interval(secs => p_janela_seg)
     for update skip locked
  loop
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
      'Lead não foi assumido em ' || p_janela_seg || 's após a distribuição e retornou para a fila da Matriz.',
      null,
      jsonb_build_object(
        'responsavel_anterior', v_rec.responsavel_id,
        'empresa_anterior',     v_rec.empresa_id,
        'distribuido_em',       v_rec.distribuido_em,
        'janela_seg',           p_janela_seg
      )
    );
    v_total := v_total + 1;
  end loop;
  return v_total;
end$$;

grant execute on function public.expirar_leads_nao_atendidos(int) to authenticated, anon, service_role;
