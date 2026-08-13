-- ============================================================
-- Redefine assumir_lead para pré-preencher cotacao_segurado.cpf_cnpj
-- e cotacao_veiculo.placa a partir de leads.dados, quando presentes
-- (genérico: qualquer origem de lead que povoe dados->>'cpf' /
-- dados->>'placa', não só captacao_movida). Preserva 100% da lógica
-- de idempotência/reaproveitamento de cotação já existente: os novos
-- inserts só ocorrem no mesmo bloco em que a cotação é criada pela
-- primeira vez (v_cot is null), então uma segunda chamada de
-- assumir_lead para o mesmo lead nunca duplica nem sobrescreve dados
-- que o vendedor já tenha editado manualmente.
-- ============================================================

create or replace function public.assumir_lead(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lead record;
  v_cot uuid;
  v_cpf text;
  v_placa text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select id, empresa_id, responsavel_id, nome, contato, dados, distribuido_em
    into v_lead
    from public.leads
   where id = p_lead_id
   for update;
  if v_lead.id is null then raise exception 'lead not found'; end if;

  if v_lead.responsavel_id <> v_uid
     and not (public.has_role(v_uid,'matriz') or public.has_role(v_uid,'master')) then
    raise exception 'forbidden';
  end if;

  select id into v_cot
    from public.cotacoes
   where lead_id = p_lead_id
     and status in ('rascunho','calculada')
   order by atualizado_em desc
   limit 1;

  if v_cot is null then
    insert into public.cotacoes (empresa_id, lead_id, responsavel_id, status, step_atual, ramo)
    values (v_lead.empresa_id, p_lead_id, v_uid, 'rascunho', 0, 'Automóvel')
    returning id into v_cot;

    v_cpf := nullif(trim(v_lead.dados->>'cpf'), '');
    v_placa := nullif(trim(v_lead.dados->>'placa'), '');

    insert into public.cotacao_segurado (cotacao_id, nome, celular, cpf_cnpj)
    values (v_cot, v_lead.nome, v_lead.contato, v_cpf)
    on conflict (cotacao_id) do nothing;

    if v_placa is not null then
      insert into public.cotacao_veiculo (cotacao_id, placa)
      values (v_cot, v_placa)
      on conflict (cotacao_id) do nothing;
    end if;
  end if;

  update public.leads
     set status_pipeline = 'qualificado',
         ultimo_atendimento_em = now(),
         atualizado_em = now()
   where id = p_lead_id;

  insert into public.lead_eventos(lead_id,tipo,titulo,descricao,ator_id,meta)
  values (
    p_lead_id,
    'lead_assumido',
    'Lead assumido — atendimento iniciado',
    case
      when v_lead.distribuido_em is not null
        then 'Assumido em '
             || to_char(extract(epoch from (now() - v_lead.distribuido_em))::int, 'FM999990')
             || 's após a distribuição.'
      else 'Atendimento iniciado pelo vendedor.'
    end,
    v_uid,
    jsonb_build_object(
      'empresa_id', v_lead.empresa_id,
      'responsavel_id', v_uid,
      'cotacao_id', v_cot,
      'distribuido_em', v_lead.distribuido_em
    )
  );

  return v_cot;
end$$;

grant execute on function public.assumir_lead(uuid) to authenticated;
