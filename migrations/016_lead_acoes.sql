-- ============================================================
-- 016: Ações de matriz sobre leads + histórico (linha do tempo)
-- ============================================================

alter table public.leads
  add column if not exists bloqueado boolean not null default false,
  add column if not exists bloqueado_em timestamptz,
  add column if not exists bloqueado_por uuid,
  add column if not exists motivo_bloqueio text;

create table if not exists public.lead_eventos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  descricao text,
  ator_id uuid,
  meta jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

grant select, insert on public.lead_eventos to authenticated;
grant all on public.lead_eventos to service_role;
alter table public.lead_eventos enable row level security;

drop policy if exists "leadev_read" on public.lead_eventos;
create policy "leadev_read" on public.lead_eventos
  for select to authenticated
  using (
    public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master')
    or exists (
      select 1 from public.leads l
      where l.id = lead_id
        and (l.responsavel_id = auth.uid()
             or l.empresa_id in (select empresa_id from public.profiles where id = auth.uid()))
    )
  );

drop policy if exists "leadev_insert" on public.lead_eventos;
create policy "leadev_insert" on public.lead_eventos
  for insert to authenticated with check (true);

create index if not exists lead_eventos_lead_idx on public.lead_eventos (lead_id, criado_em);

-- ---- RPCs ----

create or replace function public.redistribuir_lead(
  p_lead uuid, p_empresa uuid, p_responsavel uuid default null
) returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not (public.has_role(v_uid,'matriz') or public.has_role(v_uid,'master')) then
    raise exception 'forbidden';
  end if;
  update public.leads
     set empresa_id = p_empresa,
         responsavel_id = p_responsavel,
         distribuido_em = now(),
         em_avaliacao_matriz = false,
         status_pipeline = case when status_pipeline = 'perdido' then 'novo'::public.lead_status else status_pipeline end,
         atualizado_em = now()
   where id = p_lead;
  insert into public.lead_eventos(lead_id,tipo,titulo,descricao,ator_id,meta)
  values (p_lead,'redistribuido','Redistribuído','Lead redistribuído pela matriz', v_uid,
          jsonb_build_object('empresa_id',p_empresa,'responsavel_id',p_responsavel));
end$$;
grant execute on function public.redistribuir_lead(uuid,uuid,uuid) to authenticated;

create or replace function public.puxar_lead_de_volta(p_lead uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not (public.has_role(v_uid,'matriz') or public.has_role(v_uid,'master')) then
    raise exception 'forbidden';
  end if;
  update public.leads
     set empresa_id = null, responsavel_id = null, distribuido_em = null,
         atualizado_em = now()
   where id = p_lead;
  insert into public.lead_eventos(lead_id,tipo,titulo,descricao,ator_id)
  values (p_lead,'puxado_de_volta','Puxado de volta','Matriz reassumiu o lead', v_uid);
end$$;
grant execute on function public.puxar_lead_de_volta(uuid) to authenticated;

create or replace function public.bloquear_lead(p_lead uuid, p_motivo text)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not (public.has_role(v_uid,'matriz') or public.has_role(v_uid,'master')) then
    raise exception 'forbidden';
  end if;
  update public.leads
     set bloqueado = true, bloqueado_em = now(), bloqueado_por = v_uid,
         motivo_bloqueio = p_motivo, atualizado_em = now()
   where id = p_lead;
  insert into public.lead_eventos(lead_id,tipo,titulo,descricao,ator_id)
  values (p_lead,'bloqueado','Lead bloqueado', p_motivo, v_uid);
end$$;
grant execute on function public.bloquear_lead(uuid,text) to authenticated;

create or replace function public.desbloquear_lead(p_lead uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not (public.has_role(v_uid,'matriz') or public.has_role(v_uid,'master')) then
    raise exception 'forbidden';
  end if;
  update public.leads
     set bloqueado = false, bloqueado_em = null, bloqueado_por = null,
         motivo_bloqueio = null, atualizado_em = now()
   where id = p_lead;
  insert into public.lead_eventos(lead_id,tipo,titulo,descricao,ator_id)
  values (p_lead,'desbloqueado','Lead desbloqueado', null, v_uid);
end$$;
grant execute on function public.desbloquear_lead(uuid) to authenticated;
