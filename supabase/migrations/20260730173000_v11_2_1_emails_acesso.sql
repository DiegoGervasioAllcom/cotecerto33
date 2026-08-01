-- ===========================================================================
-- V11.2.1 — pendência, recusa e outbox dos e-mails de acesso
-- Boas-vindas é preparada no código, mas só será enfileirada na V11.2.2.
-- ===========================================================================

alter table public.empresas
  add column if not exists pendencia_motivo text
    check (pendencia_motivo is null or char_length(trim(pendencia_motivo)) between 3 and 1000),
  add column if not exists pendencia_em timestamptz;

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo text not null check (tipo in ('pendencia', 'recusa', 'boas_vindas')),
  destinatario text not null check (
    char_length(destinatario) between 3 and 320
    and destinatario ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 12000),
  status text not null default 'pendente'
    check (status in ('pendente', 'enviando', 'enviado', 'falhou')),
  tentativas smallint not null default 0 check (tentativas between 0 and 10),
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  processando_em timestamptz,
  lease_token uuid,
  enviado_em timestamptz,
  provider_id text check (provider_id is null or char_length(provider_id) <= 200),
  ultimo_erro text check (ultimo_erro is null or char_length(ultimo_erro) <= 1000)
);

create index if not exists email_outbox_empresa_idx on public.email_outbox(empresa_id, criado_em desc);
create index if not exists email_outbox_status_idx on public.email_outbox(status, criado_em);

alter table public.email_outbox enable row level security;
revoke all on table public.email_outbox from public, anon, authenticated;
grant select on table public.email_outbox to authenticated;
grant select, insert, update on table public.email_outbox to service_role;

drop policy if exists email_outbox_select_criador on public.email_outbox;
create policy email_outbox_select_criador on public.email_outbox
  for select to authenticated
  using (criado_por = auth.uid());

create or replace function public.fn_tipo_declarado_email(p_empresa_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case c.perfil
      when 'franquia_full' then 'Franquia Full'
      when 'franquia_indiv' then 'Franquia Individual'
      when 'master' then 'Master'
      when 'vendedor' then 'Vendedor'
      when 'interno' then coalesce(c.cargo_id, 'Time interno da Matriz')
      else null
    end,
    case when e.tipo = 'pj' then 'Pessoa Jurídica' else 'Pessoa Física' end
  )
  from public.empresas e
  left join public.convites c on c.id = e.convite_id
  where e.id = p_empresa_id
$$;

revoke all on function public.fn_tipo_declarado_email(uuid) from public, anon, authenticated;

create or replace function public.solicitar_pendencia_acesso(
  p_empresa_id uuid,
  p_pendencia text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _nome text;
  _email text;
  _pedido_em timestamptz;
  _outbox_id uuid;
begin
  if not public.fn_pode_aprovar_pedido(_uid, p_empresa_id) then
    raise exception 'Seu acesso não permite analisar este pedido';
  end if;
  if p_pendencia is null or char_length(trim(p_pendencia)) not between 3 and 1000 then
    raise exception 'informe a pendência (3 a 1000 caracteres)';
  end if;

  select p.nome, p.email, e.created_at
    into _nome, _email, _pedido_em
    from public.empresas e
    join public.profiles p on p.empresa_id = e.id
   where e.id = p_empresa_id and e.status = 'pendente';
  if _email is null then raise exception 'pedido pendente não encontrado ou sem e-mail'; end if;

  update public.empresas
     set pendencia_motivo = trim(p_pendencia), pendencia_em = now()
   where id = p_empresa_id;

  insert into public.email_outbox (empresa_id, tipo, destinatario, payload, criado_por)
  values (
    p_empresa_id, 'pendencia', lower(trim(_email)),
    jsonb_build_object(
      'nome', _nome,
      'tipo_declarado', public.fn_tipo_declarado_email(p_empresa_id),
      'pendencia', trim(p_pendencia),
      'data_pedido', to_char(_pedido_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')
    ),
    _uid
  ) returning id into _outbox_id;
  return _outbox_id;
end
$$;

-- A versão anterior retorna void. PostgreSQL não permite trocar o retorno com
-- CREATE OR REPLACE, então removemos explicitamente a assinatura antes de
-- recriá-la retornando o id do evento da outbox.
drop function if exists public.recusar_empresa(uuid, text);

create function public.recusar_empresa(p_empresa_id uuid, motivo text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _nome text;
  _email text;
  _outbox_id uuid;
begin
  if not public.fn_pode_aprovar_pedido(_uid, p_empresa_id) then
    raise exception 'Seu acesso não permite recusar este pedido';
  end if;
  if motivo is null or char_length(trim(motivo)) not between 3 and 2000 then
    raise exception 'informe o motivo da recusa (3 a 2000 caracteres)';
  end if;

  select p.nome, p.email into _nome, _email
    from public.empresas e
    join public.profiles p on p.empresa_id = e.id
   where e.id = p_empresa_id and e.status = 'pendente';
  if _email is null then raise exception 'pedido pendente não encontrado ou sem e-mail'; end if;

  update public.empresas
     set status = 'recusada', recusada_em = now(), recusa_motivo = trim(motivo),
         pendencia_motivo = null, pendencia_em = null
   where id = p_empresa_id;
  update public.profiles set status = 'recusada' where empresa_id = p_empresa_id;

  insert into public.email_outbox (empresa_id, tipo, destinatario, payload, criado_por)
  values (
    p_empresa_id, 'recusa', lower(trim(_email)),
    jsonb_build_object(
      'nome', _nome,
      'tipo_declarado', public.fn_tipo_declarado_email(p_empresa_id),
      'motivo', trim(motivo)
    ),
    _uid
  ) returning id into _outbox_id;
  return _outbox_id;
end
$$;

create or replace function public.marcar_email_outbox_enviando(p_outbox_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare _row public.email_outbox;
begin
  update public.email_outbox
     set status = 'enviando', processando_em = now(), tentativas = tentativas + 1,
         lease_token = gen_random_uuid(),
         ultimo_erro = null
   where id = p_outbox_id
     and criado_por = auth.uid()
     and (
       status in ('pendente', 'falhou')
       or (status = 'enviando' and processando_em < now() - interval '5 minutes')
     )
     and tentativas < 10
  returning * into _row;
  if _row.id is null then raise exception 'e-mail indisponível para envio'; end if;
  return jsonb_build_object(
    'id', _row.id, 'tipo', _row.tipo, 'destinatario', _row.destinatario,
    'payload', _row.payload, 'lease_token', _row.lease_token
  );
end
$$;

create or replace function public.finalizar_email_outbox(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_enviado boolean,
  p_provider_id text default null,
  p_erro text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _alteradas integer;
begin
  if auth.role() <> 'service_role' then raise exception 'somente serviço'; end if;
  update public.email_outbox
     set status = case when p_enviado then 'enviado' else 'falhou' end,
         enviado_em = case when p_enviado then now() else null end,
         provider_id = left(p_provider_id, 200),
         ultimo_erro = left(p_erro, 1000)
   where id = p_outbox_id
     and status = 'enviando'
     and lease_token = p_lease_token;
  get diagnostics _alteradas = row_count;
  if _alteradas = 0 then
    raise exception 'lease de e-mail expirado ou substituído';
  end if;
end
$$;

revoke all on function public.solicitar_pendencia_acesso(uuid, text) from public, anon;
revoke all on function public.recusar_empresa(uuid, text) from public, anon;
revoke all on function public.marcar_email_outbox_enviando(uuid) from public, anon;
revoke all on function public.finalizar_email_outbox(uuid, uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.solicitar_pendencia_acesso(uuid, text) to authenticated;
grant execute on function public.recusar_empresa(uuid, text) to authenticated;
grant execute on function public.marcar_email_outbox_enviando(uuid) to authenticated;
grant execute on function public.finalizar_email_outbox(uuid, uuid, boolean, text, text) to service_role;
