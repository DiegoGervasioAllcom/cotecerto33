-- ===========================================================================
-- Correções vs. o documento "Acesso e visualização" (Fluxos, Lis)
--
-- 1) Supervisor de Vendas: reverte a área `macessos` adicionada em
--    20260810120000. O documento lista o menu dele com 11 itens, SEM
--    "Acessos e permissões" — quem administra Acessos é o Supervisor
--    Operacional ("cuida da fila de entrada e da liberação dos cadastros").
--    A adição anterior foi um engano (inferência sem checar este documento).
--
-- 2) Marketing: a 5ª área do preset era `mkt` — uma área futura ("Marketing",
--    disponivel=false, sem rota) que colidia de nome com o próprio cargo
--    `marketing`, mas é outra coisa. O documento lista o menu de exemplo do
--    Marketing como Visão geral, Leads, Distribuição, Relatórios, Mensagens
--    — a área certa é `mmsgs`, não `mkt`.
-- ===========================================================================

delete from public.cargo_areas
 where cargo_id = 'sup_vendas' and area_chave = 'macessos';

delete from public.cargo_areas
 where cargo_id = 'marketing' and area_chave = 'mkt';

insert into public.cargo_areas (cargo_id, area_chave) values
  ('marketing', 'mmsgs')
on conflict do nothing;
