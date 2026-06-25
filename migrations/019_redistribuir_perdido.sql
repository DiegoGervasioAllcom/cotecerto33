-- ============================================================
-- 019: Permite redistribuir leads encerrados como "perdido"
-- Reativa o lead (status → novo), limpa motivo de perda e
-- gera um evento dedicado no histórico.
-- ============================================================

create or replace function public.redistribuir_lead(
  p_lead uuid, p_empresa uuid, p_responsavel uuid default null
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid := auth.uid();
  v_was_perdido boolean;
  v_motivo text;
  v_sub text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not (public.has_role(v_uid,'matriz') or public.has_role(v_uid,'master')) then
    raise exception 'forbidden';
  end if;

  select status_pipeline = 'perdido', motivo_perda, submotivo_perda
    into v_was_perdido, v_motivo, v_sub
  from public.leads where id = p_lead;

  update public.leads
     set empresa_id = p_empresa,
         responsavel_id = p_responsavel,
         distribuido_em = now(),
         em_avaliacao_matriz = false,
         status_pipeline = case when status_pipeline = 'perdido'
                                then 'novo'::public.lead_status
                                else status_pipeline end,
         motivo_perda = case when status_pipeline = 'perdido' then null else motivo_perda end,
         submotivo_perda = case when status_pipeline = 'perdido' then null else submotivo_perda end,
         atualizado_em = now()
   where id = p_lead;

  if v_was_perdido then
    insert into public.lead_eventos(lead_id,tipo,titulo,descricao,ator_id,meta)
    values (p_lead,'reativado_de_perda','Reativado de perda',
            coalesce('Motivo anterior: '||v_motivo, 'Lead reaberto pela matriz'),
            v_uid,
            jsonb_build_object('empresa_id',p_empresa,'responsavel_id',p_responsavel,
                               'motivo_anterior',v_motivo,'submotivo_anterior',v_sub));
  end if;

  insert into public.lead_eventos(lead_id,tipo,titulo,descricao,ator_id,meta)
  values (p_lead,'redistribuido','Redistribuído','Lead redistribuído pela matriz', v_uid,
          jsonb_build_object('empresa_id',p_empresa,'responsavel_id',p_responsavel,
                             'reativado', v_was_perdido));
end$$;

grant execute on function public.redistribuir_lead(uuid,uuid,uuid) to authenticated;
