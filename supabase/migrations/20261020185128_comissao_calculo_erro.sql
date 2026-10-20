-- Falha do cálculo automático pós-aprovação de comissão <20%: gravada pela
-- server function (service role) para o vendedor ver "Recalcular". Sem policy
-- nova: a SELECT existente já cobre as colunas; escrita segue só via service_role.
alter table public.comissao_solicitacoes
  add column if not exists calculo_erro text
    check (calculo_erro is null or char_length(calculo_erro) <= 500),
  add column if not exists calculo_erro_em timestamptz;
