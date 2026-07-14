-- S1: views que ignoravam a RLS de quem consulta + escopo de leitura de comissões por rede.
--
-- Problema: views criadas sem `security_invoker` rodam com o privilégio do DONO (owner) da
-- view, não do usuário que consulta — na prática isso ignora toda a RLS das tabelas-base.
-- As 4 views abaixo (vendedor_conta_corrente_saldo, v_franquia_kpis, v_vendedor_kpis,
-- v_user_presence) sempre devolviam TODAS as linhas para qualquer autenticado, mesmo que a
-- RLS da tabela por trás fosse restrita.
--
-- Além disso, a policy de SELECT de `comissao_lancamentos` ("cc lanc select") liberava
-- master/franqueado para ler lançamentos de comissão de QUALQUER rede (matriz, master e
-- franqueado tinham acesso irrestrito). Com (1)+(2) abaixo, a view
-- `vendedor_conta_corrente_saldo` fecha 100%: ela roda como invoker e a tabela-base já vem
-- escopada por rede, então não sobra resíduo cross-rede.
--
-- Mesmo critério já usado em "user_roles select self or rede"
-- (20260714164737_fix_user_roles_select_rede.sql) e em "profiles select self or rede"
-- (init.sql, ~L247-254): self, matriz (tudo) ou rede visível via empresas_visiveis()
-- (master: própria empresa + filhas).
--
-- Escrita (INSERT/UPDATE/DELETE) de comissao_lancamentos NÃO é tocada aqui — isso é escopo
-- do S3 (alçada de valores/aprovação), não deste fix de leitura.

-- ============================================================
-- 1) security_invoker nas 4 views que hoje rodam como o dono
-- ============================================================
alter view public.vendedor_conta_corrente_saldo set (security_invoker = true);
alter view public.v_franquia_kpis              set (security_invoker = true);
alter view public.v_vendedor_kpis              set (security_invoker = true);
alter view public.v_user_presence              set (security_invoker = true);

-- ============================================================
-- 2) user_presence: policy de SELECT escopada por rede
--    (antes: "presence read all auth" using (true) — qualquer autenticado lia o
--    status de todos os usuários, de qualquer rede)
-- ============================================================
drop policy if exists "presence read all auth" on public.user_presence;
create policy "presence read self or rede" on public.user_presence
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'matriz')
    or exists (
      select 1
      from public.profiles p
      where p.id = user_presence.user_id
        and p.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
    )
  );

comment on policy "presence read self or rede" on public.user_presence is
  'Usuário lê a própria presença; matriz lê de todos; master/franqueado/vendedor leem apenas a presença de usuários da rede visível (empresas_visiveis). Substitui "presence read all auth" (using(true)) — S1.';

-- ============================================================
-- 3) comissao_lancamentos: policy de SELECT escopada por rede
--    (antes: "cc lanc select" liberava master/franqueado para ler lançamentos de
--    QUALQUER rede via has_role(master)/has_role(franqueado) — cross-tenant)
-- ============================================================
drop policy if exists "cc lanc select" on public.comissao_lancamentos;
create policy "cc lanc select self or rede" on public.comissao_lancamentos
  for select to authenticated
  using (
    vendedor_id = auth.uid()
    or public.has_role(auth.uid(), 'matriz')
    or exists (
      select 1
      from public.profiles p
      where p.id = comissao_lancamentos.vendedor_id
        and p.empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
    )
  );

comment on policy "cc lanc select self or rede" on public.comissao_lancamentos is
  'Vendedor lê os próprios lançamentos; matriz lê de todos; master/franqueado leem apenas lançamentos de vendedores da rede visível (empresas_visiveis). Substitui "cc lanc select" que liberava has_role(master)/has_role(franqueado) irrestrito (cross-rede) — S1. INSERT/UPDATE/DELETE ficam para o S3.';
