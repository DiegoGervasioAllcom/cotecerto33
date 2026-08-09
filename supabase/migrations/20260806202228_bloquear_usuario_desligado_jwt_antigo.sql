-- 20260806202228 — bloqueia JWT antigo de usuário desligado
--
-- O token do GoTrue continua criptograficamente válido depois que o profile é
-- suspenso. Esta migration torna o estado atual do profile parte da autorização
-- no banco: helpers centrais deixam de conceder escopo e o pre-request do
-- PostgREST barra também policies/RPCs legadas baseadas diretamente em auth.uid().

create or replace function public.usuario_ativo(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
      from public.profiles p
     where p.id = _user_id
       and p.status = 'aprovada'
       and p.desligado_em is null
  );
$function$;

comment on function public.usuario_ativo(uuid) is
  'Verdadeiro somente para profile aprovado e sem desligamento. Helper interno de autorização.';

revoke all on function public.usuario_ativo(uuid) from public, anon, authenticated;
grant execute on function public.usuario_ativo(uuid) to service_role;

create or replace function public.usuario_explicitamente_desligado(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
      from public.profiles p
     where p.id = _user_id
       and (
         p.desligado_em is not null
         or p.status in ('recusada', 'suspensa')
       )
  );
$function$;

comment on function public.usuario_explicitamente_desligado(uuid) is
  'Verdadeiro apenas com prova explícita de recusa/suspensão/desligamento. Não bloqueia profile pendente ou ainda ausente durante onboarding.';

revoke all on function public.usuario_explicitamente_desligado(uuid)
  from public, anon, authenticated;
grant execute on function public.usuario_explicitamente_desligado(uuid) to service_role;

create or replace function public.has_role(_user_id uuid, _role public.perfil)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select public.usuario_ativo(_user_id)
     and exists (
       select 1
         from public.user_roles ur
        where ur.user_id = _user_id
          and ur.role = _role
     );
$function$;

comment on function public.has_role(uuid, public.perfil) is
  'Confere role somente quando o profile está aprovado e não foi desligado.';

revoke all on function public.has_role(uuid, public.perfil) from public, anon;
grant execute on function public.has_role(uuid, public.perfil) to authenticated, service_role;

create or replace function public.empresas_visiveis(_user_id uuid)
returns table(empresa_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not public.usuario_ativo(_user_id) then
    return;
  end if;

  if public.has_role(_user_id, 'matriz')
     or public.has_role(_user_id, 'coordenador') then
    return query select e.id from public.empresas e;
    return;
  end if;

  return query
    with recursive subordinados as (
      select p.id, p.empresa_id
        from public.profiles p
       where p.id = _user_id
         and p.status = 'aprovada'
         and p.desligado_em is null
      union all
      select c.id, c.empresa_id
        from public.profiles c
        join subordinados s on c.superior_id = s.id
       where c.status = 'aprovada'
         and c.desligado_em is null
    ) cycle id set is_cycle using path
    select distinct s.empresa_id
      from subordinados s
     where s.empresa_id is not null;
end;
$function$;

comment on function public.empresas_visiveis(uuid) is
  'Empresas visíveis somente para usuário ativo. Matriz/Coordenador: todas; demais: subárvore ativa via superior_id.';

revoke all on function public.empresas_visiveis(uuid) from public, anon;
grant execute on function public.empresas_visiveis(uuid) to authenticated, service_role;

create or replace function public.bloquear_request_usuario_inativo()
returns void
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  -- anon precisa continuar alcançando endpoints públicos; service_role é usado
  -- por jobs e fixtures administrativas e não representa uma sessão de pessoa.
  if auth.role() = 'authenticated'
     and public.usuario_explicitamente_desligado(auth.uid()) then
    raise insufficient_privilege
      using message = 'Acesso desativado. Entre em contato com a Matriz.';
  end if;
end;
$function$;

comment on function public.bloquear_request_usuario_inativo() is
  'Pre-request PostgREST: invalida autorização de JWT antigo assim que o profile deixa de estar ativo.';

revoke all on function public.bloquear_request_usuario_inativo() from public, anon, authenticated, service_role;
-- O PostgREST executa o hook depois de assumir a role do JWT.
grant execute on function public.bloquear_request_usuario_inativo()
  to authenticator, anon, authenticated, service_role;

alter role authenticator
  set pgrst.db_pre_request = 'public.bloquear_request_usuario_inativo';

notify pgrst, 'reload config';
