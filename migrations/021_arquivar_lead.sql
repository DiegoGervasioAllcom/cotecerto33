-- 021: Arquivar leads
alter table public.leads add column if not exists arquivado boolean not null default false;
alter table public.leads add column if not exists arquivado_em timestamptz;

create index if not exists idx_leads_arquivado on public.leads (arquivado);

create or replace function public.arquivar_lead(p_lead uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp uuid;
  v_resp uuid;
begin
  select empresa_id, responsavel_id into v_emp, v_resp from public.leads where id = p_lead;
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

create or replace function public.desarquivar_lead(p_lead uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leads
     set arquivado = false,
         arquivado_em = null,
         atualizado_em = now()
   where id = p_lead;

  insert into public.lead_eventos (lead_id, tipo, titulo, descricao)
  values (p_lead, 'desarquivado', 'Desarquivado', 'Lead desarquivado');
end;
$$;

grant execute on function public.arquivar_lead(uuid) to authenticated;
grant execute on function public.desarquivar_lead(uuid) to authenticated;
