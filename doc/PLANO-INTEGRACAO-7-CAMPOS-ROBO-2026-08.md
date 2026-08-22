# Plano — Integração de 7 campos novos do robô Quiver no formulário

> **Fechamento em 22/08/2026.** Front (PR #214) e robô Playwright (PR #29, repo
> separado) mergeados. 3 bugs reais encontrados e corrigidos durante a
> validação ponta-a-ponta contra o portal real da Quiver: enum de leilão
> ("administrativa" → "administrativo"), crash de `preencherPercentualAjuste`
> com `modalidade = "Valor Determinado"`, e a regra 17 anos × reside-que-implica-
> dirigir (agora rejeitada com 422 em vez de falhar no portal). Migrations
> `20260821010000`/`20260824000000` aplicadas em produção em 22/08/2026 (ver
> `docs/RUNBOOK_DEPLOY.md`, §6.6 e §8). Campo `franquia` (órfão, sem UI,
> introduzido por engano durante a implementação) foi removido antes do merge.

Contexto: auditoria em 20/08/2026 cruzando `/venda/novo-lead` (front, este repo) contra o
contrato do robô Playwright (repo separado `/Users/diego.gervasio/Documents/playwright`)
encontrou 7 campos que o portal real da Quiver aceita e o robô já passou a suportar
(validator + page objects + docs atualizados no repo do robô), mas que ainda não são
enviados por `montarPayloadQuiver`. Fora de escopo: `doc/REVISAO-FORM-VS-CONTRATO-ROBO-2026-08.md`
(auditoria anterior, já fechada, sobre outros bloqueadores — RCF, renovação, máscaras R$ etc.).

Fluxo por onda: planejador → front/testes → revisor (AGENTS.md).

## Estado por campo (levantado em 20/08/2026)

| # | Campo robô | Estado no front | Decisão |
|---|---|---|---|
| 1 | `veiculo.historicoLeilao` | Já existe 1:1 (`f.leilao`, enum `LEILAO`), só falta enviar | Sem decisão pendente |
| 2 | `complementares.jovensCondutores` | Existe com granularidade errada (idade texto livre, parentesco mistura reside+relação, tem `nome` que o robô não usa) | Redesenhar os controles (ver Onda 2) |
| 3 | `cobertura.valorDeterminado` | Existe mas desconectado (`f.casco`/`f.cascoValor` nunca é persistido nem enviado) | Reamarrar ao `modalidade` |
| 4 | `cobertura.vidrosFarosRetrovisores` | Boolean liga/desliga; robô quer enum de 4 níveis | **Decisão do usuário (20/08/2026): vira seletor de nível, igual ao robô** — sem perda de informação |
| 5 | `cobertura.pequenosReparos` | Boolean, mapeia limpo | Sem decisão pendente |
| 6 | `cobertura.assistencia24h` | Select com 3 opções (Básica/Intermediária/Premium); robô tem 4 (Não contratada/Básico/Intermediário/Superior) | **Decisão do usuário (20/08/2026): enum do front passa a usar os 4 valores reais do robô** |
| 7 | `cobertura.carroReserva` | Select "Não/7/15/30 dias"; robô só tem 4 níveis, sem dias | **Decisão do usuário (20/08/2026): select passa a oferecer os 4 níveis do robô, removendo a opção por dias** (o portal real nunca ofereceu dias — a opção anterior nunca teria efeito real) |

## Onda 1 — Campos de mapeamento direto (baixo risco)

| Task | Descrição | Arquivo |
|---|---|---|
| I.1 | Enviar `veiculo.historicoLeilao: f.leilao` em `montarPayloadQuiver` | `quiver.functions.ts` |
| I.2 | Enviar `cobertura.pequenosReparos` traduzindo boolean → `"Contratado"`/`"Não contratada"` | `quiver.functions.ts` |

## Onda 2 — Campos que exigem ajuste de enum/UI

| Task | Descrição | Arquivo |
|---|---|---|
| I.3 | `vidrosFarosRetrovisores`: trocar switch boolean por select de 4 níveis (`Não contratada`/`Básico`/`Intermediário`/`Superior`); enviar direto no payload | `StepCoberturas.tsx`, `types.ts`, `quiver.functions.ts` |
| I.4 | `assistencia24h`: trocar as 3 opções atuais pelos 4 valores reais do robô; enviar no payload | `StepCoberturas.tsx`, `enumsQuiver.ts`, `quiver.functions.ts` |
| I.5 | `carroReserva`: trocar select de dias pelos 4 níveis do robô; enviar no payload | `StepCoberturas.tsx`, `enumsQuiver.ts`, `quiver.functions.ts` |
| I.6 | `valorDeterminado`: remover o par legado `casco`/`cascoValor` (nunca enviado, tela órfã) e passar a revelar um campo de valor (R$) quando `modalidade === "Valor Determinado"`; enviar no payload | `StepCoberturas.tsx`, `types.ts`, `cotacaoCoberturas.schema.ts`, `quiver.functions.ts` |

## Onda 3 — Jovens condutores (maior gap)

| Task | Descrição | Arquivo |
|---|---|---|
| I.7 | Redesenhar o formulário por jovem em `StepPerfil.tsx`: trocar `idade` texto livre por seletor categórico (`17 anos`/`Entre 18 e 24 anos`/`25 anos`); separar `parentesco` em `sexo` (Masculino/Feminino/Ambos), `reside` (3 opções sobre morar/dirigir) e `filhoOuFuncionarioPrincipalCondutor` (Sim/Não); `nome` deixa de ser enviado (mantido só como identificador interno da lista, se útil pra UX) | `StepPerfil.tsx`, `types.ts` |
| I.8 | Montar `complementares.jovensCondutores` no payload a partir do novo array, só quando `pessoas17a25 = "Sim"` | `quiver.functions.ts` |

## Onda 4 — Testes

| Task | Descrição |
|---|---|
| T.1 | Testes de schema/unitários (Vitest) para os novos enums e para `montarPayloadQuiver` (garantir que cada campo novo sai no payload no formato certo) |
| T.2 | Integração ponta-a-ponta: ~10 cotações reais via front → robô → portal Quiver real, com placas e escolhas diferentes, cobrindo os 7 campos (incluindo combinações: leilão com histórico, casco por valor determinado vs percentual, jovens condutores com múltiplos itens, carro reserva em cada nível, etc.) |

## Observações

- Os campos 4, 6 e 7 mudam o **enum de UI** — cotações em rascunho já salvas no Supabase com os valores antigos (ex. "Premium", "15 dias") ficam com um valor que não bate mais no novo enum. Não há migração de dados nesta onda (o rascunho é reaberto e o vendedor reseleciona); se isso for um problema, avaliar depois.
- `carroReserva`/`assistencia24h`/`vidrosFarosRetrovisores` não têm código de nível pré-existente no banco (são apenas o texto do enum) — sem migration de schema necessária, só muda o enum de validação/exibição.
