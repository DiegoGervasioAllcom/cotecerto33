-- ===========================================================================
-- Supervisor de Vendas ganha Acessos e permissões (macessos)
--
-- QA manual (10/08/2026) comparando com o protótipo: desde o H7 o Supervisor
-- é tratado como "time interno da Matriz" e `podeAdministrarAcessos`
-- (src/lib/route-access.ts) já libera admin completo em /operacao/acessos
-- para role='supervisor' — só faltava a área no preset do cargo, então ele
-- era redirecionado para Visão geral ao tentar acessar a tela.
-- ===========================================================================

insert into public.cargo_areas (cargo_id, area_chave) values
  ('sup_vendas', 'macessos')
on conflict do nothing;
