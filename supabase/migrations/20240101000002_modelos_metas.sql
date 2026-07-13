-- ===========================================================================
-- CoteCerto 3.3 — Migração 002
-- Modelos de franquia, comissões, metas, vendas, acessos
-- Execute uma única vez no SQL editor.
-- ===========================================================================

-- ---------- MODELOS DE FRANQUIA (Personalização geral) ----------
do $$ begin
  create type public.modelo_tipo as enum ('franqueada','clt');
exception when duplicate_object then null; end $$;

create table if not exists public.modelos_franquia (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo public.modelo_tipo not null default 'franqueada',
  perc_comissao_padrao numeric(6,3) not null default 0,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
grant select on public.modelos_franquia to authenticated;
grant all on public.modelos_franquia to service_role;
alter table public.modelos_franquia enable row level security;

drop policy if exists modelos_select on public.modelos_franquia;
create policy modelos_select on public.modelos_franquia
  for select to authenticated using (true);

drop policy if exists modelos_admin on public.modelos_franquia;
create policy modelos_admin on public.modelos_franquia
  for all to authenticated
  using (public.has_role(auth.uid(),'matriz'))
  with check (public.has_role(auth.uid(),'matriz'));

insert into public.modelos_franquia (nome, tipo, perc_comissao_padrao, descricao)
values
  ('Franqueada Standard','franqueada', 15.0, 'Modelo padrão para franquias independentes'),
  ('CLT Operação Própria','clt', 4.0, 'Vendedores CLT da operação própria')
on conflict do nothing;

-- ---------- EMPRESAS: modelo + comissão override + dados de aceite ----------
alter table public.empresas add column if not exists modelo_id uuid references public.modelos_franquia(id);
alter table public.empresas add column if not exists perc_comissao numeric(6,3);
alter table public.empresas add column if not exists cidade text;
alter table public.empresas add column if not exists uf text;
alter table public.empresas add column if not exists email text;
alter table public.empresas add column if not exists telefone text;
alter table public.empresas add column if not exists aprovada_em timestamptz;
alter table public.empresas add column if not exists recusada_em timestamptz;
alter table public.empresas add column if not exists recusa_motivo text;

-- ---------- PROFILES: desligamento + meta de contato ----------
alter table public.profiles add column if not exists telefone text;
alter table public.profiles add column if not exists desligado_em timestamptz;
alter table public.profiles add column if not exists desligado_motivo text;
alter table public.profiles add column if not exists aprovada_em timestamptz;

-- ---------- METAS (empresa ou vendedor, mensal) ----------
do $$ begin
  create type public.meta_escopo as enum ('empresa','usuario');
exception when duplicate_object then null; end $$;

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  escopo public.meta_escopo not null,
  ref_id uuid not null,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  meta_vendas int not null default 0,
  meta_faturamento numeric(14,2) not null default 0,
  criado_em timestamptz not null default now(),
  unique (escopo, ref_id, ano, mes)
);
grant select, insert, update, delete on public.metas to authenticated;
grant all on public.metas to service_role;
alter table public.metas enable row level security;

drop policy if exists metas_select on public.metas;
create policy metas_select on public.metas for select to authenticated using (true);

drop policy if exists metas_admin on public.metas;
create policy metas_admin on public.metas for all to authenticated
  using (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master'))
  with check (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master'));

-- ---------- OPORTUNIDADES: comissão e pagamento ----------
alter table public.oportunidades add column if not exists comissao_valor numeric(14,2) not null default 0;
alter table public.oportunidades add column if not exists comissao_paga boolean not null default false;
alter table public.oportunidades add column if not exists comissao_paga_em timestamptz;
alter table public.oportunidades add column if not exists observacao text;

-- ---------- RLS BÁSICAS (idempotentes) ----------
drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas for select to authenticated
  using (id in (select empresa_id from public.empresas_visiveis(auth.uid())));

drop policy if exists empresas_admin on public.empresas;
create policy empresas_admin on public.empresas for all to authenticated
  using (public.has_role(auth.uid(),'matriz'))
  with check (public.has_role(auth.uid(),'matriz'));

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.has_role(auth.uid(),'matriz')
    or (public.has_role(auth.uid(),'master')
        and empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'matriz'))
  with check (id = auth.uid() or public.has_role(auth.uid(),'matriz'));

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles for select to authenticated using (true);

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to authenticated using (
  responsavel_id = auth.uid()
  or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
  or public.has_role(auth.uid(),'matriz')
);

drop policy if exists oport_select on public.oportunidades;
create policy oport_select on public.oportunidades for select to authenticated using (
  responsavel_id = auth.uid()
  or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
);

-- ---------- RPC: aprovar / recusar empresa ----------
drop function if exists public.aprovar_empresa(uuid);
drop function if exists public.recusar_empresa(uuid, text);
drop function if exists public.desligar_usuario(uuid, text);
create or replace function public.aprovar_empresa(empresa_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'matriz') then
    raise exception 'permissao negada';
  end if;
  update public.empresas set status='aprovada', aprovada_em=now() where id=empresa_id;
  update public.profiles set status='aprovada', aprovada_em=now() where empresa_id=aprovar_empresa.empresa_id;
end $$;

create or replace function public.recusar_empresa(empresa_id uuid, motivo text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'matriz') then
    raise exception 'permissao negada';
  end if;
  update public.empresas set status='recusada', recusada_em=now(), recusa_motivo=motivo where id=empresa_id;
  update public.profiles set status='recusada' where empresa_id=recusar_empresa.empresa_id;
end $$;

create or replace function public.desligar_usuario(user_id uuid, motivo text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not (public.has_role(auth.uid(),'matriz') or public.has_role(auth.uid(),'master')) then
    raise exception 'permissao negada';
  end if;
  update public.profiles
     set status='suspensa', desligado_em=now(), desligado_motivo=motivo
   where id=user_id;
end $$;

-- ---------- RPC: registrar venda (manual) ----------
create or replace function public.registrar_venda(
  lead_id uuid,
  valor numeric,
  observacao text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  _empresa uuid; _resp uuid; _perc numeric; _comissao numeric; _est uuid; _opid uuid;
begin
  select empresa_id, responsavel_id into _empresa, _resp from public.leads where id=lead_id;
  if _empresa is null then raise exception 'lead sem empresa'; end if;
  select coalesce(e.perc_comissao, m.perc_comissao_padrao, 0) into _perc
    from public.empresas e
    left join public.modelos_franquia m on m.id = e.modelo_id
   where e.id=_empresa;
  _comissao := round(coalesce(valor,0) * coalesce(_perc,0) / 100.0, 2);
  select id into _est from public.pipeline_stages where nome ilike 'ganho' limit 1;
  insert into public.oportunidades (empresa_id, lead_id, responsavel_id, estagio_id, valor, comissao_valor, observacao)
    values (_empresa, lead_id, _resp, _est, valor, _comissao, observacao)
    returning id into _opid;
  update public.leads set status_pipeline='ganho', valor=valor, atualizado_em=now() where id=lead_id;
  return _opid;
end $$;

-- ---------- TRIGGER: lead -> ganho gera oportunidade automaticamente ----------
create or replace function public.tg_lead_ganho() returns trigger
language plpgsql security definer set search_path=public as $$
declare _perc numeric; _comissao numeric; _est uuid;
begin
  if new.status_pipeline='ganho' and (old.status_pipeline is distinct from 'ganho') then
    if not exists (select 1 from public.oportunidades where lead_id=new.id) then
      select coalesce(e.perc_comissao, m.perc_comissao_padrao, 0) into _perc
        from public.empresas e
        left join public.modelos_franquia m on m.id=e.modelo_id
       where e.id=new.empresa_id;
      _comissao := round(coalesce(new.valor,0)*coalesce(_perc,0)/100.0,2);
      select id into _est from public.pipeline_stages where nome ilike 'ganho' limit 1;
      insert into public.oportunidades (empresa_id, lead_id, responsavel_id, estagio_id, valor, comissao_valor)
        values (new.empresa_id, new.id, new.responsavel_id, _est, new.valor, _comissao);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_lead_ganho on public.leads;
create trigger trg_lead_ganho after update on public.leads
for each row execute function public.tg_lead_ganho();

-- ---------- VIEW: KPIs por franquia (mês corrente) ----------
create or replace view public.v_franquia_kpis as
select
  e.id as empresa_id,
  e.nome,
  e.cidade, e.uf,
  e.status,
  e.modelo_id,
  coalesce(e.perc_comissao, m.perc_comissao_padrao, 0) as perc_comissao_efetiva,
  (select count(*) from public.leads l where l.empresa_id=e.id and date_trunc('month',l.criado_em)=date_trunc('month',now())) as leads_mes,
  (select count(*) from public.leads l where l.empresa_id=e.id and l.status_pipeline not in ('ganho','perdido')) as em_aberto,
  (select count(*) from public.leads l where l.empresa_id=e.id and l.status_pipeline='perdido' and date_trunc('month',l.atualizado_em)=date_trunc('month',now())) as perdidos_mes,
  (select count(*) from public.oportunidades o where o.empresa_id=e.id and date_trunc('month',o.criado_em)=date_trunc('month',now())) as vendas_mes,
  (select coalesce(sum(o.valor),0) from public.oportunidades o where o.empresa_id=e.id and date_trunc('month',o.criado_em)=date_trunc('month',now())) as faturamento_mes,
  (select coalesce(sum(o.comissao_valor),0) from public.oportunidades o where o.empresa_id=e.id and date_trunc('month',o.criado_em)=date_trunc('month',now())) as comissao_mes,
  (select meta_vendas from public.metas mt where mt.escopo='empresa' and mt.ref_id=e.id and mt.ano=extract(year from now())::int and mt.mes=extract(month from now())::int) as meta_vendas,
  (select meta_faturamento from public.metas mt where mt.escopo='empresa' and mt.ref_id=e.id and mt.ano=extract(year from now())::int and mt.mes=extract(month from now())::int) as meta_faturamento
from public.empresas e
left join public.modelos_franquia m on m.id=e.modelo_id;

grant select on public.v_franquia_kpis to authenticated;

-- ---------- VIEW: KPIs por vendedor (mês corrente) ----------
create or replace view public.v_vendedor_kpis as
select
  p.id as user_id,
  p.nome,
  p.email,
  p.status,
  p.empresa_id,
  e.nome as empresa_nome,
  (select count(*) from public.leads l where l.responsavel_id=p.id and date_trunc('month',l.criado_em)=date_trunc('month',now())) as leads_mes,
  (select count(*) from public.leads l where l.responsavel_id=p.id and l.status_pipeline in ('cotacao','proposta','negociacao') and date_trunc('month',l.criado_em)=date_trunc('month',now())) as em_negociacao,
  (select count(*) from public.oportunidades o where o.responsavel_id=p.id and date_trunc('month',o.criado_em)=date_trunc('month',now())) as vendas_mes,
  (select coalesce(sum(o.comissao_valor),0) from public.oportunidades o where o.responsavel_id=p.id and date_trunc('month',o.criado_em)=date_trunc('month',now())) as comissao_mes,
  (select coalesce(sum(o.valor),0) from public.oportunidades o where o.responsavel_id=p.id and date_trunc('month',o.criado_em)=date_trunc('month',now())) as faturamento_mes,
  (select meta_vendas from public.metas mt where mt.escopo='usuario' and mt.ref_id=p.id and mt.ano=extract(year from now())::int and mt.mes=extract(month from now())::int) as meta_vendas
from public.profiles p
left join public.empresas e on e.id=p.empresa_id
where exists (select 1 from public.user_roles r where r.user_id=p.id and r.role='vendedor');

grant select on public.v_vendedor_kpis to authenticated;
