-- ===========================================================================
-- 043 (G1.2/G1.3) — empresas_visiveis() multinível por hierarquia de pessoas
--
-- Antes: a visibilidade era por empresa (empresas.parent_id, só 1 nível abaixo
-- para o master). Não cobria a cadeia Vendedor de franquia > Franquia >
-- Master/Supervisor > Matriz.
--
-- Agora: a hierarquia mora em profiles.superior_id (criado na 042). Um usuário
-- enxerga as empresas de TODAS as pessoas que reportam a ele (recursivamente,
-- descendo superior_id), incluindo a própria. A Matriz vê tudo.
--
-- As 20 policies RLS que chamam empresas_visiveis() herdam a nova regra sem
-- alteração (nenhuma embute parent_id direto — verificado).
--
-- Guard anti-ciclo: WITH RECURSIVE ... CYCLE evita loop infinito caso a cadeia
-- de superior_id contenha um ciclo (o check da 042 já barra a auto-referência
-- direta A->A; o CYCLE cobre ciclos mais longos A->B->A).
-- ===========================================================================

create or replace function public.empresas_visiveis(_user_id uuid)
  returns table(empresa_id uuid)
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $function$
begin
  -- Matriz enxerga todas as empresas.
  if public.has_role(_user_id, 'matriz') then
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
