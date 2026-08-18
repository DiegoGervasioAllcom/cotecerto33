-- ===========================================================================
-- Corrige aprovar_acesso: vendedor CLT da Matriz (Convite Supper · vend_matriz)
-- ficava com empresa própria em vez da empresa Matriz
--
-- QA manual (17/08/2026): convidado um vendedor interno "Matriz · Vendedor
-- Matriz (Modelo CLT)" pelo Convite Supper, aprovado o pedido — na tela de
-- Distribuição ele aparecia como um DESTINO de primeiro nível (paralelo a
-- "Matriz CoteCerto"), em vez de aparecer como Vendedor dentro da Matriz.
--
-- Causa: `cadastrar_franquia_admin` (000004) cria, pra QUALQUER trilha, uma
-- linha própria em `empresas` como "pedido pendente" — esse design existente
-- é correto para franquia/master/full, mas nunca foi tratado o merge pós-
-- aprovação pro vendedor interno da Matriz. `aprovar_acesso` (20260810140000)
-- já faz esse merge pro "vendedor de Franquia Full" (empresa_id passa a
-- acompanhar a empresa do superior Full) — replica-se a mesma ideia aqui,
-- identificando o caso pelo convite de origem (`trilha='interno'` e
-- `vinc_tipo='matriz'`, únicos valores que `criar_convite`/000139 emite pro
-- vend_matriz) e redirecionando pra `fn_empresa_matriz()` (fonte única do id
-- da Matriz, já usada nas policies de 20260804120000).
-- ===========================================================================

create or replace function public.aprovar_acesso(
  p_empresa_id uuid, p_perfil public.perfil, p_cargo_id text default null,
  p_areas text[] default null, p_produtos text[] default null,
  p_canais uuid[] default null, p_superior_id uuid default null,
  p_reclassificado boolean default false, p_motivo text default null
) returns void language plpgsql security definer set search_path = public
as $function$
declare
  _uid uuid := auth.uid(); _profile uuid; _bloco text; _vende boolean;
  _modalidade text; _empresa_full uuid; _vend_matriz boolean;
begin
  if not public.fn_pode_aprovar_pedido(_uid, p_empresa_id) then
    raise exception 'Seu acesso não permite aprovar este pedido';
  end if;
  select p.id, mf.modalidade into _profile, _modalidade
    from public.profiles p
    join public.empresas e on e.id = p.empresa_id
    left join public.modelos_franquia mf on mf.id = e.modelo_id
   where p.empresa_id = p_empresa_id limit 1;
  if _profile is null then raise exception 'pedido não tem cadastro de pessoa associado'; end if;
  if p_reclassificado and (p_motivo is null or char_length(trim(p_motivo)) < 3) then
    raise exception 'reclassificar é exceção: informe o motivo';
  end if;
  -- Nesta altura a role definitiva da Full ainda não foi inserida. Validar o
  -- Master candidato diretamente; o constraint trigger diferível valida o
  -- estado completo (Full + empresa + role + Master) ao fim da transação.
  if p_perfil = 'franqueado' and _modalidade = 'full'
     and not exists (
       select 1
         from public.profiles m
         join public.user_roles mr on mr.user_id = m.id and mr.role = 'master'
        where m.id = p_superior_id
          and m.status = 'aprovada'
          and m.desligado_em is null
     ) then
    raise exception 'Franquia Full exige um Master ativo e aprovado';
  end if;
  _vende := p_perfil <> 'master';
  if not _vende and (coalesce(array_length(p_produtos,1),0)>0 or coalesce(array_length(p_canais,1),0)>0) then
    raise exception 'Master franqueado não vende nem recebe leads: não tem produtos nem canais';
  end if;
  if p_cargo_id is not null and p_perfil not in ('matriz','coordenador','supervisor','interno') then
    raise exception 'cargo só se aplica ao time interno da Matriz';
  end if;
  -- V11 · QA 10/08/2026: vendedor cujo superior é uma Franquia Full passa a
  -- compartilhar a empresa dela — o mesmo registro que o Cadastro direto já
  -- usava, e que fn_full_dona_vendedor exige para Ver/Configurar/Excluir.
  if p_perfil = 'vendedor' and p_superior_id is not null then
    select f.empresa_id into _empresa_full
      from public.profiles f
      join public.user_roles fr on fr.user_id = f.id and fr.role = 'franqueado'
      join public.empresas fe on fe.id = f.empresa_id
      join public.modelos_franquia fmf on fmf.id = fe.modelo_id and fmf.modalidade = 'full'
     where f.id = p_superior_id;
  end if;
  -- V11 · QA 17/08/2026: vendedor CLT interno da Matriz (Convite Supper ·
  -- vend_matriz) passa a compartilhar a empresa Matriz, em vez de ficar preso
  -- na empresa "pendente" pessoal criada por cadastrar_franquia_admin — sem
  -- isso ele aparecia como um destino de distribuição próprio, paralelo à
  -- Matriz, e nunca listado como vendedor dela.
  if p_perfil = 'vendedor' and _empresa_full is null then
    select true into _vend_matriz
      from public.convites c
      join public.empresas e on e.convite_id = c.id
     where e.id = p_empresa_id
       and c.trilha = 'interno'
       and c.vinc_tipo = 'matriz'
     limit 1;
    if _vend_matriz then
      select empresa_id into _empresa_full from public.fn_empresa_matriz() limit 1;
    end if;
  end if;
  delete from public.user_roles where user_id = _profile;
  insert into public.user_roles(user_id,role) values (_profile,p_perfil);
  update public.profiles set status='aprovada', aprovada_em=now(), cargo_id=p_cargo_id,
    superior_id=case when p_perfil='franqueado' and _modalidade='full' then p_superior_id else coalesce(p_superior_id,superior_id) end,
    empresa_id=coalesce(_empresa_full, empresa_id)
    where id=_profile;
  delete from public.profile_areas where profile_id=_profile;
  if coalesce(array_length(p_areas,1),0)>0 then
    insert into public.profile_areas(profile_id,area_chave)
    select _profile,a from unnest(p_areas)a where exists(select 1 from public.areas x where x.chave=a) on conflict do nothing;
  end if;
  delete from public.profile_produtos where profile_id=_profile;
  if _vende then
    _bloco := case when p_perfil in ('matriz','coordenador','supervisor','interno') then 'interno' else 'externo' end;
    insert into public.profile_produtos(profile_id,produto_id)
    select _profile,p from unnest(coalesce(nullif(p_produtos,'{}'),array(select public.fn_produtos_padrao(_bloco))))p
    where exists(select 1 from public.produtos x where x.id=p and x.ativo) on conflict do nothing;
    insert into public.profile_produtos(profile_id,produto_id)
    select _profile,id from public.produtos where fixo and ativo on conflict do nothing;
  end if;
  delete from public.profile_canais where profile_id=_profile;
  if _vende and coalesce(array_length(p_canais,1),0)>0 then
    insert into public.profile_canais(profile_id,canal_id)
    select _profile,c from unnest(p_canais)c where exists(select 1 from public.canais x where x.id=c) on conflict do nothing;
  end if;
  update public.empresas set status='aprovada', aprovada_em=now(),
    reclassificado_em=case when p_reclassificado then now() else null end,
    reclassificacao_motivo=case when p_reclassificado then trim(p_motivo) else null end
   where id=p_empresa_id;
end;
$function$;
