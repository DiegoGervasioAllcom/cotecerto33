-- V11 — emissões de acesso: novo -> pendente (envio confirmado) -> ativo (senha criada).
-- O link de recovery, seu token e a senha pertencem ao GoTrue e nunca são persistidos aqui.

create table if not exists public.acesso_emissoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  outbox_id uuid not null unique references public.email_outbox(id) on delete cascade,
  numero smallint not null check (numero > 0),
  status text not null default 'novo'
    check (status in ('novo', 'pendente', 'ativo', 'invalidada')),
  criado_por uuid not null references public.profiles(id) on delete restrict,
  criado_em timestamptz not null default now(),
  envio_confirmado_em timestamptz,
  ativado_em timestamptz,
  constraint acesso_emissoes_estado_coerente check (
    (status = 'novo' and envio_confirmado_em is null and ativado_em is null)
    or (status = 'pendente' and envio_confirmado_em is not null and ativado_em is null)
    or (status = 'ativo' and envio_confirmado_em is not null and ativado_em is not null)
    or (status = 'invalidada' and ativado_em is null)
  ),
  unique (profile_id, numero)
);

create index if not exists acesso_emissoes_empresa_idx
  on public.acesso_emissoes (empresa_id, criado_em desc);
create index if not exists acesso_emissoes_profile_idx
  on public.acesso_emissoes (profile_id, criado_em desc);

alter table public.acesso_emissoes enable row level security;
revoke all on table public.acesso_emissoes from public, anon, authenticated;
grant select on table public.acesso_emissoes to authenticated;
grant select, insert, update, delete on table public.acesso_emissoes to service_role;

drop policy if exists acesso_emissoes_select_responsavel_ou_titular on public.acesso_emissoes;
create policy acesso_emissoes_select_responsavel_ou_titular on public.acesso_emissoes
  for select to authenticated
  using (
    profile_id = auth.uid()
    or public.fn_pode_aprovar_pedido(auth.uid(), empresa_id)
  );

-- V11 Full: depois da aprovação, o profile do vendedor passa a apontar para a
-- empresa da Full. O convite é a referência estável para localizar o titular.
create or replace function public.fn_profile_acesso_por_empresa(p_empresa_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.id
       from public.empresas e
       join public.profiles p on p.empresa_id = e.id
      where e.id = p_empresa_id and p.status = 'aprovada'::public.empresa_status
      order by p.created_at limit 1),
    (select c.usado_por
       from public.empresas e
       join public.convites c on c.id = e.convite_id
      where e.id = p_empresa_id)
  )
$$;

revoke all on function public.fn_profile_acesso_por_empresa(uuid) from public, anon;

-- Mantemos a unicidade que a RPC legada `enfileirar_boas_vindas` usa no
-- ON CONFLICT. O reenvio move a linha anterior para o tipo histórico abaixo,
-- liberando a chave para a próxima emissão sem alterar a RPC já publicada.
do $$
declare _constraint_name text;
begin
  select c.conname into _constraint_name
    from pg_constraint c
   where c.conrelid = 'public.email_outbox'::regclass
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) like '%pendencia%recusa%boas_vindas%';
  if _constraint_name is not null then
    execute format('alter table public.email_outbox drop constraint %I', _constraint_name);
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.email_outbox'::regclass
       and conname = 'email_outbox_tipo_check'
  ) then
    alter table public.email_outbox add constraint email_outbox_tipo_check
      check (tipo in ('pendencia', 'recusa', 'boas_vindas', 'boas_vindas_invalidada'));
  end if;
end
$$;

create unique index if not exists email_outbox_boas_vindas_empresa_uidx
  on public.email_outbox (empresa_id) where tipo = 'boas_vindas';

create or replace function public.fn_registrar_emissao_acesso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _profile_id uuid;
  _numero smallint;
begin
  if new.tipo <> 'boas_vindas' then
    return new;
  end if;

  _profile_id := public.fn_profile_acesso_por_empresa(new.empresa_id);
  if _profile_id is null then
    raise exception 'titular aprovado não encontrado para emissão de acesso';
  end if;

  if exists (
    select 1 from public.acesso_emissoes ae
     where ae.profile_id = _profile_id and ae.status = 'ativo'
  ) then
    raise exception 'acesso já está ativo; não é possível emitir novo link';
  end if;

  update public.acesso_emissoes
     set status = 'invalidada'
   where profile_id = _profile_id
     and status in ('novo', 'pendente');

  select coalesce(max(numero), 0)::smallint + 1 into _numero
    from public.acesso_emissoes
   where profile_id = _profile_id;

  insert into public.acesso_emissoes (empresa_id, profile_id, outbox_id, numero, criado_por)
  values (new.empresa_id, _profile_id, new.id, _numero, new.criado_por);
  return new;
end
$$;

drop trigger if exists registrar_emissao_acesso_outbox on public.email_outbox;
create trigger registrar_emissao_acesso_outbox
  after insert on public.email_outbox
  for each row execute function public.fn_registrar_emissao_acesso();

revoke all on function public.fn_registrar_emissao_acesso() from public, anon, authenticated;

-- A única confirmação de criação de senha é uma sessão autenticada do próprio
-- usuário, imediatamente depois de `auth.updateUser`. Não recebe senha/token.
create or replace function public.ativar_acesso_apos_criar_senha()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _emissao_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sessão autenticada obrigatória';
  end if;

  update public.acesso_emissoes
     set status = 'ativo', ativado_em = now()
   where id = (
     select ae.id from public.acesso_emissoes ae
      where ae.profile_id = auth.uid() and ae.status = 'pendente'
      order by ae.numero desc limit 1
   )
  returning id into _emissao_id;

  if _emissao_id is null then
    raise exception 'não há emissão pendente para ativar';
  end if;
  return _emissao_id;
end
$$;

revoke all on function public.ativar_acesso_apos_criar_senha() from public, anon;
grant execute on function public.ativar_acesso_apos_criar_senha() to authenticated;

create or replace function public.reenviar_link_acesso(p_empresa_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fn_pode_aprovar_pedido(auth.uid(), p_empresa_id) then
    raise exception 'Seu acesso não permite reenviar este link';
  end if;

  if exists (
    select 1 from public.acesso_emissoes ae
     where ae.empresa_id = p_empresa_id and ae.status = 'ativo'
  ) then
    raise exception 'acesso já está ativo; não é possível emitir novo link';
  end if;

  -- A linha não é apagada: preserva o rastro do provedor, mas deixa de ser
  -- elegível para dispatcher e libera o índice parcial usado pela RPC legada.
  update public.email_outbox eo
     set tipo = 'boas_vindas_invalidada', status = 'incerto',
         ultimo_erro = 'emissão invalidada por reenvio de acesso'
   where eo.empresa_id = p_empresa_id
     and eo.tipo = 'boas_vindas'
     and exists (
       select 1 from public.acesso_emissoes ae
        where ae.outbox_id = eo.id and ae.status in ('novo', 'pendente')
     );

  return public.enfileirar_boas_vindas(p_empresa_id);
end
$$;

revoke all on function public.reenviar_link_acesso(uuid) from public, anon;
grant execute on function public.reenviar_link_acesso(uuid) to authenticated;

-- O dispatcher já chama esta RPC após o provedor responder. Para boas-vindas,
-- o estado só avança quando o provedor confirmou o envio com provider_id.
create or replace function public.finalizar_email_outbox(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_resultado text,
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
  if p_resultado not in ('enviado', 'falha_explicita', 'incerto') then
    raise exception 'resultado de envio inválido';
  end if;
  if p_resultado = 'enviado' and nullif(trim(p_provider_id), '') is null then
    raise exception 'envio confirmado exige provider_id';
  end if;

  update public.email_outbox
     set status = case p_resultado
                    when 'enviado' then 'enviado'
                    when 'falha_explicita' then 'falhou'
                    else 'incerto'
                  end,
         enviado_em = case when p_resultado = 'enviado' then now() else null end,
         provider_id = case when p_resultado = 'enviado' then left(p_provider_id, 200) else null end,
         ultimo_erro = left(p_erro, 1000)
   where id = p_outbox_id and status = 'enviando' and lease_token = p_lease_token;
  get diagnostics _alteradas = row_count;
  if _alteradas = 0 then raise exception 'lease de e-mail expirado ou substituído'; end if;

  if p_resultado = 'enviado' then
    update public.acesso_emissoes
       set status = 'pendente', envio_confirmado_em = now()
     where outbox_id = p_outbox_id and status = 'novo';
  end if;
end
$$;

revoke all on function public.finalizar_email_outbox(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.finalizar_email_outbox(uuid, uuid, text, text, text) to service_role;

comment on table public.acesso_emissoes is
  'V11: metadados de emissão de acesso. Nunca contém URL, token ou senha; uma reemissão invalida a anterior.';
comment on function public.ativar_acesso_apos_criar_senha() is
  'V11: chamada pelo cliente autenticado logo após auth.updateUser concluir a senha; não recebe nem persiste senha ou token.';
comment on function public.reenviar_link_acesso(uuid) is
  'V11: reemite boas-vindas para acesso ainda não ativo; invalida a emissão anterior e retorna o novo outbox_id.';
