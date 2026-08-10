-- ===========================================================================
-- Corrige enfileirar_boas_vindas para o vendedor de Franquia Full
--
-- QA manual (10/08/2026): depois da migration anterior (aprovar_acesso passa
-- a reatribuir empresa_id do vendedor para a empresa da Franquia Full),
-- `aprovar_acesso_com_boas_vindas` (usada pelo botão "Liberar acesso") parou
-- de funcionar para esse caso — `enfileirar_boas_vindas` procurava o perfil
-- aprovado por `profiles.empresa_id = empresas.id`, que deixou de bater
-- porque o empresa_id do vendedor agora aponta para a empresa da Full, não
-- para a empresa "pendente" original (empresa_id = p_empresa_id).
--
-- Fallback: quando a busca normal não encontra ninguém, procura pelo
-- `convites.usado_por` — o profile que consumiu o convite deste pedido,
-- que não muda mesmo que o approve reatribua empresa_id depois.
-- ===========================================================================

create or replace function public.enfileirar_boas_vindas(p_empresa_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _profile_id uuid;
  _nome text;
  _email text;
  _role text;
  _cargo text;
  _cargo_id text;
  _areas text[];
  _empresa_nome text;
  _cidade text;
  _uf text;
  _modelo text;
  _modalidade text;
  _convite_id uuid;
  _vinc_tipo text;
  _vinc_empresa_id uuid;
  _invitador uuid;
  _superior_id uuid;
  _responsavel text;
  _payload jsonb;
  _outbox_id uuid;
begin
  if not public.fn_pode_aprovar_pedido(_uid, p_empresa_id) then
    raise exception 'Seu acesso não permite concluir a aprovação deste pedido';
  end if;

  -- Caminho normal: o profile aprovado ainda mora na própria empresa pendente.
  select p.id into _profile_id
    from public.empresas e
    join public.profiles p on p.empresa_id = e.id
   where e.id = p_empresa_id and e.status = 'aprovada' and p.status = 'aprovada'
   order by p.created_at
   limit 1;

  -- V11 · QA 10/08/2026: vendedor de Franquia Full — aprovar_acesso já
  -- reatribuiu empresa_id para a empresa da Full, então a busca acima não
  -- encontra mais nada. Acha pelo convite que originou o pedido.
  if _profile_id is null then
    select cv.usado_por into _profile_id
      from public.empresas e
      join public.convites cv on cv.id = e.convite_id
     where e.id = p_empresa_id;
  end if;

  select p.nome, p.email, p.cargo_id, cg.nome, p.superior_id,
         e.nome, e.cidade, e.uf, e.convite_id,
         mf.nome, mf.modalidade
    into _nome, _email, _cargo_id, _cargo, _superior_id,
         _empresa_nome, _cidade, _uf, _convite_id,
         _modelo, _modalidade
    from public.empresas e
    left join public.profiles p on p.id = _profile_id
    left join public.cargos cg on cg.id = p.cargo_id
    left join public.modelos_franquia mf on mf.id = e.modelo_id
   where e.id = p_empresa_id and e.status = 'aprovada';

  if _profile_id is null
     or (select status from public.profiles where id = _profile_id)
        is distinct from 'aprovada'::empresa_status then
    raise exception 'empresa e usuário precisam estar aprovados antes das boas-vindas';
  end if;
  if _email is null or char_length(trim(_email)) not between 3 and 320
     or trim(_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'usuário aprovado sem e-mail válido';
  end if;

  select ur.role::text into _role
    from public.user_roles ur where ur.user_id = _profile_id
   order by case ur.role::text
     when 'matriz' then 1 when 'coordenador' then 2 when 'supervisor' then 3
     when 'interno' then 4 when 'master' then 5 when 'franqueado' then 6
     when 'vendedor' then 7 else 99 end
   limit 1;
  if _role is null then raise exception 'usuário aprovado sem perfil de acesso'; end if;

  if exists (select 1 from public.profile_areas pa where pa.profile_id = _profile_id) then
    select coalesce(array_agg(a.label order by a.ordem), '{}'::text[]) into _areas
      from public.profile_areas pa join public.areas a on a.chave = pa.area_chave
     where pa.profile_id = _profile_id;
  else
    select coalesce(array_agg(a.label order by a.ordem), '{}'::text[]) into _areas
      from public.cargo_areas ca join public.areas a on a.chave = ca.area_chave
     where ca.cargo_id = _cargo_id;
  end if;

  if _convite_id is not null then
    select c.vinc_tipo, c.vinc_empresa_id, c.criado_por
      into _vinc_tipo, _vinc_empresa_id, _invitador
      from public.convites c where c.id = _convite_id;
  end if;

  select coalesce(
    (select nullif(trim(p.nome), '') from public.profiles p where p.id = _superior_id),
    (select nullif(trim(p.nome), '') from public.profiles p
      where p.empresa_id = _vinc_empresa_id
      order by p.created_at limit 1),
    (select nullif(trim(p.nome), '') from public.profiles p where p.id = _invitador),
    (select nullif(trim(p.nome), '') from public.profiles p
      join public.user_roles ur on ur.user_id = p.id and ur.role = 'matriz'
      order by p.created_at limit 1),
    'Equipe Matriz'
  ) into _responsavel;

  if _role = 'matriz' and _cargo_id is null then
    _payload := jsonb_build_object(
      'nome', _nome, 'variante', 'matriz', 'aprovador', coalesce(
        (select nullif(trim(p.nome), '') from public.profiles p where p.id = _uid),
        'Equipe Matriz'));
  elsif _role = 'supervisor' then
    _payload := jsonb_build_object(
      'nome', _nome, 'variante', 'supervisor',
      'tipo_supervisor', case when coalesce(_cargo, '') ~* '(vendas|comercial)' then 'Vendas' else 'Operacional' end,
      'areas', to_jsonb(coalesce(_areas, '{}'::text[])));
  elsif _role in ('interno', 'coordenador', 'matriz') and _cargo_id is not null then
    _payload := jsonb_build_object(
      'nome', _nome, 'variante', 'cargo', 'cargo', _cargo,
      'areas', to_jsonb(coalesce(_areas, '{}'::text[])),
      'janela', 'Todos os dias, sem restrição de horário');
  elsif _role = 'master' then
    _payload := jsonb_build_object(
      'nome', _nome, 'variante', 'master', 'grupo', _empresa_nome,
      'regiao', case
        when nullif(trim(coalesce(_cidade, '')), '') is not null and nullif(trim(coalesce(_uf, '')), '') is not null
          then trim(_cidade) || '/' || upper(trim(_uf))
        when nullif(trim(coalesce(_cidade, '')), '') is not null then trim(_cidade)
        when nullif(trim(coalesce(_uf, '')), '') is not null then upper(trim(_uf))
        else 'não informada' end);
  elsif _role = 'franqueado' and _modalidade = 'full' then
    _payload := jsonb_build_object(
      'nome', _nome, 'variante', 'franquia_full', 'franquia', _empresa_nome,
      'cidade_uf', case
        when nullif(trim(coalesce(_cidade, '')), '') is not null and nullif(trim(coalesce(_uf, '')), '') is not null
          then trim(_cidade) || '/' || upper(trim(_uf))
        when nullif(trim(coalesce(_cidade, '')), '') is not null then trim(_cidade)
        when nullif(trim(coalesce(_uf, '')), '') is not null then upper(trim(_uf))
        else 'não informada' end);
  elsif _role = 'franqueado' then
    if _modelo not in ('Smart', 'Conecta', 'Light', 'Link', 'Flex') then
      raise exception 'modelo individual sem nome oficial de boas-vindas';
    end if;
    _payload := jsonb_build_object(
      'nome', _nome, 'variante', 'franquia_individual',
      'modelo', _modelo, 'responsavel', _responsavel);
  elsif _role = 'vendedor' then
    _payload := jsonb_build_object(
      'nome', _nome, 'variante', 'vendedor',
      'origem', case _vinc_tipo when 'full' then 'Full' when 'master' then 'Master' else 'Matriz' end,
      'responsavel', _responsavel);
  else
    raise exception 'perfil sem variante de boas-vindas: %', _role;
  end if;

  insert into public.email_outbox (empresa_id, tipo, destinatario, payload, criado_por)
  values (p_empresa_id, 'boas_vindas', lower(trim(_email)), _payload, _uid)
  on conflict (empresa_id) where tipo = 'boas_vindas' do nothing
  returning id into _outbox_id;

  if _outbox_id is null then
    select eo.id into _outbox_id from public.email_outbox eo
     where eo.empresa_id = p_empresa_id and eo.tipo = 'boas_vindas';
  end if;
  return _outbox_id;
end
$$;
