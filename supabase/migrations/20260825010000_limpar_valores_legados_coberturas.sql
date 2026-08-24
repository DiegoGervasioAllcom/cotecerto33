-- ===========================================================================
-- Limpa valores legados de cotacao_coberturas.assist_24/carro_reserva
-- (25/08/2026)
--
-- Esses dois campos viraram um enum estrito de 4 níveis ("Não contratada",
-- "Básico", "Intermediário", "Superior") para bater com o contrato real da
-- Quiver — ver comentário em src/components/venda/novo-lead/enumsCoberturas.ts.
-- Cotações criadas ANTES dessa mudança guardaram valores de selects
-- anteriores, nunca migrados: assist_24 com "Básica"/"Intermediária" (de um
-- select antigo "Básica/Intermediária/Premium") e carro_reserva com "7 dias"
-- (de um select antigo "Não/7/15/30 dias").
--
-- Esses valores são "truthy" e passavam direto pro payload da Quiver sem
-- cair em nenhum fallback — a Quiver rejeitava a cotação inteira com
-- "Campo cobertura.assistencia24h/carroReserva deve ser um dos valores:
-- ...". Reproduzido em produção com a cotação e10818ee-2c9e-4b12-bfc3-
-- fb828494b822 (assist_24='Básica', carro_reserva='7 dias').
--
-- Decisão de produto: zerar para "Não contratada" em vez de tentar mapear
-- pro nível equivalente novo — mais simples e previsível do que adivinhar
-- a que nível novo cada duração/adjetivo antigo corresponderia.
--
-- Escopado por NOT IN da lista válida (não por uma lista fixa dos valores
-- legados conhecidos hoje), para também limpar qualquer outra variação
-- legada que apareça no futuro sem precisar de nova migration.
-- ===========================================================================

update public.cotacao_coberturas
   set assist_24 = 'Não contratada'
 where assist_24 is not null
   and assist_24 <> ''
   and assist_24 not in ('Não contratada', 'Básico', 'Intermediário', 'Superior');

update public.cotacao_coberturas
   set carro_reserva = 'Não contratada'
 where carro_reserva is not null
   and carro_reserva <> ''
   and carro_reserva not in ('Não contratada', 'Básico', 'Intermediário', 'Superior');
