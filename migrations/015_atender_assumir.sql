-- ============================================================
-- 015: Atender agora — distribuição + assumir lead
-- ============================================================

alter table public.leads
  add column if not exists distribuido_em timestamptz;

-- Backfill: leads novos sem distribuição assumida = criado_em
update public.leads
   set distribuido_em = criado_em
 where distribuido_em is null and status_pipeline = 'novo';

create index if not exists leads_distrib_idx
  on public.leads(responsavel_id, distribuido_em)
  where status_pipeline = 'novo';

-- RPC: assumir lead e abrir cotação
-- Move o lead para 'qualificado', cria uma cotação (rascunho) vinculada
-- e pré-preenche cotacao_segurado a partir do lead.
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
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select id, empresa_id, responsavel_id, nome, contato, dados
    into v_lead
    from public.leads
   where id = p_lead_id
   for update;
  if v_lead.id is null then raise exception 'lead not found'; end if;

  if v_lead.responsavel_id <> v_uid
     and not (public.has_role(v_uid,'matriz') or public.has_role(v_uid,'master')) then
    raise exception 'forbidden';
  end if;

  -- Reaproveita cotação rascunho/calculada existente do lead, se houver
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

    insert into public.cotacao_segurado (cotacao_id, nome, celular)
    values (v_cot, v_lead.nome, v_lead.contato)
    on conflict (cotacao_id) do nothing;
  end if;

  update public.leads
     set status_pipeline = 'qualificado',
         ultimo_atendimento_em = now(),
         atualizado_em = now()
   where id = p_lead_id;

  return v_cot;
end$$;

grant execute on function public.assumir_lead(uuid) to authenticated;
