-- 20260806025742 — listagem paginada de franquias com responsável
--
-- Evita transportar centenas de empresa_id em um filtro `profiles?id=in.(...)`.
-- O escopo de rede é resolvido no servidor por empresas_visiveis(auth.uid()).

create or replace function public.listar_franquias_paginada(
  p_limite integer default 50,
  p_offset integer default 0
)
returns table (
  empresa_id uuid,
  nome text,
  cidade text,
  uf text,
  status public.empresa_status,
  perc_comissao_efetiva numeric,
  leads_mes bigint,
  em_aberto bigint,
  perdidos_mes bigint,
  vendas_mes bigint,
  faturamento_mes numeric,
  comissao_mes numeric,
  meta_vendas integer,
  meta_faturamento numeric,
  responsavel_nome text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('matriz', 'coordenador', 'supervisor', 'interno')
  ) then
    raise exception 'A listagem de franquias é exclusiva do time interno'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.fn_areas_do_usuario(auth.uid()) area
    where area.area_chave = 'mfranq'
  ) then
    raise exception 'Seu acesso não inclui a área Franquias'
      using errcode = '42501';
  end if;

  if p_limite is null or p_limite < 1 or p_limite > 200 then
    raise exception 'p_limite deve estar entre 1 e 200'
      using errcode = '22023';
  end if;

  if p_offset is null or p_offset < 0 then
    raise exception 'p_offset deve ser maior ou igual a zero'
      using errcode = '22023';
  end if;

  return query
    with franquias_visiveis as materialized (
      select
        k.empresa_id,
        k.nome,
        k.cidade,
        k.uf,
        k.status,
        k.perc_comissao_efetiva,
        k.leads_mes,
        k.em_aberto,
        k.perdidos_mes,
        k.vendas_mes,
        k.faturamento_mes,
        k.comissao_mes,
        k.meta_vendas,
        k.meta_faturamento,
        responsavel.nome as responsavel_nome
      from public.v_franquia_kpis k
      join public.empresas_visiveis(auth.uid()) visivel
        on visivel.empresa_id = k.empresa_id
      left join lateral (
        select p.nome
        from public.profiles p
        join public.user_roles ur
          on ur.user_id = p.id
         and ur.role = 'franqueado'
        where p.empresa_id = k.empresa_id
          and p.status = 'aprovada'
          and p.desligado_em is null
        order by p.id
        limit 1
      ) responsavel on true
      where k.status <> 'pendente'
    )
    select
      f.empresa_id,
      f.nome,
      f.cidade,
      f.uf,
      f.status,
      f.perc_comissao_efetiva,
      f.leads_mes,
      f.em_aberto,
      f.perdidos_mes,
      f.vendas_mes,
      f.faturamento_mes,
      f.comissao_mes,
      f.meta_vendas,
      f.meta_faturamento,
      f.responsavel_nome,
      count(*) over () as total_count
    from franquias_visiveis f
    order by f.nome, f.empresa_id
    offset p_offset
    limit p_limite;
end;
$$;

comment on function public.listar_franquias_paginada(integer, integer) is
  'Lista franquias visíveis com KPIs e proprietário franqueado em páginas. '
  'Exige perfil interno e área efetiva mfranq; o escopo de dados é derivado de '
  'empresas_visiveis(auth.uid()). Limite máximo de 200 linhas.';

revoke all on function public.listar_franquias_paginada(integer, integer) from public;
revoke all on function public.listar_franquias_paginada(integer, integer) from anon;
grant execute on function public.listar_franquias_paginada(integer, integer) to authenticated;
grant execute on function public.listar_franquias_paginada(integer, integer) to service_role;
