-- ===========================================================================
-- V11.0.5 (item 6 do Handoff) — marcação de diretor e trava real no servidor
--
-- Fluxo "Acesso e visualização": "Diretor é uma marcação no cadastro do usuário
-- — não é cargo do organograma. São no mínimo dois, e só eles alteram
-- comissionamento e configurações, sempre confirmando a senha do login."
--
-- Handoff item 6: "alteração de política sem credencial de diretor é rejeitada
-- no BACKEND, não só na tela" — o protótipo aceita demo1234; aqui a senha
-- conferida é a de login do próprio diretor.
--
-- Como a senha é verificada sem sair do banco: o GoTrue guarda bcrypt em
-- auth.users.encrypted_password, então `encrypted_password = crypt(senha,
-- encrypted_password)` confere sem round-trip na API de auth. A função é
-- security definer porque auth.users não é legível pelo papel `authenticated`.
--
-- Escopo desta task: a marcação, o mínimo de 2, a verificação de senha e a
-- ÚNICA porta de escrita do histórico. A dupla aprovação para incluir/remover
-- diretor é a V11.6.4; os 9 botões "Salvar política" são a V11.6.1.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) A marcação
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists diretor boolean not null default false;

comment on column public.profiles.diretor is
  'V11.0.5: marcação de diretor (não é cargo — ver cargo_id). Só diretor altera
   política de comissionamento/configuração, e sempre confirmando a senha de
   login. Mínimo de 2 garantido por trigger.';

create index if not exists idx_profiles_diretor
  on public.profiles(diretor) where diretor;

-- ---------------------------------------------------------------------------
-- 2) O sistema impede ficar com menos de 2 diretores
--
-- Só dispara na REMOÇÃO e só quando já havia 2 ou mais — senão a carga inicial
-- (que começa em zero) seria impossível.
-- ---------------------------------------------------------------------------
create or replace function public.fn_minimo_dois_diretores()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  _restantes int;
begin
  if tg_op = 'UPDATE' and old.diretor and not new.diretor then
    select count(*) into _restantes
      from public.profiles
     where diretor and id <> old.id;
    if _restantes < 2 then
      raise exception
        'a operação deixaria % diretor(es); o mínimo é 2', _restantes
        using hint = 'Marque outro diretor antes de remover este.';
    end if;
  end if;

  if tg_op = 'DELETE' and old.diretor then
    select count(*) into _restantes
      from public.profiles
     where diretor and id <> old.id;
    if _restantes < 2 then
      raise exception
        'excluir este cadastro deixaria % diretor(es); o mínimo é 2', _restantes
        using hint = 'Marque outro diretor antes de excluir este.';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

comment on function public.fn_minimo_dois_diretores() is
  'V11.0.5: impede a rede ficar com menos de 2 diretores. Só age na remoção e
   somente quando já existiam 2+, para não travar a carga inicial.';

drop trigger if exists trg_minimo_dois_diretores on public.profiles;
create trigger trg_minimo_dois_diretores
  before update or delete on public.profiles
  for each row execute function public.fn_minimo_dois_diretores();

-- ---------------------------------------------------------------------------
-- 3) Consultas de diretor
-- ---------------------------------------------------------------------------
create or replace function public.fn_eh_diretor(_user_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select coalesce((select p.diretor from public.profiles p where p.id = _user_id), false);
$function$;

comment on function public.fn_eh_diretor(uuid) is
  'V11.0.5: true se o usuário tem a marcação de diretor.';

revoke all on function public.fn_eh_diretor(uuid) from public, anon;
grant execute on function public.fn_eh_diretor(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) A trava: diretor + senha de login, conferidos no servidor
-- ---------------------------------------------------------------------------
create or replace function public.fn_confirmar_senha_diretor(_senha text)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $function$
declare
  _uid  uuid := auth.uid();
  _hash text;
begin
  if _uid is null then
    return false;
  end if;

  -- Não é diretor: nem chega a conferir senha.
  if not public.fn_eh_diretor(_uid) then
    return false;
  end if;

  select u.encrypted_password into _hash from auth.users u where u.id = _uid;
  if _hash is null or _senha is null or _senha = '' then
    return false;
  end if;

  -- bcrypt do GoTrue: comparar o hash com o crypt da senha usando o próprio
  -- hash como salt. pgcrypto vive no schema `extensions` nesta instalação.
  return _hash = extensions.crypt(_senha, _hash);
end;
$function$;

comment on function public.fn_confirmar_senha_diretor(text) is
  'V11.0.5 (Handoff 6): confere que quem chama é diretor E que a senha é a de
   login dele, contra o bcrypt de auth.users. Roda no servidor — a tela não
   decide nada. False para não-diretor, senha errada ou não autenticado.';

revoke all on function public.fn_confirmar_senha_diretor(text) from public, anon;
grant execute on function public.fn_confirmar_senha_diretor(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) A única porta de escrita do histórico
--
-- `authenticated` não tem INSERT em historico_alteracoes (V11.0.6). Toda linha
-- entra por aqui, e só entra com diretor + senha conferidos. Como PostgREST
-- executa cada RPC numa transação, uma RPC de política que chame esta função
-- grava a regra e a auditoria atomicamente: ou as duas, ou nenhuma.
-- ---------------------------------------------------------------------------
create or replace function public.fn_registrar_alteracao(
  _area       text,
  _o_que      text,
  _senha      text,
  _de_para    jsonb default null,
  _empresa_id uuid default null
) returns uuid
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  _uid  uuid := auth.uid();
  _nome text;
  _id   uuid;
begin
  if not public.fn_confirmar_senha_diretor(_senha) then
    -- Mesma mensagem do protótipo r40, para a tela não inventar texto próprio.
    raise exception 'Seu acesso não permite esse tipo de alteração'
      using hint = 'Alterar política exige um diretor confirmando a senha de login.';
  end if;

  select coalesce(p.nome, p.email, 'Diretor') into _nome
    from public.profiles p where p.id = _uid;

  insert into public.historico_alteracoes
    (autor_id, autor_nome, area, o_que, de_para, empresa_id)
  values
    (_uid, coalesce(_nome, 'Diretor') || ' (diretor)', _area, _o_que, _de_para, _empresa_id)
  returning id into _id;

  return _id;
end;
$function$;

comment on function public.fn_registrar_alteracao(text, text, text, jsonb, uuid) is
  'V11.0.5+V11.0.6: única porta de escrita do histórico imutável. Exige diretor
   com senha; grava autor, área, o que mudou e o DE/PARA. Chamada de dentro das
   RPCs de política, para regra e auditoria caírem na mesma transação.';

revoke all on function public.fn_registrar_alteracao(text, text, text, jsonb, uuid)
  from public, anon;
grant execute on function public.fn_registrar_alteracao(text, text, text, jsonb, uuid)
  to authenticated;
