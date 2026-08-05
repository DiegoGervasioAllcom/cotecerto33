-- ===========================================================================
-- Unificação de hierarquia: profiles.superior_id passa a ser a única fonte
-- da verdade; empresas.parent_id é removida.
--
-- Achado: `empresas.parent_id` nunca é escrita pelo fluxo real de aprovação
-- (`aprovar_acesso_com_boas_vindas` só grava `profiles.superior_id`, via
-- `p_superior_id`) — confirmado vazio (0 linhas) em qualquer ambiente que só
-- tenha passado por aprovação real. `empresas_visiveis()` já migrou para
-- superior_id desde a G1.2 (16/07). Só sobraram dois consumidores de
-- parent_id, e ambos estavam quebrados/mortos na prática:
--
-- 1) `excluir_cadastro_rede` (C6) contava franquias ativas de um Master via
--    `empresas.parent_id` — como a coluna nunca é populada pela aprovação
--    real, a trava de exclusão NUNCA disparava em produção (só passava nos
--    testes porque os fixtures setavam parent_id manualmente, sem setar
--    superior_id — mascarando o problema). Corrigido pra contar via
--    `profiles.superior_id = p_user_id` (perfil do Master).
-- 2) `enfileirar_boas_vindas` usava `e.parent_id` como fallback pra achar o
--    nome do "responsável" no e-mail de boas-vindas — sempre null na
--    prática, fallback morto. Removido (a cadeia de fallback continua: superior_id
--    → convite.vinc_empresa_id → convidador → primeira Matriz).
--
-- `src/components/operacao/acessos/cadastros-rede-tab.tsx` (contagem de
-- franquias por Master e "dono" de cada franquia na aba Cadastros Rede)
-- também usava parent_id com o mesmo problema — corrigido no mesmo commit
-- desta migration, front e banco juntos.
-- ===========================================================================

-- ---- 1) enfileirar_boas_vindas: remove o fallback morto via e.parent_id ---
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

  select p.id, p.nome, p.email, p.cargo_id, cg.nome, p.superior_id,
         e.nome, e.cidade, e.uf, e.convite_id,
         mf.nome, mf.modalidade
    into _profile_id, _nome, _email, _cargo_id, _cargo, _superior_id,
         _empresa_nome, _cidade, _uf, _convite_id,
         _modelo, _modalidade
    from public.empresas e
    join public.profiles p on p.empresa_id = e.id
    left join public.cargos cg on cg.id = p.cargo_id
    left join public.modelos_franquia mf on mf.id = e.modelo_id
   where e.id = p_empresa_id and e.status = 'aprovada' and p.status = 'aprovada'
   order by p.created_at
   limit 1;

  if _profile_id is null then
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

revoke all on function public.enfileirar_boas_vindas(uuid) from public, anon, authenticated;
grant execute on function public.enfileirar_boas_vindas(uuid) to authenticated;

comment on function public.enfileirar_boas_vindas(uuid) is
  'V11.2.2: cria snapshot tipado de uma das sete boas-vindas, sem persistir link ou token. Fallback de "responsável" via superior_id > convite.vinc_empresa_id > convidador > primeira Matriz (empresas.parent_id removida — G-unif).';

-- ---- 2) excluir_cadastro_rede: trava de exclusão via superior_id ---------
create or replace function public.excluir_cadastro_rede(
  p_user_id uuid,
  p_motivo text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _role public.perfil;
  _empresa_id uuid;
  _franquias_ativas int;
  _vendedores_ativos int;
begin
  if not public.has_role(auth.uid(), 'matriz') then
    raise exception 'permissao negada';
  end if;

  select ur.role, p.empresa_id into _role, _empresa_id
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
   where p.id = p_user_id
     and ur.role in ('master', 'franqueado', 'vendedor')
   limit 1;

  if _role is null then
    raise exception 'Cadastro não encontrado ou fora do escopo desta operação.';
  end if;

  if _role = 'master' then
    select count(*) into _franquias_ativas
      from public.profiles dono
      join public.user_roles ur2 on ur2.user_id = dono.id and ur2.role = 'franqueado'
     where dono.superior_id = p_user_id
       and dono.desligado_em is null;
    if _franquias_ativas > 0 then
      raise exception
        'Este Master tem % franquia(s) ativa(s) vinculada(s) — transfira ou desligue-as antes de excluir.',
        _franquias_ativas;
    end if;
  elsif _role = 'franqueado' then
    select count(*) into _vendedores_ativos
      from public.profiles p2
      join public.user_roles ur2 on ur2.user_id = p2.id and ur2.role = 'vendedor'
     where p2.empresa_id = _empresa_id
       and p2.desligado_em is null;
    if _vendedores_ativos > 0 then
      raise exception
        'Esta franquia tem % vendedor(es) ativo(s) na base — desligue-os antes de excluir.',
        _vendedores_ativos;
    end if;
  end if;

  perform public.admin_set_usuario_status(p_user_id, false, p_motivo);
end;
$function$;

comment on function public.excluir_cadastro_rede(uuid, text) is
  'V11 C6: exclusão (desligamento) de Master/franquia/vendedor da aba Cadastros
   Rede, com trava de dependentes ativos. Vendedor nunca tem dependente — cai
   direto em admin_set_usuario_status. Motivo obrigatório é responsabilidade
   do front (C10 formaliza isso no banco). Franquias do Master contadas via
   profiles.superior_id (empresas.parent_id removida — G-unif, nunca era
   escrita pela aprovação real).';

revoke all on function public.excluir_cadastro_rede(uuid, text) from public, anon;
grant execute on function public.excluir_cadastro_rede(uuid, text) to authenticated;

-- ---- 3) Remove a coluna morta ---------------------------------------------
alter table public.empresas drop column if exists parent_id;
