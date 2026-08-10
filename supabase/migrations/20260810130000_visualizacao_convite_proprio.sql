-- ===========================================================================
-- Visão somente-leitura de "meu próprio convite pendente"
--
-- QA manual (10/08/2026): a seção "Cadastros enviados, aguardando a Matriz"
-- em /operacao/xacessos (Master) sempre renderizava vazia — não por falta de
-- dados, mas porque nenhuma policy de RLS deixa o inviter ver a empresa
-- pendente que ele mesmo convidou. A única exceção hoje é
-- `empresas_fila_da_franquia` (F1), e essa é sobre APROVAR (Full aprova o
-- próprio vendedor), não sobre acompanhar.
--
-- Esta policy é só leitura — quem convidou (`convites.criado_por`) pode ver
-- o status do próprio convite. Não concede aprovação: as RPCs
-- (aprovar_empresa, aprovar_acesso_com_boas_vindas, recusar_empresa)
-- continuam validando has_role(matriz)/has_role(coordenador) ou
-- fn_pode_aprovar_pedido, sem nenhuma mudança aqui.
-- ===========================================================================

-- Matriz/coordenador ficam de fora: eles já veem tudo via `empresas_select`,
-- e não podem "herdar" visibilidade sobre o pendente de uma Full só porque o
-- fixture de teste do F2 (filas-aprovacao-v11.test.ts) usa `criadoPor:
-- matrizId` em qualquer cenário — políticas permissivas se combinam com OR,
-- então sem esta exclusão a regra do F2 (Matriz nunca vê o pendente do
-- vendedor de uma Full) furava por aqui.
drop policy if exists empresas_visualizacao_convite_proprio on public.empresas;
create policy empresas_visualizacao_convite_proprio on public.empresas
  for select to authenticated
  using (
    status = 'pendente'
    and not public.has_role(auth.uid(), 'matriz')
    and not public.has_role(auth.uid(), 'coordenador')
    and exists (
      select 1
        from public.convites cv
       where cv.id = empresas.convite_id
         and cv.criado_por = auth.uid()
    )
  );
