-- ============================================================
-- `lembretes` — anotação pessoal do vendedor (tarefa/ligação/reunião/pessoal)
-- pra futura tela "Minha agenda" (Frente 9, V12 — fora do escopo desta
-- migration).
--
-- Diferença deliberada de `lead_agendamentos` (20260917010000): ali a
-- visibilidade espelha `leads_select` (dono do lead + matriz + gestão da
-- empresa via `empresas_visiveis()`), porque agendamento é acompanhamento de
-- um lead — dado de negócio compartilhado com quem também vê o lead.
-- `lembrete` é o oposto: é uma anotação 100% pessoal do vendedor (não tem
-- nem "dono do lead" como conceito de acesso) — mesmo quando `lead_id`
-- aponta pra um lead que outras pessoas (matriz, franqueado, colega) também
-- enxergam, o lembrete em si continua privado. Por isso aqui o predicado das
-- 4 policies é só `vendedor_id = auth.uid()`, sem branch de empresa/role
-- nenhum — nem matriz, nem franqueado, nem supervisor têm acesso.
--
-- Diferente de `lead_agendamentos`, aqui HÁ policy de DELETE: não é
-- histórico compartilhado que precisa ser preservado (done=true), é
-- anotação pessoal — o vendedor pode simplesmente apagar.
-- ============================================================

create table if not exists public.lembretes (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('tarefa', 'ligacao', 'reuniao', 'pessoal')),
  titulo text not null check (char_length(titulo) <= 2000),
  nota text null check (nota is null or char_length(nota) <= 2000),
  data date not null,
  hora time null,
  lead_id uuid null references public.leads(id) on delete set null,
  done boolean not null default false,
  criado_em timestamptz not null default now()
);

comment on table public.lembretes is
  'Lembrete pessoal do vendedor (tarefa/ligação/reunião/pessoal), opcionalmente
   ligado a um lead. 100% privado: só o próprio vendedor (vendedor_id) tem
   acesso, mesmo quando lead_id aponta pra um lead visível por outros papéis.
   Base da tela "Minha agenda" (V12), junto com lead_agendamentos.';

-- Listagem da agenda pessoal ("meus lembretes pendentes, por data") é a
-- query mais comum da tela.
create index if not exists idx_lembretes_vendedor_pendentes
  on public.lembretes (vendedor_id, done, data);

alter table public.lembretes enable row level security;

revoke all on public.lembretes from public, anon, authenticated;
grant select, insert, update, delete on public.lembretes to authenticated;
grant all on public.lembretes to service_role;

drop policy if exists lembretes_select on public.lembretes;
create policy lembretes_select on public.lembretes
  for select to authenticated
  using (vendedor_id = auth.uid());

drop policy if exists lembretes_insert on public.lembretes;
create policy lembretes_insert on public.lembretes
  for insert to authenticated
  with check (vendedor_id = auth.uid());

drop policy if exists lembretes_update on public.lembretes;
create policy lembretes_update on public.lembretes
  for update to authenticated
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

drop policy if exists lembretes_delete on public.lembretes;
create policy lembretes_delete on public.lembretes
  for delete to authenticated
  using (vendedor_id = auth.uid());
