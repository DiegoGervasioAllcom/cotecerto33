-- ===========================================================================
-- G6.1 — Cron de renovação: cria lead de renovação 60 dias antes do
-- vencimento da apólice e expira (marca 'perdido') o que não renovou.
--
-- Elo escolhido: leads.renovacao_proposta_id -> propostas(id).
--   - Evita duplicar o lead de renovação para a mesma apólice (unique).
--   - Permite localizar o lead na hora de expirar.
--   - O front (G6.2) usa essa coluna para linkar a apólice de origem.
--
-- Distribuição: o lead nasce SEM empresa_id/responsavel_id (igual a
-- qualquer lead novo pré-distribuição). O trigger já existente
-- trg_distribuir_lead_auto (BEFORE INSERT, migrations 024/029) decide o
-- destino pela regra padrão vigente (distribuicao_config) — não vai para
-- o vendedor original da apólice.
--
-- "Perdida": critério conservador — se o lead de renovação continua em
-- status_pipeline aberto (não chegou a 'ganho'/'fechado', nem já está
-- 'perdido') no dia em que a apólice vence, o job marca 'perdido'. Não
-- há aqui detecção de "renovada" (isso já é medido em outro lugar, na
-- tela de Renovações, por propostas.tipo_venda='renovacao' emitidas).
-- ===========================================================================

alter table public.leads
  add column if not exists renovacao_proposta_id uuid references public.propostas(id) on delete set null;

create unique index if not exists leads_renovacao_proposta_uq
  on public.leads (renovacao_proposta_id)
  where renovacao_proposta_id is not null;

comment on column public.leads.renovacao_proposta_id is
  'G6.1: se origem=''renovacao'', aponta pra proposta (apólice) que originou este lead.
   Único por proposta — evita recriar o lead a cada execução do cron.';

-- ---------------------------------------------------------------------------
-- Função principal: cria leads de renovação (janela de 60 dias) e expira os
-- que não renovaram até o vencimento. Retorna um resumo em jsonb.
-- ---------------------------------------------------------------------------
create or replace function public.criar_leads_renovacao()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_criados int := 0;
  v_expirados int := 0;
  v_prop record;
  v_lead record;
  v_origem_lead record;
  v_ins int;
begin
  -- Gate: a função varre propostas/leads de TODAS as empresas (job global). Só
  -- o cron (que roda sem auth.uid()) ou a Matriz podem disparar — um usuário
  -- comum não pode antecipar/manipular renovações de outras redes.
  if auth.uid() is not null
     and not exists (
       select 1 from public.user_roles
        where user_id = auth.uid() and role = 'matriz'
     ) then
    raise exception 'permissão negada: só a Matriz pode disparar criar_leads_renovacao';
  end if;

  -- PASSO 1: cria leads de renovação p/ apólices vencendo nos próximos 60 dias
  for v_prop in
    select p.id, p.lead_id, p.cotacao_id
      from public.propostas p
     where p.vencimento is not null
       and p.vencimento between current_date and current_date + 60
       and p.cancelada_em is null
       and not exists (
         select 1 from public.leads l where l.renovacao_proposta_id = p.id
       )
  loop
    v_origem_lead := null;

    if v_prop.lead_id is not null then
      select l.cliente_id, l.nome, l.contato, l.dados
        into v_origem_lead
        from public.leads l
       where l.id = v_prop.lead_id;
    elsif v_prop.cotacao_id is not null then
      select l.cliente_id, l.nome, l.contato, l.dados
        into v_origem_lead
        from public.cotacoes c
        join public.leads l on l.id = c.lead_id
       where c.id = v_prop.cotacao_id;
    end if;

    insert into public.leads (
      cliente_id, origem, nome, contato, status_pipeline, dados, renovacao_proposta_id
    ) values (
      v_origem_lead.cliente_id,
      'renovacao',
      coalesce(v_origem_lead.nome, ''),
      v_origem_lead.contato,
      'novo',
      coalesce(v_origem_lead.dados, '{}'::jsonb),
      v_prop.id
    )
    on conflict (renovacao_proposta_id) where renovacao_proposta_id is not null do nothing;

    -- conta só o que realmente entrou (evita contador errado sob concorrência
    -- cron + disparo manual, quando o on conflict absorve a linha).
    get diagnostics v_ins = row_count;
    v_criados := v_criados + v_ins;
  end loop;

  -- PASSO 2: expira (perdido) leads de renovação cuja apólice já venceu e o
  -- lead segue aberto (não ganhou nem já foi marcado perdido).
  for v_lead in
    select l.id
      from public.leads l
      join public.propostas p on p.id = l.renovacao_proposta_id
     where l.origem = 'renovacao'
       and l.renovacao_proposta_id is not null
       and p.vencimento is not null
       and p.vencimento < current_date
       and l.status_pipeline not in ('ganho', 'fechado', 'perdido')
  loop
    update public.leads
       set status_pipeline = 'perdido',
           atualizado_em = now()
     where id = v_lead.id;

    v_expirados := v_expirados + 1;
  end loop;

  return jsonb_build_object('criados', v_criados, 'expirados', v_expirados);
end;
$$;

revoke all on function public.criar_leads_renovacao() from public, anon;

-- A Matriz pode disparar manualmente (útil p/ suporte/depuração); o cron
-- roda como owner da função e não depende desse grant. service_role p/
-- fixtures/jobs administrativos (ex.: testes, chamadas server-side).
grant execute on function public.criar_leads_renovacao() to authenticated, service_role;

comment on function public.criar_leads_renovacao() is
  'G6.1: cria leads de renovação p/ apólices vencendo em até 60 dias e marca
   perdido o que não renovou até o vencimento. Chamada por pg_cron diário;
   grant a authenticated (não anon) permite disparo manual pela Matriz caso
   necessário — a operação é idempotente e não muda alçada/dinheiro.';

-- ---------------------------------------------------------------------------
-- Agendamento diário via pg_cron (mesmo padrão best-effort da migration 030
-- — produção pode não conceder privilégio ao pg_cron; não pode falhar a
-- migration nesse caso).
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when insufficient_privilege then
    return;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
       from cron.job
      where jobname = 'criar_leads_renovacao';

    perform cron.schedule(
      'criar_leads_renovacao',
      '0 6 * * *',
      $cron$ select public.criar_leads_renovacao(); $cron$
    );
  end if;
exception when insufficient_privilege then
  null;
end$$;
