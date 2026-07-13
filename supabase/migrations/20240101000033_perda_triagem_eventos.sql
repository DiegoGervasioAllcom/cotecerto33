-- ============================================================
-- 033: Triagem da matriz registra evento + permite Reativar
-- ============================================================

create or replace function public.avaliar_perda_lead(
  p_lead_id uuid,
  p_decisao text,
  p_observacao text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_titulo text;
  v_desc text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not (public.has_role(v_uid,'matriz') or public.has_role(v_uid,'master')) then
    raise exception 'forbidden';
  end if;
  if p_decisao not in ('Remalho','Descarte','Reativar') then
    raise exception 'invalid decision';
  end if;

  if p_decisao = 'Reativar' then
    update public.leads
       set status_pipeline = 'novo',
           em_avaliacao_matriz = false,
           destino_perda_final = null,
           motivo_perda = null,
           submotivo_perda = null,
           destino_perda_sugerido = null,
           observacao_perda = coalesce(p_observacao, observacao_perda),
           empresa_id = null,
           responsavel_id = null,
           distribuido_em = null,
           atualizado_em = now()
     where id = p_lead_id;
    update public.cotacoes
       set status = 'rascunho', atualizado_em = now()
     where lead_id = p_lead_id and status = 'perdida';
    v_titulo := 'Triagem: Reativar';
    v_desc := coalesce(p_observacao, 'Matriz reativou o lead — devolvido à fila de distribuição.');
  else
    update public.leads
       set em_avaliacao_matriz = false,
           destino_perda_final = p_decisao,
           observacao_perda = coalesce(p_observacao, observacao_perda),
           atualizado_em = now()
     where id = p_lead_id;
    update public.cotacoes
       set destino_perda = p_decisao, atualizado_em = now()
     where lead_id = p_lead_id and status = 'perdida';
    v_titulo := 'Triagem: ' || p_decisao;
    v_desc := coalesce(p_observacao,
      case p_decisao
        when 'Remalho'  then 'Matriz definiu encaminhamento para remalho.'
        when 'Descarte' then 'Matriz definiu descarte definitivo.'
      end);
  end if;

  insert into public.lead_eventos(lead_id, tipo, titulo, descricao, ator_id, meta)
  values (p_lead_id, 'triagem_matriz', v_titulo, v_desc, v_uid,
          jsonb_build_object('decisao', p_decisao, 'observacao', p_observacao));
end$$;

grant execute on function public.avaliar_perda_lead(uuid,text,text) to authenticated;
