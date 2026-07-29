-- ===========================================================================
-- H5 (V11 · hierarquia) — a cadeia passa pelo Coordenador Comercial
--
-- Fluxo "Hierarquia": "cada Master responde ao Coordenador Comercial, ficando no
-- mesmo nível dos dois supervisores. Quem faz essa associação é a Matriz, no
-- momento da aprovação do cadastro."
--
-- Duas partes:
--
--   1) VISIBILIDADE. empresas_visiveis() já era agnóstica de rótulo — desce
--      profiles.superior_id recursivamente (g1_2). Então inserir o Coordenador
--      acima dos Masters não exige mudança estrutural nenhuma: a subárvore dele
--      passa a conter a rede toda automaticamente.
--      O que MUDA aqui é só o alcance total: os Fluxos dizem que o Coordenador
--      "enxerga tudo o que a Matriz enxerga" — a diferença entre os dois é ele
--      não ser diretor, não o que vê. Por isso ele entra no mesmo braço curto da
--      Matriz. É um alargamento consciente de acesso a dados, com teste em H9.
--
--   2) BACKFILL. Defensivo de propósito: só repontamos Masters quando existe
--      EXATAMENTE UM coordenador. Com zero (caso de agora — o seed cria apenas o
--      admin matriz) ou com vários, não há escolha óbvia e a associação é feita
--      na tela de Acessos (V11.2.7, seletor de supervisão). Repontar no escuro
--      é justamente como se perde a visibilidade da rede do Master — o bug que a
--      20260721150000_s_fix_master_rls_escopo_rede.sql corrigiu.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) empresas_visiveis(): Coordenador enxerga tudo, como a Matriz
-- ---------------------------------------------------------------------------
create or replace function public.empresas_visiveis(_user_id uuid)
  returns table(empresa_id uuid)
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $function$
begin
  -- Matriz e Coordenador Comercial enxergam todas as empresas (V11: "enxerga
  -- tudo o que a Matriz enxerga; a diferença é não ser diretor").
  if public.has_role(_user_id, 'matriz')
     or public.has_role(_user_id, 'coordenador') then
    return query select e.id from public.empresas e;
    return;
  end if;

  -- Demais: empresas de todos os profiles na subárvore que reporta a _user_id
  -- (inclui o próprio), descendo por superior_id.
  return query
    with recursive subordinados as (
      select p.id, p.empresa_id
        from public.profiles p
       where p.id = _user_id
      union all
      select c.id, c.empresa_id
        from public.profiles c
        join subordinados s on c.superior_id = s.id
    ) cycle id set is_cycle using path
    select distinct s.empresa_id
      from subordinados s
     where s.empresa_id is not null;
end;
$function$;

comment on function public.empresas_visiveis(uuid) is
  'Empresas visíveis ao usuário. Matriz e Coordenador: todas. Demais: a subárvore
   que reporta a ele via profiles.superior_id (guard anti-ciclo com CYCLE).';

-- ---------------------------------------------------------------------------
-- 2) Backfill dos Masters — só com exatamente um coordenador
-- ---------------------------------------------------------------------------
do $$
declare
  _coord_id uuid;
  _qtd_coord int;
  _repontados int;
begin
  select count(*) into _qtd_coord
    from public.user_roles
   where role = 'coordenador';

  if _qtd_coord <> 1 then
    raise notice
      'H5: backfill dos Masters ignorado — % coordenador(es) encontrado(s). '
      'A associação Master->Coordenador é feita na tela de Acessos (V11.2.7).',
      _qtd_coord;
    return;
  end if;

  select user_id into _coord_id
    from public.user_roles
   where role = 'coordenador'
   limit 1;

  -- Reponta só quem está no topo (superior_id null) ou aponta direto para uma
  -- pessoa da Matriz. Master já vinculado a outra pessoa não é tocado.
  with masters as (
    select p.id
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id and ur.role = 'master'
     where p.id <> _coord_id
       and (
         p.superior_id is null
         or exists (
           select 1 from public.user_roles sup
            where sup.user_id = p.superior_id and sup.role = 'matriz'
         )
       )
  )
  update public.profiles p
     set superior_id = _coord_id
    from masters m
   where p.id = m.id;

  get diagnostics _repontados = row_count;
  raise notice 'H5: % Master(s) repontado(s) para o Coordenador %.',
    _repontados, _coord_id;
end$$;
