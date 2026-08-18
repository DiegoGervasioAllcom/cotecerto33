-- ===========================================================================
-- Cadastro manual · exceção: persiste o `escopo` (interno/externo)
--
-- Bug reportado: um "vendedor CLT" cadastrado pela Matriz via "Cadastro
-- manual · exceção" (escopo=interno) aparecia classificado como "cadastro
-- externo". Causa: `criar_pendente_manual` (20260801182015) nunca recebia
-- nem gravava o `escopo` escolhido na UI — o cadastro nasce sem convite
-- (`empresas.convite_id` fica null de propósito), e `mapPendentes()`
-- (pendentes-query.ts) só sabia derivar o bloco (interno/externo) a partir
-- de `convite.trilha`. Sem convite, sempre caía em "externo".
--
-- O protótipo original (`cotecerto_prototipo_v11.html:7036`, `isInternoPend`)
-- já previa esse caso: `convite.trilha === 'interno' OU escopo === 'interno'`.
-- A implementação real só trouxe metade dessa condição porque faltava onde
-- guardar o `escopo` quando não há convite. Esta migration fecha essa lacuna.
-- ===========================================================================

alter table public.empresas
  add column if not exists escopo_manual text check (escopo_manual in ('interno', 'externo'));

comment on column public.empresas.escopo_manual is
  'Só preenchido pelo cadastro manual · exceção (sem convite): o escopo
   escolhido na UI (interno = time/vendedor CLT da Matriz; externo = franquia/
   vendedor de franquia, sempre PJ). Fallback de bloco em mapPendentes() quando
   não há convite associado.';

-- Assinatura muda (9 → 10 parâmetros): `create or replace` NÃO substitui a
-- versão antiga nesse caso, cria um overload — o mesmo bug corrigido em
-- 20260818000000. Precisa dropar a versão de 9 parâmetros primeiro.
drop function if exists public.criar_pendente_manual(uuid, uuid, text, text, text, text, text, text, text);

create or replace function public.criar_pendente_manual(
  p_user_id uuid,
  p_criado_por uuid,
  p_nome text,
  p_tipo text,
  p_documento text,
  p_email text default null,
  p_celular text default null,
  p_cidade text default null,
  p_uf text default null,
  p_escopo text default 'externo'
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

  if coalesce(p_escopo, '') not in ('interno', 'externo') then
    raise exception 'escopo inválido: %', p_escopo;
  end if;
  -- Vendedor CLT/time interno é sempre PF (a mesma regra que já trava o
  -- formulário em cadastro-manual-modal.tsx) — externo é sempre franquia,
  -- podendo ser PJ ou PF (vendedor autônomo vinculado a um Master).
  if p_escopo = 'interno' and _tipo <> 'pf' then
    raise exception 'escopo interno só aceita pessoa física';
  end if;

  if p_nome is null or length(trim(p_nome)) < 2 then
    raise exception 'nome é obrigatório';
  end if;
  if p_documento is null or length(trim(regexp_replace(p_documento, '\D', '', 'g'))) < 11 then
    raise exception 'documento é obrigatório';
  end if;

  insert into public.empresas (nome, tipo, documento, email, celular, cidade, uf, status, criado_por, escopo_manual)
  values (trim(p_nome), _tipo, trim(p_documento), nullif(p_email, ''), nullif(p_celular, ''),
          nullif(p_cidade, ''), nullif(p_uf, ''), 'pendente', p_criado_por, p_escopo)
  returning id into _empresa_id;

  update public.profiles
     set empresa_id = _empresa_id,
         nome = trim(p_nome)
   where id = p_user_id;

  return _empresa_id;
end;
$function$;

comment on function public.criar_pendente_manual(uuid, uuid, text, text, text, text, text, text, text, text) is
  'V11 C2 (+ fix escopo): cria o pendente do cadastro manual · exceção
   (convite_id fica null de propósito) e liga o profile já criado pelo
   handle_new_user(). Grava p_escopo em empresas.escopo_manual — fallback de
   bloco (interno/externo) quando não há convite. Chamada pelo server function
   depois de admin.auth.admin.createUser — nunca direto do cliente.';

revoke all on function public.criar_pendente_manual(uuid, uuid, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.criar_pendente_manual(uuid, uuid, text, text, text, text, text, text, text, text)
  to service_role;
