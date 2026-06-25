-- ============================================================
-- 038: Conta corrente de comissões por vendedor
-- Lançamentos automáticos: crédito ao pagar, débito ao estornar
-- ============================================================

create table if not exists public.comissao_lancamentos (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete set null,
  proposta_id uuid references public.propostas(id) on delete set null,
  tipo text not null check (tipo in ('credito','debito')),
  valor numeric(14,2) not null,
  descricao text not null,
  referencia text,                -- ex: nº apólice / nº proposta
  seguradora text,
  origem text not null default 'auto', -- 'auto' | 'manual' | 'ajuste'
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists cclanc_vend_idx     on public.comissao_lancamentos(vendedor_id, criado_em desc);
create index if not exists cclanc_proposta_idx on public.comissao_lancamentos(proposta_id);
create index if not exists cclanc_empresa_idx  on public.comissao_lancamentos(empresa_id, criado_em desc);
create unique index if not exists cclanc_proposta_tipo_uq
  on public.comissao_lancamentos(proposta_id, tipo)
  where proposta_id is not null;

grant select, insert, update, delete on public.comissao_lancamentos to authenticated;
grant all on public.comissao_lancamentos to service_role;

alter table public.comissao_lancamentos enable row level security;

drop policy if exists "cc lanc select" on public.comissao_lancamentos;
create policy "cc lanc select" on public.comissao_lancamentos
  for select to authenticated
  using (
    vendedor_id = auth.uid()
    or public.has_role(auth.uid(),'matriz')
    or public.has_role(auth.uid(),'master')
    or public.has_role(auth.uid(),'franqueado')
  );

drop policy if exists "cc lanc insert matriz" on public.comissao_lancamentos;
create policy "cc lanc insert matriz" on public.comissao_lancamentos
  for insert to authenticated
  with check (
    public.has_role(auth.uid(),'matriz')
    or public.has_role(auth.uid(),'master')
  );

-- ============================================================
-- View de saldo por vendedor
-- ============================================================
create or replace view public.vendedor_conta_corrente_saldo as
select
  vendedor_id,
  sum(case when tipo='credito' then valor else 0 end) as total_creditos,
  sum(case when tipo='debito'  then valor else 0 end) as total_debitos,
  sum(case when tipo='credito' then valor else -valor end) as saldo,
  count(*) filter (where tipo='credito') as qtd_creditos,
  count(*) filter (where tipo='debito')  as qtd_debitos,
  max(criado_em) as ultimo_lancamento
from public.comissao_lancamentos
group by vendedor_id;

grant select on public.vendedor_conta_corrente_saldo to authenticated;

-- ============================================================
-- Trigger: cria/lança automaticamente em pagamento e cancelamento
-- ============================================================
create or replace function public._sync_comissao_lancamento()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_valor numeric;
  v_ref   text;
begin
  v_valor := coalesce(new.comissao_valor, coalesce(new.premio, new.valor, 0) * 0.16);
  v_ref   := coalesce(new.apolice_numero, new.numero, new.id::text);

  -- CRÉDITO: marcou pago_em (e antes não estava pago) e tem responsável
  if new.pago_em is not null
     and (tg_op='INSERT' or old.pago_em is distinct from new.pago_em)
     and new.responsavel_id is not null
     and coalesce(v_valor,0) > 0
     and new.cancelada_em is null then
    insert into public.comissao_lancamentos
      (vendedor_id, empresa_id, proposta_id, tipo, valor, descricao, referencia, seguradora, origem)
    values
      (new.responsavel_id, new.empresa_id, new.id, 'credito', v_valor,
       'Comissão paga · ' || coalesce(new.seguradora,'—'),
       v_ref, new.seguradora, 'auto')
    on conflict (proposta_id, tipo) do nothing;
  end if;

  -- DÉBITO: marcou cancelada_em (estorno) e havia crédito anterior
  if new.cancelada_em is not null
     and (tg_op='INSERT' or old.cancelada_em is distinct from new.cancelada_em)
     and new.responsavel_id is not null
     and coalesce(v_valor,0) > 0 then
    insert into public.comissao_lancamentos
      (vendedor_id, empresa_id, proposta_id, tipo, valor, descricao, referencia, seguradora, origem)
    values
      (new.responsavel_id, new.empresa_id, new.id, 'debito', v_valor,
       'Estorno de comissão · ' || coalesce(new.cancelamento_motivo,'cancelamento'),
       v_ref, new.seguradora, 'auto')
    on conflict (proposta_id, tipo) do nothing;
  end if;

  return new;
end $$;

drop trigger if exists trg_sync_comissao_lancamento on public.propostas;
create trigger trg_sync_comissao_lancamento
  after insert or update of pago_em, cancelada_em, comissao_valor on public.propostas
  for each row execute function public._sync_comissao_lancamento();

-- ============================================================
-- Backfill: gera lançamentos retroativos para propostas já pagas/canceladas
-- ============================================================
insert into public.comissao_lancamentos
  (vendedor_id, empresa_id, proposta_id, tipo, valor, descricao, referencia, seguradora, origem, criado_em)
select
  p.responsavel_id, p.empresa_id, p.id, 'credito',
  coalesce(p.comissao_valor, coalesce(p.premio,p.valor,0)*0.16),
  'Comissão paga · ' || coalesce(p.seguradora,'—'),
  coalesce(p.apolice_numero, p.numero, p.id::text),
  p.seguradora, 'auto', coalesce(p.pago_em, now())
from public.propostas p
where p.pago_em is not null
  and p.cancelada_em is null
  and p.responsavel_id is not null
  and coalesce(p.comissao_valor, coalesce(p.premio,p.valor,0)*0.16) > 0
on conflict (proposta_id, tipo) do nothing;

insert into public.comissao_lancamentos
  (vendedor_id, empresa_id, proposta_id, tipo, valor, descricao, referencia, seguradora, origem, criado_em)
select
  p.responsavel_id, p.empresa_id, p.id, 'debito',
  coalesce(p.comissao_valor, coalesce(p.premio,p.valor,0)*0.16),
  'Estorno de comissão · ' || coalesce(p.cancelamento_motivo,'cancelamento'),
  coalesce(p.apolice_numero, p.numero, p.id::text),
  p.seguradora, 'auto', coalesce(p.cancelada_em, now())
from public.propostas p
where p.cancelada_em is not null
  and p.responsavel_id is not null
  and coalesce(p.comissao_valor, coalesce(p.premio,p.valor,0)*0.16) > 0
on conflict (proposta_id, tipo) do nothing;

-- ============================================================
-- RPC: lançamento manual (ajuste) — só matriz
-- ============================================================
create or replace function public.lancar_ajuste_comissao(
  p_vendedor uuid,
  p_tipo text,
  p_valor numeric,
  p_descricao text
) returns uuid language plpgsql security definer set search_path=public as $$
declare _id uuid;
begin
  if not (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master')) then
    raise exception 'forbidden';
  end if;
  if p_tipo not in ('credito','debito') then
    raise exception 'tipo invalido';
  end if;
  insert into public.comissao_lancamentos
    (vendedor_id, tipo, valor, descricao, origem, criado_por)
  values
    (p_vendedor, p_tipo, p_valor, p_descricao, 'ajuste', auth.uid())
  returning id into _id;
  return _id;
end $$;
grant execute on function public.lancar_ajuste_comissao(uuid,text,numeric,text) to authenticated;
