-- S-crítica: metas_select estava sem nenhum escopo (using (true)), permitindo que
-- QUALQUER usuário autenticado lesse metas de QUALQUER empresa/vendedor.
-- Corrige para: matriz vê tudo; master vê a própria rede (mesmo critério de
-- metas_admin, ver 20260721150000_s_fix_master_rls_escopo_rede.sql); demais
-- usuários veem apenas a própria meta (escopo='usuario', ref_id=auth.uid()) ou a
-- meta da própria empresa (escopo='empresa', ref_id=empresa_id do próprio profile).

drop policy if exists metas_select on public.metas;
create policy metas_select on public.metas
  for select
  to authenticated
  using (
    has_role(auth.uid(), 'matriz'::perfil)
    or (has_role(auth.uid(), 'master'::perfil) and (
      (escopo = 'empresa' and ref_id in (select empresa_id from public.empresas_visiveis(auth.uid())))
      or (escopo = 'usuario' and ref_id in (
        select id from public.profiles
        where empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
      ))
    ))
    or (escopo = 'usuario' and ref_id = auth.uid())
    or (escopo = 'empresa' and ref_id in (
      select empresa_id from public.profiles where id = auth.uid()
    ))
  );
