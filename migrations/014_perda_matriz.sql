-- ============================================================
-- 014: Perda submetida à matriz para avaliação
-- ============================================================

alter table public.leads
  add column if not exists em_avaliacao_matriz boolean not null default false,
  add column if not exists motivo_perda text,
  add column if not exists submotivo_perda text,
  add column if not exists destino_perda_sugerido text,
  add column if not exists destino_perda_final text,
  add column if not exists observacao_perda text,
  add column if not exists perdida_em timestamptz;

create index if not exists leads_avaliacao_matriz_idx on public.leads (em_avaliacao_matriz) where em_avaliacao_matriz;

-- Recria RPC classificar_perda: agora propaga para o lead e marca avaliação matriz
create or replace function public.classificar_perda_cotacao(
  p_cotacao_id uuid,
  p_motivo text,
  p_submotivo text,
  p_observacao text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dest text;
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_lead uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select responsavel_id, lead_id into v_owner, v_lead from public.cotacoes where id = p_cotacao_id;
  if v_owner is null then raise exception 'cotacao not found'; end if;
  if v_owner <> v_uid and not (public.has_role(v_uid,'matriz') or public.has_role(v_uid,'master')) then
    raise exception 'forbidden';
  end if;

  select sm.destino_sugerido into v_dest
  from public.perda_submotivos sm
  join public.perda_motivos m on m.id = sm.motivo_id
  where m.nome = p_motivo and sm.nome = p_submotivo;
  if v_dest is null then raise exception 'invalid motivo/submotivo'; end if;

  update public.cotacoes
     set status = 'perdida',
         motivo_perda = p_motivo,
         submotivo_perda = p_submotivo,
         destino_perda_sugerido = v_dest,
         destino_perda = 'Pendente',
         observacao_perda = p_observacao,
         perdida_em = now(),
         atualizado_em = now()
   where id = p_cotacao_id;

  if v_lead is not null then
    update public.leads
       set status_pipeline = 'perdido',
           em_avaliacao_matriz = true,
           motivo_perda = p_motivo,
           submotivo_perda = p_submotivo,
           destino_perda_sugerido = v_dest,
           destino_perda_final = null,
           observacao_perda = p_observacao,
           perdida_em = now(),
           atualizado_em = now()
     where id = v_lead;
  end if;
end$$;

grant execute on function public.classificar_perda_cotacao(uuid,text,text,text) to authenticated;

-- RPC: matriz avalia a perda
-- p_decisao: 'Remalho' | 'Descarte' | 'Reativar'
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
           observacao_perda = coalesce(p_observacao, observacao_perda),
           atualizado_em = now()
     where id = p_lead_id;
    update public.cotacoes
       set status = 'rascunho', atualizado_em = now()
     where lead_id = p_lead_id and status = 'perdida';
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
  end if;
end$$;

grant execute on function public.avaliar_perda_lead(uuid,text,text) to authenticated;
