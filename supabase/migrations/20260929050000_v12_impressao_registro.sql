-- V12 Impressão, fatia B (1/3): registro append-only de baixar/imprimir/e-mail
-- da cotação + RPC que o grava. O % de comissão exibido é lido NO SERVIDOR.
--
-- Sem FK em cotacao_id/empresa_id/usuario_id: são uuids de snapshot. A trilha
-- é imutável (trigger) e sobrevive à exclusão de cotação/empresa/usuário, e
-- nada deixa de poder ser apagado por causa dela (nem via cascade). A
-- existência da cotação e o acesso são conferidos pela RPC na hora de gravar.

create table if not exists public.cotacao_impressoes (
  id           uuid primary key default gen_random_uuid(),
  cotacao_id   uuid not null,
  empresa_id   uuid not null,
  usuario_id   uuid not null default auth.uid(),
  acao         text not null check (acao in ('baixar','imprimir','email')),
  modelo       text not null check (modelo in ('a','b')),
  detalhada    boolean not null default false,
  seguradoras  jsonb not null default '[]'::jsonb
               check (jsonb_typeof(seguradoras) = 'array' and octet_length(seguradoras::text) <= 2000),
  com_comissao boolean not null default false,
  pct_exibido  numeric check (pct_exibido between 0 and 100),
  destinatario text check (char_length(destinatario) <= 254),
  criado_em    timestamptz not null default now(),
  constraint cot_impr_comissao_sem_email check (not com_comissao or acao <> 'email'),
  constraint cot_impr_pct_so_com_comissao check (pct_exibido is null or com_comissao)
);

create index if not exists cot_impr_cotacao_idx on public.cotacao_impressoes (cotacao_id);
create index if not exists cot_impr_empresa_idx on public.cotacao_impressoes (empresa_id);
create index if not exists cot_impr_usuario_idx on public.cotacao_impressoes (usuario_id);

alter table public.cotacao_impressoes enable row level security;

revoke all on public.cotacao_impressoes from public, anon, authenticated;
grant select on public.cotacao_impressoes to authenticated;
-- service_role: só select/insert (UPDATE/DELETE barrados por grant e pelo trigger)
grant select, insert on public.cotacao_impressoes to service_role;

drop policy if exists cot_impr_select on public.cotacao_impressoes;
create policy cot_impr_select on public.cotacao_impressoes for select to authenticated
  using (
    usuario_id = auth.uid()
    or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
  );

create or replace function public.tg_cotacao_impressoes_imutavel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'cotacao_impressoes é imutável (append-only)' using errcode = '42501';
end $$;

drop trigger if exists cot_impr_imutavel on public.cotacao_impressoes;
create trigger cot_impr_imutavel
  before update or delete on public.cotacao_impressoes
  for each row execute function public.tg_cotacao_impressoes_imutavel();

drop trigger if exists cot_impr_sem_truncate on public.cotacao_impressoes;
create trigger cot_impr_sem_truncate
  before truncate on public.cotacao_impressoes
  for each statement execute function public.tg_cotacao_impressoes_imutavel();

create or replace function public.rpc_registrar_impressao(
  p_cotacao_id   uuid,
  p_acao         text,
  p_modelo       text,
  p_detalhada    boolean,
  p_seguradoras  jsonb,
  p_com_comissao boolean,
  p_destinatario text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _uid     uuid := auth.uid();
  _empresa uuid;
  _resp    uuid;
  _pct     numeric;
  _fonte   text;
  _id      uuid;
begin
  if _uid is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;

  select c.empresa_id, c.responsavel_id into _empresa, _resp
    from public.cotacoes c where c.id = p_cotacao_id;
  -- inexistente e sem acesso respondem igual (não permite sondar existência);
  -- checagem sempre booleana: responsavel_id pode ser NULL
  if _empresa is null
     or not (coalesce(_resp = _uid, false)
             or _empresa in (select empresa_id from public.empresas_visiveis(_uid))) then
    raise exception 'sem permissão sobre esta cotação' using errcode = '42501';
  end if;

  if coalesce(p_com_comissao, false) and p_acao = 'email' then
    raise exception 'e-mail não pode conter comissão' using errcode = '22023';
  end if;

  if coalesce(p_com_comissao, false) then
    select f.pct, f.fonte into _pct, _fonte from public.fn_pct_comissao_efetivo(_empresa) f;
    if _fonte = 'fallback' then
      raise exception 'percentual de comissão não cadastrado para esta corretora' using errcode = '22023';
    end if;
  end if;

  insert into public.cotacao_impressoes
    (cotacao_id, empresa_id, usuario_id, acao, modelo, detalhada, seguradoras,
     com_comissao, pct_exibido, destinatario)
  values
    (p_cotacao_id, _empresa, _uid, p_acao, p_modelo, coalesce(p_detalhada, false),
     coalesce(p_seguradoras, '[]'::jsonb), coalesce(p_com_comissao, false),
     case when coalesce(p_com_comissao, false) then _pct end, p_destinatario)
  returning id into _id;
  return _id;
end $$;

revoke all on function public.rpc_registrar_impressao(uuid,text,text,boolean,jsonb,boolean,text) from public, anon;
grant execute on function public.rpc_registrar_impressao(uuid,text,text,boolean,jsonb,boolean,text) to authenticated;
