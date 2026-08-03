-- ===========================================================================
-- V11 · G6.3 (Frente 6) — dupla aprovação para incluir/remover diretor
--
-- "Diretor é uma marcação no cadastro do usuário [...] são no mínimo dois, e só
-- eles alteram comissionamento e configurações, sempre confirmando a senha do
-- login" (V11.0.5) já cobre a marcação e a trava dos 2 mínimos — mas quem
-- inclui/remove um diretor hoje é update direto no banco. Esta task fecha a
-- V11.6.4 no banco: uma proposta (quem propõe) precisa de uma confirmação de
-- OUTRO diretor (quem confirma) antes da marcação mudar de fato.
--
-- diretor é conceito só de Matriz (fn_eh_diretor não olha empresa_id — ver
-- V11.0.5), então a tabela abaixo também não tem empresa_id: proposta e
-- histórico são globais, igual ao histórico com empresa_id nulo (V11.0.6).
--
-- Fluxo:
--   1) propor_alteracao_diretor  — diretor A propõe (senha de A), status
--      'pendente'. Não grava histórico ainda — a proposta em si não é a
--      alteração real.
--   2) confirmar_alteracao_diretor — diretor B (≠ A) aprova ou rejeita
--      (senha de B). Só na aprovação: aplica profiles.diretor, grava
--      historico_alteracoes (via fn_registrar_alteracao) e marca 'confirmada'.
--      Na rejeição: só marca 'rejeitada', nada muda.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabela
-- ---------------------------------------------------------------------------
create table if not exists public.diretor_propostas (
  id            uuid primary key default gen_random_uuid(),
  alvo_id       uuid not null references public.profiles(id) on delete cascade,
  acao          text not null check (acao in ('incluir', 'remover')),
  proposto_por  uuid not null references public.profiles(id) on delete set null,
  confirmado_por uuid references public.profiles(id) on delete set null,
  status        text not null default 'pendente' check (status in ('pendente', 'confirmada', 'rejeitada')),
  criado_em     timestamptz not null default now(),
  resolvido_em  timestamptz
);

comment on table public.diretor_propostas is
  'V11.6.4/G6.3: dupla aprovação para incluir/remover diretor. Quem confirma
   precisa ser diferente de quem propôs (checado nas RPCs). Escrita só via
   propor_alteracao_diretor/confirmar_alteracao_diretor — sem insert/update/
   delete direto para authenticated.';

create index if not exists idx_diretor_propostas_alvo on public.diretor_propostas(alvo_id);
create index if not exists idx_diretor_propostas_status on public.diretor_propostas(status);

-- Não existe conceito de "pendente duplicado" no banco por unique index parcial
-- porque a checagem de duplicidade também precisa de uma mensagem de erro clara
-- (feita na RPC) — mas o índice ajuda a consulta de "já existe pendente?".
create index if not exists idx_diretor_propostas_alvo_pendente
  on public.diretor_propostas(alvo_id) where status = 'pendente';

-- ---------------------------------------------------------------------------
-- 2) RLS — só diretor lê (diretor é conceito global de Matriz, sem empresa_id);
--    escrita só via RPC.
-- ---------------------------------------------------------------------------
alter table public.diretor_propostas enable row level security;

revoke all on public.diretor_propostas from public, anon, authenticated;
grant select on public.diretor_propostas to authenticated;

revoke all on public.diretor_propostas from service_role;
grant select, insert, update on public.diretor_propostas to service_role;

drop policy if exists diretor_propostas_select_diretor on public.diretor_propostas;
create policy diretor_propostas_select_diretor on public.diretor_propostas
  for select to authenticated
  using (public.fn_eh_diretor(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3) propor_alteracao_diretor
-- ---------------------------------------------------------------------------
create or replace function public.propor_alteracao_diretor(
  p_senha   text,
  p_alvo_id uuid,
  p_acao    text
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _uid uuid := auth.uid();
  _id uuid;
  _restantes int;
  _alvo_existe boolean;
begin
  if not public.fn_confirmar_senha_diretor(p_senha) then
    raise exception 'Seu acesso não permite esse tipo de alteração'
      using hint = 'Propor alteração de diretor exige um diretor confirmando a senha de login.';
  end if;

  if p_acao not in ('incluir', 'remover') then
    raise exception 'Ação inválida: use ''incluir'' ou ''remover''.';
  end if;

  select exists(select 1 from public.profiles where id = p_alvo_id) into _alvo_existe;
  if not _alvo_existe then
    raise exception 'Cadastro alvo não encontrado.';
  end if;

  if exists (
    select 1 from public.diretor_propostas
     where alvo_id = p_alvo_id and status = 'pendente'
  ) then
    raise exception 'Já existe uma proposta pendente para este cadastro.'
      using hint = 'Confirme ou rejeite a proposta existente antes de propor outra.';
  end if;

  if p_acao = 'remover' then
    select count(*) into _restantes
      from public.profiles
     where diretor and id <> p_alvo_id;
    if _restantes < 2 then
      raise exception
        'a proposta deixaria % diretor(es); o mínimo é 2', _restantes
        using hint = 'Marque outro diretor antes de propor a remoção deste.';
    end if;
  end if;

  insert into public.diretor_propostas (alvo_id, acao, proposto_por)
  values (p_alvo_id, p_acao, _uid)
  returning id into _id;

  return _id;
end;
$function$;

comment on function public.propor_alteracao_diretor(text, uuid, text) is
  'V11.6.4/G6.3: diretor A propõe incluir/remover diretor de um alvo. Exige
   senha de A, bloqueia proposta duplicada pendente e revalida o mínimo de 2
   diretores no caso de remoção. Não grava histórico — só a confirmação
   aplica a alteração real.';

revoke all on function public.propor_alteracao_diretor(text, uuid, text) from public, anon;
grant execute on function public.propor_alteracao_diretor(text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) confirmar_alteracao_diretor
-- ---------------------------------------------------------------------------
create or replace function public.confirmar_alteracao_diretor(
  p_senha       text,
  p_proposta_id uuid,
  p_aprovar     boolean
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _uid uuid := auth.uid();
  _proposta public.diretor_propostas;
  _restantes int;
  _alvo_nome text;
  _valor_de boolean;
begin
  if not public.fn_confirmar_senha_diretor(p_senha) then
    raise exception 'Seu acesso não permite esse tipo de alteração'
      using hint = 'Confirmar alteração de diretor exige um diretor confirmando a senha de login.';
  end if;

  select * into _proposta from public.diretor_propostas where id = p_proposta_id;
  if _proposta is null then
    raise exception 'Proposta não encontrada.';
  end if;

  if _proposta.status <> 'pendente' then
    raise exception 'Esta proposta já foi % — não pode ser confirmada de novo.', _proposta.status;
  end if;

  if _proposta.proposto_por = _uid then
    raise exception 'Quem confirma não pode ser quem propôs'
      using hint = 'Peça a outro diretor para confirmar esta proposta.';
  end if;

  if not p_aprovar then
    update public.diretor_propostas
       set status = 'rejeitada', confirmado_por = _uid, resolvido_em = now()
     where id = p_proposta_id;
    return;
  end if;

  -- Reaplica a trava dos 2 mínimos: pode ter passado tempo entre propor e
  -- confirmar (outra remoção pode ter acontecido nesse meio-tempo).
  if _proposta.acao = 'remover' then
    select count(*) into _restantes
      from public.profiles
     where diretor and id <> _proposta.alvo_id;
    if _restantes < 2 then
      raise exception
        'confirmar deixaria % diretor(es); o mínimo é 2', _restantes
        using hint = 'Marque outro diretor antes de confirmar esta remoção.';
    end if;
  end if;

  select coalesce(nome, email, 'Diretor'), diretor into _alvo_nome, _valor_de
    from public.profiles where id = _proposta.alvo_id;

  perform public.fn_registrar_alteracao(
    'Personalização geral',
    'Diretores',
    p_senha,
    jsonb_build_array(jsonb_build_object(
      'campo', format('Diretor · %s', coalesce(_alvo_nome, _proposta.alvo_id::text)),
      'de', coalesce(_valor_de::text, 'false'),
      'para', (_proposta.acao = 'incluir')::text
    )),
    null
  );

  update public.profiles
     set diretor = (_proposta.acao = 'incluir')
   where id = _proposta.alvo_id;

  update public.diretor_propostas
     set status = 'confirmada', confirmado_por = _uid, resolvido_em = now()
   where id = p_proposta_id;
end;
$function$;

comment on function public.confirmar_alteracao_diretor(text, uuid, boolean) is
  'V11.6.4/G6.3: diretor B (≠ quem propôs) confirma ou rejeita a proposta.
   Aprovação aplica profiles.diretor e grava historico_alteracoes na mesma
   transação (via fn_registrar_alteracao); rejeição só marca a proposta. Exige
   senha de B nos dois casos.';

revoke all on function public.confirmar_alteracao_diretor(text, uuid, boolean) from public, anon;
grant execute on function public.confirmar_alteracao_diretor(text, uuid, boolean) to authenticated;
