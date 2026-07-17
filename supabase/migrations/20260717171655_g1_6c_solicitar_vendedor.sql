-- ===========================================================================
-- 045 (G1.6c) — Solicitação de cadastro de vendedor pelo grupo
--
-- Modelo "pedido → Matriz aprova": um usuário de GRUPO (master/supervisor/
-- franqueado) não cria o vendedor diretamente — ele registra um PEDIDO em
-- `vendedor_solicitacoes` (status 'pendente'). A Matriz revisa e resolve
-- (aprova/recusa) via `resolver_solicitacao_vendedor`. A criação efetiva do
-- usuário (auth.users + profiles + user_roles) reusa o fluxo já existente
-- de criação de usuário da Matriz — NÃO é feita aqui.
-- ===========================================================================

create table if not exists public.vendedor_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text,
  celular text,
  email text,
  solicitante_id uuid not null references public.profiles(id),
  empresa_id uuid references public.empresas(id),
  status text not null default 'pendente',
  observacao text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  constraint vendedor_solicitacoes_nome_tam
    check (char_length(nome) > 0 and char_length(nome) <= 150),
  constraint vendedor_solicitacoes_cpf_tam
    check (cpf is null or char_length(cpf) = 11),
  constraint vendedor_solicitacoes_celular_tam
    check (celular is null or char_length(celular) <= 20),
  constraint vendedor_solicitacoes_email_tam
    check (email is null or char_length(email) <= 150),
  constraint vendedor_solicitacoes_observacao_tam
    check (observacao is null or char_length(observacao) <= 500),
  constraint vendedor_solicitacoes_status_check
    check (status in ('pendente', 'aprovada', 'recusada'))
);

comment on table public.vendedor_solicitacoes is
  'Pedidos de cadastro de vendedor feitos por usuários de grupo (master/supervisor/franqueado). A Matriz aprova/recusa; a criação efetiva do usuário reusa o fluxo existente de criação de usuário da Matriz.';

alter table public.vendedor_solicitacoes enable row level security;

-- Grants mínimos: nada de insert/update direto, tudo via RPC security definer.
revoke all on public.vendedor_solicitacoes from public, anon, authenticated;
grant select on public.vendedor_solicitacoes to authenticated;
grant all on public.vendedor_solicitacoes to service_role;

-- ---------- Policies ----------

drop policy if exists vendedor_solicitacoes_select on public.vendedor_solicitacoes;
create policy vendedor_solicitacoes_select
  on public.vendedor_solicitacoes
  for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'matriz')
    or solicitante_id = auth.uid()
    or empresa_id in (select ev.empresa_id from public.empresas_visiveis(auth.uid()) ev)
  );

drop policy if exists vendedor_solicitacoes_update_matriz on public.vendedor_solicitacoes;
create policy vendedor_solicitacoes_update_matriz
  on public.vendedor_solicitacoes
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'matriz'))
  with check (public.has_role(auth.uid(), 'matriz'));

-- Sem policy de insert: só via RPC security definer (bypassa RLS de propósito).

-- ---------- RPC: solicitar_vendedor ----------

create or replace function public.solicitar_vendedor(
  p_nome text,
  p_cpf text default null,
  p_celular text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _empresa uuid;
  _nome text;
  _cpf text;
  _email text;
  _id uuid;
begin
  if _uid is null then
    raise exception 'não autenticado';
  end if;

  if not (
    public.has_role(_uid, 'master')
    or public.has_role(_uid, 'supervisor')
    or public.has_role(_uid, 'franqueado')
  ) then
    raise exception 'Apenas usuários de grupo podem cadastrar vendedores';
  end if;

  _nome := nullif(trim(p_nome), '');
  if _nome is null or char_length(_nome) > 150 then
    raise exception 'Nome inválido';
  end if;

  _cpf := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  if _cpf is not null and char_length(_cpf) <> 11 then
    raise exception 'CPF inválido';
  end if;

  _email := nullif(trim(p_email), '');
  if _email is not null and char_length(_email) > 150 then
    raise exception 'E-mail inválido';
  end if;

  select p.empresa_id into _empresa from public.profiles p where p.id = _uid;

  insert into public.vendedor_solicitacoes (
    nome, cpf, celular, email, solicitante_id, empresa_id, status
  ) values (
    _nome, _cpf, nullif(trim(p_celular), ''), _email, _uid, _empresa, 'pendente'
  )
  returning id into _id;

  return _id;
end;
$$;

revoke all on function public.solicitar_vendedor(text, text, text, text) from public, anon;
grant execute on function public.solicitar_vendedor(text, text, text, text) to authenticated;

-- ---------- RPC: resolver_solicitacao_vendedor ----------

create or replace function public.resolver_solicitacao_vendedor(
  p_id uuid,
  p_aprovar boolean,
  p_observacao text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _obs text;
begin
  if _uid is null then
    raise exception 'não autenticado';
  end if;

  if not public.has_role(_uid, 'matriz') then
    raise exception 'forbidden: apenas a Matriz resolve solicitações';
  end if;

  _obs := nullif(trim(p_observacao), '');
  if _obs is not null and char_length(_obs) > 500 then
    raise exception 'Observação inválida';
  end if;

  update public.vendedor_solicitacoes
     set status = case when p_aprovar then 'aprovada' else 'recusada' end,
         resolved_at = now(),
         resolved_by = _uid,
         observacao = _obs
   where id = p_id
     and status = 'pendente';

  if not found then
    raise exception 'Solicitação não encontrada ou já resolvida';
  end if;
end;
$$;

revoke all on function public.resolver_solicitacao_vendedor(uuid, boolean, text) from public, anon;
grant execute on function public.resolver_solicitacao_vendedor(uuid, boolean, text) to authenticated;
