-- ============================================================
-- `lead_agendamentos` — retornos/lembretes de lead agendados pelo vendedor
-- (ex.: "ligar pro cliente amanhã às 9h"), base da futura tela "Minha agenda"
-- (Frente 9, V12 — fora do escopo desta migration).
--
-- Não existia nenhuma tabela equivalente no schema (grep por agendamento/
-- lembrete/retorno em `supabase/migrations/` não encontrou nada além de
-- `codigo_retorno`/`mensagem_retorno` de `consultas_cpf`, que é outro
-- domínio: retorno de consulta externa, não agenda de vendedor).
--
-- Visibilidade espelha a policy ATUAL de `leads_select`
-- (20260820000000_fix_leads_select_vazamento_vendedor_full.sql): dono do
-- lead (`responsavel_id`), matriz, papel de gestão (franqueado/master/
-- supervisor/coordenador) na mesma empresa via `empresas_visiveis()`, e
-- interno na empresa matriz via `fn_empresa_matriz()`. Vendedor raso NÃO
-- ganha o branch de empresa — mesmo motivo do fix de leads: evitar vazar
-- agenda de colega na mesma Franquia Full. Mesmo predicado é reaproveitado
-- (não um novo helper) nas 3 policies (select/insert/update), seguindo o
-- padrão já usado para outras tabelas-filhas de `leads` (`lead_eventos`,
-- `cotacao_veiculo` em 20260721150000_s_fix_master_rls_escopo_rede.sql):
-- `exists (select 1 from public.leads l where l.id = ... and (<mesmo
-- predicado>))`.
--
-- Sem DELETE de propósito: marcar `done=true` em vez de apagar, para manter
-- histórico do que já foi feito (a tela de agenda filtra por `done=false`).
-- ============================================================

create table if not exists public.lead_agendamentos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  data date not null,
  hora time null,
  nota text null check (nota is null or char_length(nota) <= 2000),
  done boolean not null default false,
  criado_em timestamptz not null default now(),
  criado_por uuid not null references auth.users(id) on delete cascade
);

comment on table public.lead_agendamentos is
  'Retorno/lembrete de lead agendado pelo vendedor (ex.: "ligar amanhã às 9h").
   Base da tela "Minha agenda" (V12). Nunca apagar linha: marcar done=true.';

create index if not exists idx_lead_agendamentos_lead_id
  on public.lead_agendamentos (lead_id);

-- Listagem da agenda pessoal ("meus pendentes, por data") é a query mais
-- comum da tela — índice parcial (só done=false) por dono + data.
create index if not exists idx_lead_agendamentos_pendentes
  on public.lead_agendamentos (criado_por, data)
  where done = false;

alter table public.lead_agendamentos enable row level security;

revoke all on public.lead_agendamentos from public, anon, authenticated;
grant select, insert, update on public.lead_agendamentos to authenticated;
grant all on public.lead_agendamentos to service_role;

drop policy if exists lead_agendamentos_select on public.lead_agendamentos;
create policy lead_agendamentos_select on public.lead_agendamentos
  for select to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_agendamentos.lead_id
        and (
          l.responsavel_id = auth.uid()
          or has_role(auth.uid(), 'matriz'::perfil)
          or (
            not has_role(auth.uid(), 'vendedor'::perfil)
            and l.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
          )
          or (
            has_role(auth.uid(), 'interno'::perfil)
            and l.empresa_id in (select empresa_id from public.fn_empresa_matriz())
          )
        )
    )
  );

drop policy if exists lead_agendamentos_insert on public.lead_agendamentos;
create policy lead_agendamentos_insert on public.lead_agendamentos
  for insert to authenticated
  with check (
    criado_por = auth.uid()
    and exists (
      select 1 from public.leads l
      where l.id = lead_agendamentos.lead_id
        and (
          l.responsavel_id = auth.uid()
          or has_role(auth.uid(), 'matriz'::perfil)
          or (
            not has_role(auth.uid(), 'vendedor'::perfil)
            and l.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
          )
          or (
            has_role(auth.uid(), 'interno'::perfil)
            and l.empresa_id in (select empresa_id from public.fn_empresa_matriz())
          )
        )
    )
  );

drop policy if exists lead_agendamentos_update on public.lead_agendamentos;
create policy lead_agendamentos_update on public.lead_agendamentos
  for update to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_agendamentos.lead_id
        and (
          l.responsavel_id = auth.uid()
          or has_role(auth.uid(), 'matriz'::perfil)
          or (
            not has_role(auth.uid(), 'vendedor'::perfil)
            and l.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
          )
          or (
            has_role(auth.uid(), 'interno'::perfil)
            and l.empresa_id in (select empresa_id from public.fn_empresa_matriz())
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_agendamentos.lead_id
        and (
          l.responsavel_id = auth.uid()
          or has_role(auth.uid(), 'matriz'::perfil)
          or (
            not has_role(auth.uid(), 'vendedor'::perfil)
            and l.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
          )
          or (
            has_role(auth.uid(), 'interno'::perfil)
            and l.empresa_id in (select empresa_id from public.fn_empresa_matriz())
          )
        )
    )
  );
