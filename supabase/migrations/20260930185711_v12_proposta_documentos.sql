-- V12.4.7 fatia 1: documento PDF da proposta capturado do portal Quiver.
-- Bucket privado (só service_role) + tabela de controle + RPCs só service_role.

-- 1) Bucket privado, sem nenhuma policy em storage.objects para anon/authenticated.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('propostas-docs', 'propostas-docs', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf'];

-- 2) Tabela
create table if not exists public.proposta_documentos (
  id            uuid primary key default gen_random_uuid(),
  proposta_id   uuid not null references public.propostas(id) on delete cascade,
  empresa_id    uuid not null,
  tipo          text not null check (tipo in ('proposta_pdf')),
  status        text not null check (status in ('ok','pendente','falhou')),
  erro_codigo   text check (char_length(erro_codigo) <= 40),
  storage_path  text check (char_length(storage_path) <= 300),
  nome          text check (char_length(nome) <= 120),
  tamanho_bytes int  check (tamanho_bytes between 1024 and 10485760),
  sha256        text check (sha256 ~ '^[0-9a-f]{64}$'),
  tentativas    int  not null default 0 check (tentativas >= 0),
  capturado_em  timestamptz,
  tentado_em    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint proposta_documentos_uq unique (proposta_id, tipo),
  constraint proposta_documentos_ok_completo check (
    status <> 'ok' or (storage_path is not null and tamanho_bytes is not null and sha256 is not null))
);

create index if not exists proposta_documentos_empresa_idx on public.proposta_documentos (empresa_id);

alter table public.proposta_documentos enable row level security;
revoke all on public.proposta_documentos from public, anon, authenticated;
grant select on public.proposta_documentos to authenticated;
grant select, insert, update, delete on public.proposta_documentos to service_role;

-- Escopo herdado da própria propostas (prop_select roda com os direitos do
-- chamador): quem enxerga a proposta enxerga o documento.
drop policy if exists proposta_documentos_select on public.proposta_documentos;
create policy proposta_documentos_select on public.proposta_documentos
  for select to authenticated
  using (exists (select 1 from public.propostas p where p.id = proposta_documentos.proposta_id));

create or replace function public.tg_proposta_documentos_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists proposta_documentos_updated_at on public.proposta_documentos;
create trigger proposta_documentos_updated_at
  before update on public.proposta_documentos
  for each row execute function public.tg_proposta_documentos_updated_at();

-- 3a) Registro do resultado da captura (webhook do robô, via service_role).
create or replace function public.registrar_documento_proposta(
  p_cotacao_id uuid, p_tipo text, p_status text, p_storage_path text,
  p_nome text, p_tamanho int, p_sha256 text, p_erro_codigo text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _prop uuid;
  _emp  uuid;
  _id   uuid;
begin
  select t.proposta_id into _prop
    from public.cotacao_transmissoes t
   where t.cotacao_id = p_cotacao_id and t.status = 'transmitida' and t.proposta_id is not null
   order by t.criado_em desc limit 1;
  if _prop is null then
    raise exception 'sem transmissão bem-sucedida para a cotação' using errcode = 'P0001', hint = 'sem_transmissao';
  end if;
  select empresa_id into _emp from public.propostas where id = _prop;

  insert into public.proposta_documentos as d
    (proposta_id, empresa_id, tipo, status, erro_codigo, storage_path, nome,
     tamanho_bytes, sha256, tentativas, capturado_em, tentado_em)
  values
    (_prop, _emp, p_tipo, p_status,
     case when p_status = 'ok' then null else p_erro_codigo end,
     case when p_status = 'ok' then p_storage_path end,
     case when p_status = 'ok' then p_nome end,
     case when p_status = 'ok' then p_tamanho end,
     case when p_status = 'ok' then p_sha256 end,
     1, case when p_status = 'ok' then now() end, now())
  on conflict (proposta_id, tipo) do update set
    tentativas   = d.tentativas + 1,
    tentado_em   = now(),
    -- nunca rebaixa um documento já capturado
    status       = case when d.status = 'ok' then 'ok' else excluded.status end,
    erro_codigo  = case when d.status = 'ok' then null else excluded.erro_codigo end,
    storage_path = case when d.status = 'ok' then d.storage_path else excluded.storage_path end,
    nome         = case when d.status = 'ok' then d.nome else excluded.nome end,
    tamanho_bytes= case when d.status = 'ok' then d.tamanho_bytes else excluded.tamanho_bytes end,
    sha256       = case when d.status = 'ok' then d.sha256 else excluded.sha256 end,
    capturado_em = case when d.status = 'ok' then d.capturado_em else excluded.capturado_em end
  returning id into _id;
  return _id;
end $$;

-- 3b) Pedido de recaptura: valida dono/matriz, proposta transmitida e 1 por 5 min.
-- Chamada pela server function (service_role), que passa o uid já autenticado.
-- Inexistente e sem acesso respondem igual (42501).
create or replace function public.solicitar_recaptura_documento_proposta(
  p_proposta_id uuid, p_uid uuid
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _emp  uuid;
  _cot  uuid;
  _tr   text;
  _resp uuid;
  _doc  record;
  _novo uuid;
begin
  select p.empresa_id, p.cotacao_id, p.transmissao_status into _emp, _cot, _tr
    from public.propostas p where p.id = p_proposta_id;
  select c.responsavel_id into _resp from public.cotacoes c where c.id = _cot;

  if p_uid is null or _emp is null
     or not (coalesce(_resp = p_uid, false) or public.has_role(p_uid, 'matriz'::perfil)) then
    raise exception 'sem permissão sobre esta proposta' using errcode = '42501';
  end if;
  if _tr is distinct from 'transmitida' then
    raise exception 'proposta não transmitida' using errcode = 'P0001', hint = 'nao_transmitida';
  end if;

  select * into _doc from public.proposta_documentos
   where proposta_id = p_proposta_id and tipo = 'proposta_pdf' for update;
  if found then
    if _doc.status = 'ok' then
      raise exception 'documento já capturado' using errcode = 'P0001', hint = 'ja_capturado';
    end if;
    if _doc.tentado_em is not null and _doc.tentado_em > now() - interval '5 minutes' then
      raise exception 'aguarde 5 minutos entre tentativas' using errcode = 'P0001', hint = 'muito_cedo';
    end if;
    update public.proposta_documentos
       set status = 'pendente', erro_codigo = null, tentado_em = now()
     where id = _doc.id;
    return _doc.id;
  end if;

  insert into public.proposta_documentos (proposta_id, empresa_id, tipo, status, tentado_em)
  values (p_proposta_id, _emp, 'proposta_pdf', 'pendente', now())
  returning id into _novo;
  return _novo;
end $$;

revoke all on function public.registrar_documento_proposta(uuid,text,text,text,text,int,text,text) from public, anon, authenticated;
revoke all on function public.solicitar_recaptura_documento_proposta(uuid,uuid) from public, anon, authenticated;
grant execute on function public.registrar_documento_proposta(uuid,text,text,text,text,int,text,text) to service_role;
grant execute on function public.solicitar_recaptura_documento_proposta(uuid,uuid) to service_role;
