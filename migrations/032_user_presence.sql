-- ============================================================
-- 032: Presença em tempo real + histórico de login/logout
-- ============================================================

-- Estado atual (1 linha por usuário)
create table if not exists public.user_presence (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  status       text not null default 'offline' check (status in ('online','ausente','offline')),
  last_seen_at timestamptz not null default now(),
  entrou_em    timestamptz,
  saiu_em      timestamptz,
  user_agent   text,
  atualizado_em timestamptz not null default now()
);

grant select on public.user_presence to authenticated;
grant all on public.user_presence to service_role;

alter table public.user_presence enable row level security;

drop policy if exists "presence read all auth" on public.user_presence;
create policy "presence read all auth" on public.user_presence
  for select to authenticated using (true);

drop policy if exists "presence write own" on public.user_presence;
create policy "presence write own" on public.user_presence
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Histórico de eventos (entrou / saiu / ausente / heartbeat opcional)
create table if not exists public.presence_eventos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tipo       text not null check (tipo in ('entrou','saiu','ausente','retornou')),
  user_agent text,
  meta       jsonb,
  criado_em  timestamptz not null default now()
);

create index if not exists presence_eventos_user_idx on public.presence_eventos(user_id, criado_em desc);

grant select on public.presence_eventos to authenticated;
grant all on public.presence_eventos to service_role;

alter table public.presence_eventos enable row level security;

drop policy if exists "presence ev read all" on public.presence_eventos;
create policy "presence ev read all" on public.presence_eventos
  for select to authenticated using (true);

drop policy if exists "presence ev insert own" on public.presence_eventos;
create policy "presence ev insert own" on public.presence_eventos
  for insert to authenticated with check (user_id = auth.uid());

-- ============================================================
-- RPC: registrar presença (chamada pelo cliente)
-- ============================================================
create or replace function public.presence_set(p_status text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_prev text;
begin
  if v_uid is null then return; end if;
  if p_status not in ('online','ausente','offline') then
    raise exception 'status inválido';
  end if;

  select status into v_prev from public.user_presence where user_id = v_uid;

  insert into public.user_presence as up (user_id, status, last_seen_at, entrou_em, saiu_em, user_agent, atualizado_em)
  values (
    v_uid,
    p_status,
    now(),
    case when p_status = 'online' then now() else null end,
    case when p_status = 'offline' then now() else null end,
    p_user_agent,
    now()
  )
  on conflict (user_id) do update set
    status        = excluded.status,
    last_seen_at  = now(),
    entrou_em     = case when excluded.status = 'online'  and coalesce(up.status,'offline') <> 'online'  then now() else up.entrou_em end,
    saiu_em       = case when excluded.status = 'offline' then now() else up.saiu_em end,
    user_agent    = coalesce(excluded.user_agent, up.user_agent),
    atualizado_em = now();

  -- Log somente em transições relevantes
  if coalesce(v_prev,'offline') <> p_status then
    insert into public.presence_eventos(user_id, tipo, user_agent)
    values (
      v_uid,
      case p_status
        when 'online'  then case when coalesce(v_prev,'offline') = 'ausente' then 'retornou' else 'entrou' end
        when 'ausente' then 'ausente'
        when 'offline' then 'saiu'
      end,
      p_user_agent
    );
  end if;
end$$;

grant execute on function public.presence_set(text, text) to authenticated;

-- ============================================================
-- View útil de presença ativa (considera "online" se last_seen < 90s)
-- ============================================================
create or replace view public.v_user_presence as
select
  up.user_id,
  case
    when up.status = 'offline' then 'offline'
    when up.last_seen_at < now() - interval '90 seconds' then 'offline'
    when up.status = 'ausente' or up.last_seen_at < now() - interval '60 seconds' then 'ausente'
    else 'online'
  end as status_efetivo,
  up.status as status_reportado,
  up.last_seen_at,
  up.entrou_em,
  up.saiu_em
from public.user_presence up;

grant select on public.v_user_presence to authenticated;

-- ============================================================
-- Distribuição: respeita criterios.disp = true → só vendedor online
-- (atualiza distribuir_lead_auto + distribuir_fila_pendente)
-- ============================================================
create or replace function public.distribuir_lead_auto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg record;
  v_uf text;
  v_cidade text;
  v_empresa uuid;
  v_resp uuid;
  v_modo text;
  v_only_online boolean;
begin
  if new.empresa_id is not null or new.responsavel_id is not null then
    return new;
  end if;

  select * into v_cfg from public.distribuicao_config where id = 'default';
  if not found or not coalesce(v_cfg.automatico_on,false) then
    return new;
  end if;

  v_modo := coalesce(v_cfg.modo,'regiao');
  v_only_online := coalesce((v_cfg.criterios->>'disp')::boolean, false);
  v_uf     := upper(coalesce(new.dados->>'uf',''));
  v_cidade := lower(coalesce(new.dados->>'cidade',''));

  if coalesce((v_cfg.criterios->>'regiao')::boolean, true) and (v_uf <> '' or v_cidade <> '') then
    select e.id into v_empresa from public.empresas e
     where e.status = 'aprovada' and e.tipo::text <> 'matriz'
       and ((v_uf <> '' and upper(coalesce(e.uf,'')) = v_uf)
            or (v_cidade <> '' and lower(coalesce(e.cidade,'')) = v_cidade))
     order by random() limit 1;
  end if;

  if v_empresa is null and v_modo = 'fila' then
    select e.id into v_empresa from public.empresas e
      left join public.leads l on l.empresa_id = e.id
        and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
        and coalesce(l.arquivado,false) = false
     where e.status = 'aprovada' and e.tipo::text <> 'matriz'
     group by e.id order by count(l.id) asc, random() limit 1;
  end if;

  if v_empresa is null and v_modo = 'performance' then
    select e.id into v_empresa from public.empresas e
      left join public.profiles p on p.empresa_id = e.id and p.status = 'aprovada'
     where e.status = 'aprovada' and e.tipo::text <> 'matriz'
     group by e.id order by count(p.id) desc, random() limit 1;
  end if;

  if v_empresa is null then
    select id into v_empresa from public.empresas
     where status = 'aprovada' and tipo::text <> 'matriz'
     order by random() limit 1;
  end if;
  if v_empresa is null then return new; end if;

  select p.id into v_resp
    from public.profiles p
    left join public.leads l on l.responsavel_id = p.id
      and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
      and coalesce(l.arquivado,false) = false
    left join public.v_user_presence vp on vp.user_id = p.id
   where p.empresa_id = v_empresa
     and p.status = 'aprovada'
     and (not v_only_online or coalesce(vp.status_efetivo,'offline') = 'online')
   group by p.id, vp.status_efetivo
   order by count(l.id) asc, random()
   limit 1;

  new.empresa_id := v_empresa;
  new.responsavel_id := v_resp;
  new.distribuido_em := case when v_resp is not null then now() else null end;
  return new;
end$$;

create or replace function public.distribuir_fila_pendente()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_count integer := 0;
  v_cfg record;
  v_uf text;
  v_cidade text;
  v_empresa uuid;
  v_resp uuid;
  v_modo text;
  v_only_online boolean;
begin
  if not (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master')) then
    raise exception 'forbidden';
  end if;

  select * into v_cfg from public.distribuicao_config where id = 'default';
  if not found or not coalesce(v_cfg.automatico_on,false) then return 0; end if;
  v_modo := coalesce(v_cfg.modo,'regiao');
  v_only_online := coalesce((v_cfg.criterios->>'disp')::boolean, false);

  for v_lead in
    select * from public.leads
     where empresa_id is null and responsavel_id is null
       and status_pipeline::text = 'novo'
       and coalesce(arquivado,false) = false
       and coalesce(bloqueado,false) = false
       and coalesce(em_avaliacao_matriz,false) = false
     order by criado_em asc
     limit 500
  loop
    v_uf     := upper(coalesce(v_lead.dados->>'uf',''));
    v_cidade := lower(coalesce(v_lead.dados->>'cidade',''));
    v_empresa := null;
    v_resp := null;

    if coalesce((v_cfg.criterios->>'regiao')::boolean, true) and (v_uf <> '' or v_cidade <> '') then
      select e.id into v_empresa from public.empresas e
       where e.status = 'aprovada' and e.tipo::text <> 'matriz'
         and ((v_uf <> '' and upper(coalesce(e.uf,'')) = v_uf)
              or (v_cidade <> '' and lower(coalesce(e.cidade,'')) = v_cidade))
       order by random() limit 1;
    end if;

    if v_empresa is null and v_modo = 'fila' then
      select e.id into v_empresa from public.empresas e
        left join public.leads l on l.empresa_id = e.id
          and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
          and coalesce(l.arquivado,false) = false
       where e.status = 'aprovada' and e.tipo::text <> 'matriz'
       group by e.id order by count(l.id) asc, random() limit 1;
    end if;

    if v_empresa is null and v_modo = 'performance' then
      select e.id into v_empresa from public.empresas e
        left join public.profiles p on p.empresa_id = e.id and p.status = 'aprovada'
       where e.status = 'aprovada' and e.tipo::text <> 'matriz'
       group by e.id order by count(p.id) desc, random() limit 1;
    end if;

    if v_empresa is null then
      select id into v_empresa from public.empresas
       where status = 'aprovada' and tipo::text <> 'matriz'
       order by random() limit 1;
    end if;
    if v_empresa is null then continue; end if;

    select p.id into v_resp
      from public.profiles p
      left join public.leads l on l.responsavel_id = p.id
        and l.status_pipeline::text in ('novo','contato','qualificado','qualificando','cotacao','cotando','proposta','proposta_enviada','negociacao','em_negociacao')
        and coalesce(l.arquivado,false) = false
      left join public.v_user_presence vp on vp.user_id = p.id
     where p.empresa_id = v_empresa
       and p.status = 'aprovada'
       and (not v_only_online or coalesce(vp.status_efetivo,'offline') = 'online')
     group by p.id, vp.status_efetivo
     order by count(l.id) asc, random() limit 1;

    -- Se "somente online" e não houver vendedor disponível, pula
    if v_resp is null and v_only_online then continue; end if;

    update public.leads
       set empresa_id = v_empresa,
           responsavel_id = v_resp,
           distribuido_em = case when v_resp is not null then now() else null end
     where id = v_lead.id;

    insert into public.lead_eventos(lead_id, tipo, titulo, descricao, ator_id, meta)
    values (v_lead.id, 'distribuido', 'Distribuído automaticamente',
            'Encaminhado pela regra automática vigente.',
            auth.uid(),
            jsonb_build_object('empresa_id', v_empresa, 'responsavel_id', v_resp, 'modo', v_modo, 'somente_online', v_only_online));

    v_count := v_count + 1;
  end loop;

  return v_count;
end$$;

grant execute on function public.distribuir_lead_auto() to authenticated;
grant execute on function public.distribuir_fila_pendente() to authenticated;
