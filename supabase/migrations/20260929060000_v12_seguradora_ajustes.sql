-- V12.3.7 Personalizar por seguradora (fatia 1): ajuste de coberturas por
-- cotação+seguradora, válido só para o "Recalcular só esta seguradora".
-- Escrita somente via RPC; os valores espelham enumsCoberturas.ts.

create table if not exists public.cotacao_seguradora_ajustes (
  id                     uuid primary key default gen_random_uuid(),
  cotacao_id             uuid not null references public.cotacoes(id) on delete cascade,
  empresa_id             uuid not null,
  seguradora             text not null check (char_length(seguradora) between 1 and 60),
  franquia_primeira_opcao text check (franquia_primeira_opcao in
    ('Reduzida 25%','Reduzida 50%','Reduzida 75%','Normal 100%','Majorada 150%','Majorada 200%','Majorada 300%')),
  franquia_segunda_opcao text check (franquia_segunda_opcao in
    ('Reduzida 25%','Reduzida 50%','Reduzida 75%','Normal 100%','Majorada 150%','Majorada 200%','Majorada 300%','Não')),
  vidros                 text check (vidros in ('Não contratada','Básico','Intermediário','Superior')),
  carro_reserva          text check (carro_reserva in ('Não contratada','Básico','Intermediário','Superior')),
  aplicado_em            timestamptz,
  updated_at             timestamptz not null default now(),
  updated_by             uuid,
  constraint cot_seg_ajustes_uq unique (cotacao_id, seguradora),
  constraint cot_seg_ajustes_algum check (
    franquia_primeira_opcao is not null or franquia_segunda_opcao is not null
    or vidros is not null or carro_reserva is not null)
);

create index if not exists cot_seg_ajustes_cotacao_idx on public.cotacao_seguradora_ajustes (cotacao_id);

alter table public.cotacao_seguradora_ajustes enable row level security;
revoke all on public.cotacao_seguradora_ajustes from public, anon, authenticated;
grant select on public.cotacao_seguradora_ajustes to authenticated;
grant select, insert, update, delete on public.cotacao_seguradora_ajustes to service_role;

drop policy if exists cot_seg_ajustes_select on public.cotacao_seguradora_ajustes;
create policy cot_seg_ajustes_select on public.cotacao_seguradora_ajustes for select to authenticated
  using (
    empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
    or exists (select 1 from public.cotacoes c
               where c.id = cotacao_id and c.responsavel_id = auth.uid())
  );

create or replace function public.tg_cot_seg_ajustes_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists cot_seg_ajustes_updated_at on public.cotacao_seguradora_ajustes;
create trigger cot_seg_ajustes_updated_at
  before update on public.cotacao_seguradora_ajustes
  for each row execute function public.tg_cot_seg_ajustes_updated_at();

-- Checagem de acesso comum: devolve empresa_id da cotação ou levanta 42501
-- (inexistente e sem acesso respondem igual; comparação sempre booleana).
create or replace function public.fn_cot_seg_ajuste_acesso(p_cotacao_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _uid     uuid := auth.uid();
  _empresa uuid;
  _resp    uuid;
begin
  if _uid is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;
  select c.empresa_id, c.responsavel_id into _empresa, _resp
    from public.cotacoes c where c.id = p_cotacao_id;
  if _empresa is null
     or not (coalesce(_resp = _uid, false)
             or _empresa in (select empresa_id from public.empresas_visiveis(_uid))) then
    raise exception 'sem permissão sobre esta cotação' using errcode = '42501';
  end if;
  return _empresa;
end $$;
revoke all on function public.fn_cot_seg_ajuste_acesso(uuid) from public, anon, authenticated;

create or replace function public.salvar_ajuste_seguradora(
  p_cotacao_id uuid, p_seguradora text, p_franquia_1 text, p_franquia_2 text,
  p_vidros text, p_carro_reserva text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _empresa uuid;
  _id      uuid;
begin
  _empresa := public.fn_cot_seg_ajuste_acesso(p_cotacao_id);

  -- cotação que já virou proposta não aceita mais ajuste
  if exists (select 1 from public.cotacoes c
              where c.id = p_cotacao_id and c.status in ('proposta','aceita'))
     or exists (select 1 from public.propostas p
                 where p.cotacao_id = p_cotacao_id and p.status is distinct from 'cancelada') then
    raise exception 'cotação já virou proposta' using errcode = '22023';
  end if;

  insert into public.cotacao_seguradora_ajustes
    (cotacao_id, empresa_id, seguradora, franquia_primeira_opcao, franquia_segunda_opcao,
     vidros, carro_reserva, aplicado_em, updated_by)
  values
    (p_cotacao_id, _empresa, p_seguradora, p_franquia_1, p_franquia_2,
     p_vidros, p_carro_reserva, null, auth.uid())
  on conflict (cotacao_id, seguradora) do update set
    franquia_primeira_opcao = excluded.franquia_primeira_opcao,
    franquia_segunda_opcao  = excluded.franquia_segunda_opcao,
    vidros                  = excluded.vidros,
    carro_reserva           = excluded.carro_reserva,
    aplicado_em             = null,
    updated_by              = excluded.updated_by
  returning id into _id;
  return _id;
end $$;

create or replace function public.marcar_ajuste_aplicado(p_cotacao_id uuid, p_seguradora text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_cot_seg_ajuste_acesso(p_cotacao_id);
  update public.cotacao_seguradora_ajustes
     set aplicado_em = now(), updated_by = auth.uid()
   where cotacao_id = p_cotacao_id and seguradora = p_seguradora;
end $$;

create or replace function public.marcar_ajustes_nao_aplicados(p_cotacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_cot_seg_ajuste_acesso(p_cotacao_id);
  update public.cotacao_seguradora_ajustes
     set aplicado_em = null, updated_by = auth.uid()
   where cotacao_id = p_cotacao_id and aplicado_em is not null;
end $$;

revoke all on function public.salvar_ajuste_seguradora(uuid,text,text,text,text,text) from public, anon;
revoke all on function public.marcar_ajuste_aplicado(uuid,text) from public, anon;
revoke all on function public.marcar_ajustes_nao_aplicados(uuid) from public, anon;
grant execute on function public.salvar_ajuste_seguradora(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.marcar_ajuste_aplicado(uuid,text) to authenticated;
grant execute on function public.marcar_ajustes_nao_aplicados(uuid) to authenticated;
