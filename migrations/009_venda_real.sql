-- ============================================================
-- 009: Backend das telas de Venda (real, sem mock)
-- ============================================================

-- ---------- LEADS: marcar último atendimento ----------
alter table public.leads
  add column if not exists ultimo_atendimento_em timestamptz;

create index if not exists leads_ult_atend_idx on public.leads(responsavel_id, ultimo_atendimento_em);

-- RPC: registrar início de atendimento (Atender agora)
create or replace function public.iniciar_atendimento(p_lead_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.leads
     set ultimo_atendimento_em = now(),
         atualizado_em = now()
   where id = p_lead_id
     and (responsavel_id = auth.uid()
          or public.has_role(auth.uid(),'matriz')
          or public.has_role(auth.uid(),'master'));
end $$;
grant execute on function public.iniciar_atendimento(uuid) to authenticated;

-- ---------- PROPOSTAS: campos novos ----------
alter table public.propostas
  add column if not exists cotacao_id uuid references public.cotacoes(id) on delete set null,
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists responsavel_id uuid references auth.users(id) on delete set null,
  add column if not exists seguradora text,
  add column if not exists premio numeric(14,2),
  add column if not exists aceita_em timestamptz,
  add column if not exists transmitida_em timestamptz,
  add column if not exists transmissao_obs text,
  add column if not exists atualizado_em timestamptz not null default now();

-- status: 'gerada' (premio selecionado) | 'transmitida' | 'cancelada'
update public.propostas set status='gerada' where status='rascunho';

create index if not exists propostas_resp_idx on public.propostas(responsavel_id);
create index if not exists propostas_cot_idx  on public.propostas(cotacao_id);
create index if not exists propostas_status_idx on public.propostas(status);

-- RLS propostas
drop policy if exists prop_select on public.propostas;
create policy prop_select on public.propostas for select to authenticated using (
  responsavel_id = auth.uid()
  or empresa_id in (select empresa_id from public.profiles where id=auth.uid())
  or public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master')
);
drop policy if exists prop_iud on public.propostas;
create policy prop_iud on public.propostas for all to authenticated
  using (responsavel_id = auth.uid() or public.has_role(auth.uid(),'matriz'))
  with check (responsavel_id = auth.uid() or public.has_role(auth.uid(),'matriz'));

-- Trigger: ao marcar um prêmio como selecionada, gera/atualiza proposta
create or replace function public._gerar_proposta_de_premio()
returns trigger language plpgsql security definer set search_path=public as $$
declare _cot record;
begin
  if new.selecionada is not true then
    return new;
  end if;
  -- desmarca outros prêmios da mesma cotação
  update public.cotacao_premios
     set selecionada = false
   where cotacao_id = new.cotacao_id and id <> new.id;

  select c.id, c.empresa_id, c.lead_id, c.responsavel_id, c.numero
    into _cot from public.cotacoes c where c.id = new.cotacao_id;

  insert into public.propostas (
    empresa_id, cotacao_id, lead_id, responsavel_id,
    numero, status, seguradora, premio, valor, atualizado_em
  ) values (
    _cot.empresa_id, _cot.id, _cot.lead_id, _cot.responsavel_id,
    'PRP-'||lpad(_cot.numero::text,5,'0'),
    'gerada', new.seguradora, new.premio, new.premio, now()
  )
  on conflict (cotacao_id) do update
     set seguradora = excluded.seguradora,
         premio = excluded.premio,
         valor = excluded.valor,
         status = case when public.propostas.status='transmitida' then public.propostas.status else 'gerada' end,
         atualizado_em = now();

  update public.cotacoes set status='proposta', atualizado_em=now()
   where id=_cot.id and status in ('rascunho','calculada');

  return new;
end $$;

-- garante unicidade (cotacao_id) para o ON CONFLICT
create unique index if not exists propostas_cotacao_uq on public.propostas(cotacao_id) where cotacao_id is not null;

drop trigger if exists trg_premio_selecionado on public.cotacao_premios;
create trigger trg_premio_selecionado
  after insert or update of selecionada on public.cotacao_premios
  for each row execute function public._gerar_proposta_de_premio();

-- RPC: transmitir proposta
create or replace function public.transmitir_proposta(p_proposta_id uuid, p_obs text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.propostas
     set status='transmitida',
         transmitida_em = now(),
         transmissao_obs = p_obs,
         aceita_em = coalesce(aceita_em, now()),
         atualizado_em = now()
   where id = p_proposta_id
     and (responsavel_id = auth.uid()
          or public.has_role(auth.uid(),'matriz'));
end $$;
grant execute on function public.transmitir_proposta(uuid, text) to authenticated;

-- ---------- MENSAGENS PRONTAS (globais da matriz + pessoais) ----------
do $$ begin
  create type public.msg_escopo as enum ('global','pessoal');
exception when duplicate_object then null; end $$;

create table if not exists public.mensagens_prontas (
  id uuid primary key default gen_random_uuid(),
  escopo public.msg_escopo not null default 'pessoal',
  owner_id uuid references auth.users(id) on delete cascade, -- null quando global
  titulo text not null,
  conteudo text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.mensagens_prontas to authenticated;
grant all on public.mensagens_prontas to service_role;
alter table public.mensagens_prontas enable row level security;

drop policy if exists msg_select on public.mensagens_prontas;
create policy msg_select on public.mensagens_prontas for select to authenticated using (
  escopo = 'global' or owner_id = auth.uid()
);
drop policy if exists msg_insert on public.mensagens_prontas;
create policy msg_insert on public.mensagens_prontas for insert to authenticated with check (
  (escopo='pessoal' and owner_id = auth.uid())
  or (escopo='global' and public.has_role(auth.uid(),'matriz'))
);
drop policy if exists msg_update on public.mensagens_prontas;
create policy msg_update on public.mensagens_prontas for update to authenticated
  using (owner_id = auth.uid() or (escopo='global' and public.has_role(auth.uid(),'matriz')))
  with check (owner_id = auth.uid() or (escopo='global' and public.has_role(auth.uid(),'matriz')));
drop policy if exists msg_delete on public.mensagens_prontas;
create policy msg_delete on public.mensagens_prontas for delete to authenticated using (
  owner_id = auth.uid() or (escopo='global' and public.has_role(auth.uid(),'matriz'))
);

create index if not exists msg_owner_idx on public.mensagens_prontas(owner_id);
