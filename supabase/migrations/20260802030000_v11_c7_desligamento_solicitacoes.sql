-- ===========================================================================
-- V11 · C7 (Frente 3) — solicitação de desligamento pelo grupo
--
-- Mesmo modelo "pedido → Matriz resolve" de `vendedor_solicitacoes` (G1.6c),
-- mas para o sentido contrário: Master ou Franqueado Full pede o desligamento
-- de alguém da própria rede (vendedor ou franquia); a Matriz aprova ou nega.
--
-- Diferença de `vendedor_solicitacoes`: lá o alvo ainda NÃO existe (por isso
-- guarda nome/cpf/email soltos). Aqui o alvo já é um profile real — por isso
-- `alvo_profile_id` é FK direta, sem duplicar dados que já estão em `profiles`.
--
-- Aprovar EXECUTA o desligamento na mesma transação (chama `excluir_cadastro_rede`,
-- C6) — diferente de `resolver_solicitacao_vendedor`, que só libera o pedido e
-- deixa a criação do usuário para outra tela. Aqui não há passo manual depois:
-- se a trava da C6 disparar (franquia com vendedor ativo, por ex.), a exceção
-- sobe e o pedido continua 'pendente' — a transação inteira desfaz.
-- ===========================================================================

create table if not exists public.desligamento_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  alvo_profile_id uuid not null references public.profiles(id),
  solicitante_id uuid not null references public.profiles(id),
  motivo text not null,
  status text not null default 'pendente',
  observacao text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  constraint desligamento_solicitacoes_motivo_tam
    check (char_length(motivo) > 0 and char_length(motivo) <= 500),
  constraint desligamento_solicitacoes_observacao_tam
    check (observacao is null or char_length(observacao) <= 500),
  constraint desligamento_solicitacoes_status_check
    check (status in ('pendente', 'aprovada', 'recusada'))
);

comment on table public.desligamento_solicitacoes is
  'V11 C7: pedidos de desligamento feitos por Master/Franqueado Full sobre a
   própria rede (vendedor ou franquia). A Matriz resolve; aprovar já executa o
   desligamento via excluir_cadastro_rede (C6), com a mesma trava de dependentes.';

create index if not exists idx_desligamento_solicitacoes_alvo
  on public.desligamento_solicitacoes(alvo_profile_id);
create index if not exists idx_desligamento_solicitacoes_solicitante
  on public.desligamento_solicitacoes(solicitante_id);
create index if not exists idx_desligamento_solicitacoes_status
  on public.desligamento_solicitacoes(status);

alter table public.desligamento_solicitacoes enable row level security;

-- Grants mínimos: nada de insert/update direto, tudo via RPC security definer.
revoke all on public.desligamento_solicitacoes from public, anon, authenticated;
grant select on public.desligamento_solicitacoes to authenticated;
grant all on public.desligamento_solicitacoes to service_role;

drop policy if exists desligamento_solicitacoes_select on public.desligamento_solicitacoes;
create policy desligamento_solicitacoes_select
  on public.desligamento_solicitacoes
  for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'matriz')
    or solicitante_id = auth.uid()
    or exists (
      select 1 from public.profiles p
       where p.id = alvo_profile_id
         and p.empresa_id in (select ev.empresa_id from public.empresas_visiveis(auth.uid()) ev)
    )
  );

drop policy if exists desligamento_solicitacoes_update_matriz on public.desligamento_solicitacoes;
create policy desligamento_solicitacoes_update_matriz
  on public.desligamento_solicitacoes
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'matriz'))
  with check (public.has_role(auth.uid(), 'matriz'));

-- Sem policy de insert: só via RPC security definer (bypassa RLS de propósito).

-- ---------------------------------------------------------------------------
-- RPC: solicitar_desligamento
-- ---------------------------------------------------------------------------
create or replace function public.solicitar_desligamento(
  p_alvo_profile_id uuid,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _motivo text;
  _alvo_role public.perfil;
  _alvo_desligado_em timestamptz;
  _id uuid;
begin
  if _uid is null then
    raise exception 'não autenticado';
  end if;

  if not (public.has_role(_uid, 'master') or public.has_role(_uid, 'franqueado')) then
    raise exception 'Seu acesso não permite solicitar desligamento.';
  end if;

  _motivo := nullif(trim(p_motivo), '');
  if _motivo is null or char_length(_motivo) > 500 then
    raise exception 'Motivo é obrigatório.';
  end if;

  select ur.role, p.desligado_em into _alvo_role, _alvo_desligado_em
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
   where p.id = p_alvo_profile_id
   limit 1;

  if _alvo_role is null or _alvo_role not in ('vendedor', 'franqueado') then
    raise exception 'Só é possível solicitar desligamento de vendedor ou franquia.';
  end if;

  if _alvo_desligado_em is not null then
    raise exception 'Este cadastro já está desligado.';
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_alvo_profile_id
       and p.empresa_id in (select ev.empresa_id from public.empresas_visiveis(_uid) ev)
  ) then
    raise exception 'Este cadastro não está na sua rede.';
  end if;

  insert into public.desligamento_solicitacoes (alvo_profile_id, solicitante_id, motivo)
  values (p_alvo_profile_id, _uid, _motivo)
  returning id into _id;

  return _id;
end;
$$;

revoke all on function public.solicitar_desligamento(uuid, text) from public, anon;
grant execute on function public.solicitar_desligamento(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: resolver_desligamento
-- ---------------------------------------------------------------------------
create or replace function public.resolver_desligamento(
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
  _alvo uuid;
  _motivo text;
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

  select alvo_profile_id, motivo into _alvo, _motivo
    from public.desligamento_solicitacoes
   where id = p_id
     and status = 'pendente';

  if _alvo is null then
    raise exception 'Solicitação não encontrada ou já resolvida';
  end if;

  -- excluir_cadastro_rede já checa a trava de dependentes (C6) e executa o
  -- desligamento; se ela levantar exceção, a transação inteira desfaz e o
  -- pedido continua 'pendente' — a Matriz tenta de novo depois de resolver.
  if p_aprovar then
    perform public.excluir_cadastro_rede(_alvo, _motivo);
  end if;

  update public.desligamento_solicitacoes
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

revoke all on function public.resolver_desligamento(uuid, boolean, text) from public, anon;
grant execute on function public.resolver_desligamento(uuid, boolean, text) to authenticated;
