-- Comissão abaixo de 20% na aba "+ Comissões": faixa extra 10-30 (26-30 é
-- "agravo", só rótulo no front). Abaixo de 20 exige aprovação do superior
-- imediato (superior_id) ou da Matriz. Aprovação vale por cotação+seguradora+valor.

-- 1) faixa do ajuste: 10 a 30
do $$
declare _c text;
begin
  for _c in select conname from pg_constraint
             where conrelid = 'public.cotacao_seguradora_ajustes'::regclass
               and contype = 'c' and pg_get_constraintdef(oid) ilike '%comissao_pct%between%'
  loop
    execute format('alter table public.cotacao_seguradora_ajustes drop constraint %I', _c);
  end loop;
end $$;
alter table public.cotacao_seguradora_ajustes
  drop constraint if exists cotacao_seguradora_ajustes_comissao_pct_check;
alter table public.cotacao_seguradora_ajustes
  drop constraint if exists cot_seg_ajustes_comissao_faixa;
alter table public.cotacao_seguradora_ajustes
  add constraint cot_seg_ajustes_comissao_faixa
  check (comissao_pct is null or comissao_pct between 10 and 30);

-- 2) solicitações
create table if not exists public.comissao_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cotacoes(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id),
  seguradora text not null check (char_length(seguradora) between 1 and 80),
  comissao_pct numeric(5,2) not null check (comissao_pct >= 10 and comissao_pct < 20),
  solicitante_id uuid not null references public.profiles(id),
  nivel_atual uuid references public.profiles(id),
  status text not null default 'pendente'
    check (status in ('pendente','aprovada','recusada','cancelada')),
  motivo_recusa text check (motivo_recusa is null or char_length(motivo_recusa) <= 500),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid references public.profiles(id)
);
create index if not exists comissao_solic_cot_idx on public.comissao_solicitacoes (cotacao_id, seguradora, status);
create index if not exists comissao_solic_nivel_idx on public.comissao_solicitacoes (nivel_atual) where status = 'pendente';

create table if not exists public.comissao_trilha (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.comissao_solicitacoes(id) on delete cascade,
  autor_id uuid references public.profiles(id),
  acao text not null check (acao in ('solicitou','aprovou','recusou','cancelou')),
  comissao_pct numeric(5,2) check (comissao_pct is null or (comissao_pct >= 0 and comissao_pct <= 100)),
  observacao text check (observacao is null or char_length(observacao) <= 500),
  criado_em timestamptz not null default now()
);

create or replace function public.tg_comissao_trilha_imutavel()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'comissao_trilha é imutável' using errcode = '42501';
end $$;
drop trigger if exists comissao_trilha_imutavel on public.comissao_trilha;
create trigger comissao_trilha_imutavel
  before update or delete on public.comissao_trilha
  for each row execute function public.tg_comissao_trilha_imutavel();

alter table public.comissao_solicitacoes enable row level security;
alter table public.comissao_trilha enable row level security;
revoke all on public.comissao_solicitacoes, public.comissao_trilha from public, anon, authenticated;
grant select on public.comissao_solicitacoes, public.comissao_trilha to authenticated;
grant all on public.comissao_solicitacoes, public.comissao_trilha to service_role;

drop policy if exists comissao_solicitacoes_select on public.comissao_solicitacoes;
create policy comissao_solicitacoes_select on public.comissao_solicitacoes
  for select to authenticated
  using (nivel_atual = auth.uid() or public.fn_pode_ver_solicitacao_desconto(solicitante_id));

drop policy if exists comissao_trilha_select on public.comissao_trilha;
create policy comissao_trilha_select on public.comissao_trilha
  for select to authenticated
  using (exists (select 1 from public.comissao_solicitacoes s
                  where s.id = comissao_trilha.solicitacao_id
                    and (s.nivel_atual = auth.uid()
                         or public.fn_pode_ver_solicitacao_desconto(s.solicitante_id))));

-- 3) RPCs
create or replace function public.solicitar_comissao_baixa(
  p_cotacao_id uuid, p_seguradora text, p_comissao_pct numeric
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  _uid uuid := auth.uid();
  _empresa uuid;
  _sup uuid;
  _id uuid;
  _ant record;
begin
  _empresa := public.fn_cot_seg_ajuste_acesso(p_cotacao_id);
  if p_comissao_pct is null or p_comissao_pct < 10 or p_comissao_pct >= 20 then
    raise exception 'comissão fora da faixa de aprovação (10 a 19,99)' using errcode = '23514';
  end if;
  select superior_id into _sup from public.profiles where id = _uid;

  for _ant in select id from public.comissao_solicitacoes
               where cotacao_id = p_cotacao_id and seguradora = p_seguradora
                 and status = 'pendente' for update
  loop
    update public.comissao_solicitacoes
       set status = 'cancelada', resolvido_em = now(), resolvido_por = _uid where id = _ant.id;
    insert into public.comissao_trilha (solicitacao_id, autor_id, acao, observacao)
    values (_ant.id, _uid, 'cancelou', 'substituída por nova solicitação');
  end loop;

  insert into public.comissao_solicitacoes
    (cotacao_id, empresa_id, seguradora, comissao_pct, solicitante_id, nivel_atual)
  values (p_cotacao_id, _empresa, p_seguradora, p_comissao_pct, _uid, _sup)  -- sem superior: só a Matriz resolve
  returning id into _id;
  insert into public.comissao_trilha (solicitacao_id, autor_id, acao, comissao_pct)
  values (_id, _uid, 'solicitou', p_comissao_pct);
  return _id;
end $$;

create or replace function public.aprovar_comissao_baixa(p_id uuid)
returns table (cotacao_id uuid, seguradora text, comissao_pct numeric, solicitante_id uuid)
language plpgsql security definer set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  _uid uuid := auth.uid();
  s public.comissao_solicitacoes%rowtype;
begin
  if _uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  select * into s from public.comissao_solicitacoes where id = p_id for update;
  if not found or not (coalesce(s.nivel_atual = _uid, false) or public.has_role(_uid, 'matriz')) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if s.status <> 'pendente' then
    raise exception 'solicitação não está pendente' using errcode = '22023';
  end if;
  update public.comissao_solicitacoes
     set status = 'aprovada', resolvido_em = now(), resolvido_por = _uid where id = p_id;
  insert into public.comissao_trilha (solicitacao_id, autor_id, acao, comissao_pct)
  values (p_id, _uid, 'aprovou', s.comissao_pct);

  insert into public.cotacao_seguradora_ajustes
    (cotacao_id, empresa_id, seguradora, comissao_pct, aplicado_em, updated_by)
  values (s.cotacao_id, s.empresa_id, s.seguradora, s.comissao_pct, null, s.solicitante_id)
  on conflict (cotacao_id, seguradora) do update set
    comissao_pct = excluded.comissao_pct, aplicado_em = null, updated_by = excluded.updated_by;

  return query select s.cotacao_id, s.seguradora, s.comissao_pct, s.solicitante_id;
end $$;

create or replace function public.recusar_comissao_baixa(p_id uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  _uid uuid := auth.uid();
  s public.comissao_solicitacoes%rowtype;
begin
  if _uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  if p_motivo is not null and char_length(p_motivo) > 500 then
    raise exception 'motivo muito longo' using errcode = '23514';
  end if;
  select * into s from public.comissao_solicitacoes where id = p_id for update;
  if not found or not (coalesce(s.nivel_atual = _uid, false) or public.has_role(_uid, 'matriz')) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if s.status <> 'pendente' then
    raise exception 'solicitação não está pendente' using errcode = '22023';
  end if;
  update public.comissao_solicitacoes
     set status = 'recusada', motivo_recusa = p_motivo, resolvido_em = now(), resolvido_por = _uid
   where id = p_id;
  insert into public.comissao_trilha (solicitacao_id, autor_id, acao, comissao_pct, observacao)
  values (p_id, _uid, 'recusou', s.comissao_pct, p_motivo);
end $$;

create or replace function public.cancelar_comissao_baixa(p_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  _uid uuid := auth.uid();
  s public.comissao_solicitacoes%rowtype;
begin
  if _uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  select * into s from public.comissao_solicitacoes where id = p_id for update;
  if not found or s.solicitante_id <> _uid then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if s.status <> 'pendente' then
    raise exception 'solicitação não está pendente' using errcode = '22023';
  end if;
  update public.comissao_solicitacoes
     set status = 'cancelada', resolvido_em = now(), resolvido_por = _uid where id = p_id;
  insert into public.comissao_trilha (solicitacao_id, autor_id, acao, comissao_pct)
  values (p_id, _uid, 'cancelou', s.comissao_pct);
end $$;

revoke all on function public.solicitar_comissao_baixa(uuid,text,numeric) from public, anon;
revoke all on function public.aprovar_comissao_baixa(uuid) from public, anon;
revoke all on function public.recusar_comissao_baixa(uuid,text) from public, anon;
revoke all on function public.cancelar_comissao_baixa(uuid) from public, anon;
grant execute on function public.solicitar_comissao_baixa(uuid,text,numeric) to authenticated;
grant execute on function public.aprovar_comissao_baixa(uuid) to authenticated;
grant execute on function public.recusar_comissao_baixa(uuid,text) to authenticated;
grant execute on function public.cancelar_comissao_baixa(uuid) to authenticated;

-- 4) salvar_ajuste_seguradora: abaixo de 20 exige solicitação aprovada (mesmo valor)
create or replace function public.salvar_ajuste_seguradora(
  p_cotacao_id uuid, p_seguradora text, p_franquia_1 text, p_franquia_2 text,
  p_vidros text, p_carro_reserva text, p_comissao_pct numeric default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  _empresa uuid;
  _id      uuid;
begin
  _empresa := public.fn_cot_seg_ajuste_acesso(p_cotacao_id);

  if p_comissao_pct is not null and (p_comissao_pct < 10 or p_comissao_pct > 30) then
    raise exception 'comissão fora da faixa (10 a 30)' using errcode = '23514';
  end if;
  if p_comissao_pct is not null and p_comissao_pct < 20
     and not exists (select 1 from public.comissao_solicitacoes s
                      where s.cotacao_id = p_cotacao_id and s.seguradora = p_seguradora
                        and s.comissao_pct = p_comissao_pct and s.status = 'aprovada') then
    raise exception 'comissão abaixo de 20%% exige aprovação' using errcode = '42501';
  end if;

  if exists (select 1 from public.cotacoes c
              where c.id = p_cotacao_id and c.status in ('proposta','aceita'))
     or exists (select 1 from public.propostas p
                 where p.cotacao_id = p_cotacao_id and p.status is distinct from 'cancelada') then
    raise exception 'cotação já virou proposta' using errcode = '22023';
  end if;

  insert into public.cotacao_seguradora_ajustes
    (cotacao_id, empresa_id, seguradora, franquia_primeira_opcao, franquia_segunda_opcao,
     vidros, carro_reserva, comissao_pct, aplicado_em, updated_by)
  values
    (p_cotacao_id, _empresa, p_seguradora, p_franquia_1, p_franquia_2,
     p_vidros, p_carro_reserva, p_comissao_pct, null, auth.uid())
  on conflict (cotacao_id, seguradora) do update set
    franquia_primeira_opcao = excluded.franquia_primeira_opcao,
    franquia_segunda_opcao  = excluded.franquia_segunda_opcao,
    vidros                  = excluded.vidros,
    carro_reserva           = excluded.carro_reserva,
    comissao_pct            = excluded.comissao_pct,
    aplicado_em             = null,
    updated_by              = excluded.updated_by
  returning id into _id;
  return _id;
end $$;
