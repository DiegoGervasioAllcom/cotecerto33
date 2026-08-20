-- ===========================================================================
-- FIX — vazamento de pipeline entre vendedores da mesma Franquia Full.
--
-- BUG. `leads_select` (20260804120000_v11_i_escopo_interno_matriz.sql, L92-101)
-- tinha:
--   responsavel_id = auth.uid()
--   or empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
--   or has_role(auth.uid(), 'matriz'::perfil)
--   or (has_role(auth.uid(), 'interno'::perfil) and empresa_id in fn_empresa_matriz())
--
-- `empresas_visiveis(_user_id)` (20260806202228), pra qualquer perfil que não
-- seja matriz/coordenador, devolve NO MÍNIMO a própria `profiles.empresa_id`
-- do usuário (base da recursão por `superior_id`). Numa Franquia Full, vários
-- `vendedor` (CLT ou vinculado — ver `classificar-acesso-modal.tsx`,
-- `vendedor_clt`/`vendedor_franquia`) compartilham o MESMO `empresa_id` da
-- franquia (o dono é sempre `franqueado`, nunca `vendedor`). Resultado: o
-- segundo branch (`empresa_id in empresas_visiveis`) já libera geral pra
-- QUALQUER vendedor daquela empresa, tornando o primeiro branch
-- (`responsavel_id = auth.uid()`) redundante — o vendedor via o kanban
-- pessoal (`/venda/pipeline`) e o geral (`/operacao/pipeline-geral`) cheios de
-- leads de colegas que não eram seus.
--
-- Confirmado que isso NÃO é o comportamento intencional: o próprio branch
-- `responsavel_id = auth.uid()` só faz sentido se o branch de empresa não o
-- subsumir para o perfil `vendedor` raso. Confirmado também que nenhum fluxo
-- de distribuição/atendimento depende de SELECT direto em `leads` escopado
-- por empresa para o `vendedor`: `assumir_lead` (20240101000015) é
-- `security definer` e barra explicitamente quem não é `responsavel_id` (a
-- menos que matriz/master) — não passa pela RLS de leitura.
--
-- FIX. Restringe o branch de "toda a empresa" para quem tem papel de GESTÃO
-- (franqueado — dono —, master, supervisor, coordenador; matriz e interno já
-- têm branch próprio, preservados como estavam). `vendedor` raso passa a
-- depender só de `responsavel_id = auth.uid()`.
--
-- ESCOPO. Só `leads_select` — é a única policy deste padrão com evidência
-- concreta de bug relatado (kanban pessoal e geral mostrando leads de
-- colegas). `clientes_select`/`oport_select` (mesmo padrão, desde
-- 20240101000001_init.sql) e `prop_select`/`cot_select` (leitura por toda a
-- empresa, edição só pelo responsável) são leitura-de-equipe DELIBERADA e
-- testada (`tests/db/rls-cotacoes.test.ts` "POSITIVO: colega de empresa LÊ a
-- cotação"; mesmo padrão documentado para propostas) — não são o bug
-- relatado e não foram tocadas aqui.
-- ===========================================================================

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to authenticated using (
  responsavel_id = auth.uid()
  or has_role(auth.uid(), 'matriz'::perfil)
  or (
    not has_role(auth.uid(), 'vendedor'::perfil)
    and empresa_id in (select empresa_id from public.empresas_visiveis(auth.uid()))
  )
  or (
    has_role(auth.uid(), 'interno'::perfil)
    and empresa_id in (select empresa_id from public.fn_empresa_matriz())
  )
);

comment on policy leads_select on public.leads is
  'Vendedor raso só vê o próprio lead (responsavel_id). O branch de "toda a
   empresa" via empresas_visiveis() só vale para quem tem papel de gestão
   (franqueado/master/supervisor/coordenador) — vendedor não tem esse branch,
   senão vazaria pipeline de colegas na mesma Franquia Full (todos com o
   mesmo empresa_id). Matriz e interno mantêm branches próprios, inalterados.';
