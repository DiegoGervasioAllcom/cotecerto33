-- 041 — fix (mini-S5): RLS de user_roles expunha o role de TODOS os usuários.
--
-- A migration 20240101000002_modelos_metas.sql criou:
--   create policy user_roles_select on public.user_roles for select to authenticated using (true);
-- Como policies permissivas de SELECT se combinam via OR, essa policy por si só já
-- liberava a leitura de user_roles.role de qualquer usuário para qualquer autenticado,
-- independente da policy mais restrita "user_roles select self" do init.sql.
--
-- Correção: aplica à user_roles o MESMO critério de visibilidade já usado em
-- "profiles select self or rede" (init.sql, ~L247-254) — self, matriz (tudo) ou
-- rede visível via empresas_visiveis() (master: própria empresa + filhas).

drop policy if exists user_roles_select on public.user_roles;
drop policy if exists "user_roles select self" on public.user_roles;

create policy "user_roles select self or rede" on public.user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'matriz')
    or exists (
      select 1
      from public.profiles p
      where p.id = user_roles.user_id
        and p.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
    )
  );

comment on policy "user_roles select self or rede" on public.user_roles is
  'Usuário lê o próprio role; matriz lê tudo; demais perfis (master/franqueado/vendedor) leem apenas os roles de usuários da rede visível (empresas_visiveis). Substitui a policy legada "user_roles_select" (using(true)) que expunha o role de todos os usuários a qualquer autenticado — mini-S5.';
