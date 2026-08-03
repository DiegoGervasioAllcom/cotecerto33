-- ===========================================================================
-- V11 · C2 (Frente 3) — RPC do cadastro manual · exceção
--
-- Substitui o autocadastro espontâneo de `auth.cadastro.tsx`/`cadastrar_franquia`
-- como única porta que nasce sem convite. A diferença central: aqui é sempre a
-- MATRIZ que aciona — o pendente nasce já sabendo quem o criou (`empresas.criado_por`,
-- C1) e a pessoa cadastrada nunca escolhe a própria senha: o `auth.users` nasce com
-- uma senha aleatória descartável, e o e-mail de boas-vindas (já em produção desde o
-- PR #104) é quem entrega o link de "criar senha" depois da aprovação.
--
-- Restrito a matriz/coordenador de propósito: `fn_destino_pedido` já manda todo
-- pendente sem convite para `matriz_rede` (Frente 2, F1) — deixar Master/Full
-- acionarem isto criaria um pendente que ELES não conseguem aprovar, só a Matriz.
-- Isso pertenceria a `acessos.tsx`, não a `xacessos.tsx`.
-- ===========================================================================

create or replace function public.fn_pode_criar_pendente_manual(_uid uuid default auth.uid())
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select public.has_role(_uid, 'matriz') or public.has_role(_uid, 'coordenador');
$function$;

comment on function public.fn_pode_criar_pendente_manual(uuid) is
  'V11 C2: quem pode acionar o cadastro manual · exceção. Só matriz/coordenador —
   todo pendente sem convite roteia para matriz_rede (F1), então só quem aprova
   essa fila pode criar.';

revoke all on function public.fn_pode_criar_pendente_manual(uuid) from public, anon;
grant execute on function public.fn_pode_criar_pendente_manual(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Cria a empresa pendente (o profile já existe — o server function cria o
-- auth.users antes de chamar esta RPC, e o trigger handle_new_user() já
-- insere o profile mínimo). Roda como service_role, por isso recebe
-- p_criado_por explícito em vez de ler auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.criar_pendente_manual(
  p_user_id uuid,
  p_criado_por uuid,
  p_nome text,
  p_tipo text,
  p_documento text,
  p_email text default null,
  p_celular text default null,
  p_cidade text default null,
  p_uf text default null
) returns uuid
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  _empresa_id uuid;
  _tipo public.empresa_tipo;
begin
  if p_user_id is null or p_criado_por is null then
    raise exception 'usuário e responsável pela criação são obrigatórios';
  end if;
  if not public.fn_pode_criar_pendente_manual(p_criado_por) then
    raise exception 'seu acesso não permite criar cadastro manual';
  end if;

  if coalesce(p_tipo, '') not in ('pj', 'pf') then
    raise exception 'tipo inválido: %', p_tipo;
  end if;
  _tipo := p_tipo::public.empresa_tipo;

  if p_nome is null or length(trim(p_nome)) < 2 then
    raise exception 'nome é obrigatório';
  end if;
  if p_documento is null or length(trim(regexp_replace(p_documento, '\D', '', 'g'))) < 11 then
    raise exception 'documento é obrigatório';
  end if;

  insert into public.empresas (nome, tipo, documento, email, celular, cidade, uf, status, criado_por)
  values (trim(p_nome), _tipo, trim(p_documento), nullif(p_email, ''), nullif(p_celular, ''),
          nullif(p_cidade, ''), nullif(p_uf, ''), 'pendente', p_criado_por)
  returning id into _empresa_id;

  update public.profiles
     set empresa_id = _empresa_id,
         nome = trim(p_nome)
   where id = p_user_id;

  return _empresa_id;
end;
$function$;

comment on function public.criar_pendente_manual(uuid, uuid, text, text, text, text, text, text, text) is
  'V11 C2: cria o pendente do cadastro manual · exceção (convite_id fica null de
   propósito) e liga o profile já criado pelo handle_new_user(). Chamada pelo server
   function depois de admin.auth.admin.createUser — nunca direto do cliente.';

revoke all on function public.criar_pendente_manual(uuid, uuid, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.criar_pendente_manual(uuid, uuid, text, text, text, text, text, text, text)
  to service_role;
