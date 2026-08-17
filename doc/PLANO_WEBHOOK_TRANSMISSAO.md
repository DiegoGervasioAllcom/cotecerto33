# Plano — Webhook de resultado da transmissão (robô Quiver)

Base: `doc/TASK-webhook-resultado-transmissao.md`. Decisões do usuário em 17/08/2026
(ver seção "Decisões" no final). Fluxo por onda: planejador → banco/front/testes → revisor
(AGENTS.md).

## Diagnóstico (por que o doc original estava incompleto)

O doc original supunha que o dado de transmissão ficaria em `cotacoes`. Investigação
mostrou que existem **dois fluxos de transmissão hoje, nenhum ligado ao robô**:

1. **Manual** (`venda/aceite.tsx`): trigger `_gerar_proposta_de_premio` cria `propostas`
   (status `gerada`) quando `cotacao_premios.selecionada=true`. Vendedor confere e clica
   "Registrar transmissão" → RPC `transmitir_proposta` (sem falar com o robô).
2. **Automatizado** (`StepCalculo.tsx`, dentro do wizard): botão "gerar proposta" chama
   `transmitirPropostaQuiver` (`quiver.functions.ts:497`), que manda a transmissão real pro
   robô via `POST /transmissao`. **Não cria nem atualiza `propostas`** — só mostra uma
   mensagem estática e para. É aqui que falta o webhook de retorno.

O robô devolve `{ cotacaoId, numeroCotacao, nomeCliente, transmitido, motivo?, mensagem?,
capturadoEm }`. Como é o nosso próprio `transmitirPropostaQuiver` que dispara a chamada e
sempre manda `cotacaoId`, dá pra confiar nele como chave de match — sem precisar da lógica
ambígua de nome/número como fallback nesta primeira versão.

## Decisões do usuário (17/08/2026)

- Webhook **cria/atualiza `propostas`** — a transmissão via robô passa a aparecer nas
  telas que já existem (Aceite & transmissão, Vendas → Transmissão), sem tela nova.
- **Histórico completo** de tentativas — tabela nova `cotacao_transmissoes`, não só o
  último resultado.
- UX: na tela de cálculo (`StepCalculo.tsx`), ao clicar em transmitir um card, os demais
  cards **somem** e fica só o card clicado, num estado de **carregando/aguardando** até o
  webhook responder — sucesso ou falha aparecem ali mesmo. Resultado também precisa
  refletir em Aceite & Transmissão / Vendas → Transmissão.

## Onda 1 — Banco: histórico de tentativas + RPC de resultado ✅ mergeada (PR #181)

| Task | Descrição |
|---|---|
| T.1 | ✅ Migration: tabela `cotacao_transmissoes` (`id`, `cotacao_id` FK, `proposta_id` FK nullable, `seguradora`, `produto_id`, `produto`, `forma_pagamento`, `parcelas`, `premio`, `status` [`enviada`\|`transmitida`\|`falha`], `motivo`, `mensagem`, `numero_cotacao_portal`, `capturado_em`, `criado_em`). RLS: mesma visibilidade herdada via `cotacoes` (padrão de `cotacao_premios`), leitura para `authenticated`, escrita só via `service_role`/RPC `security definer`. |
| T.2 | ✅ Migration: colunas novas em `propostas` — `transmissao_status` (`processando`\|`transmitida`\|`falha`, distinto do `status` de ciclo de vida), `transmissao_motivo`, `transmissao_mensagem`. Não mexe em `transmissao_obs` (segue sendo o campo livre do fluxo manual). |
| T.3 | ✅ RPC `registrar_resultado_transmissao_quiver(p_tentativa_id uuid, p_transmitido bool, p_motivo text, p_mensagem text, p_numero_cotacao text, p_capturado_em timestamptz)`, `security definer`, só para `service_role`: atualiza a tentativa; se `transmitido=true`, garante a `propostas` (cria/atualiza via `on conflict (cotacao_id)`, mesmo índice parcial do trigger existente) com `status='transmitida'`; se `false`, garante `propostas` com `status='gerada'` + `transmissao_status='falha'`/motivo/mensagem. Idempotente (só reprocessa tentativas `status='enviada'`). |
| T.4 | ✅ Testes de banco (`tests/db/webhook-transmissao-quiver.test.ts`): sucesso, falha, idempotência, RLS de select, bloqueio de RPC/insert/update direto para `authenticated`, exceção com tentativa inexistente. |

## Onda 2 — Banco: endpoint webhook de entrada ✅ mergeada (PR #182)

| Task | Descrição |
|---|---|
| T.5 | ✅ `src/lib/quiver-transmissao-webhook.ts`, mesmo modelo de `quiver-webhook.ts`: autentica via `x-client-key`/`x-client-secret` contra `SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_KEY`/`SECRET`; exige `cotacaoId` e `transmitido` (400 se ausentes/tipo errado); localiza a tentativa mais recente com `status='enviada'` para esse `cotacao_id` (404 se não achar — estado esperado, não erro de sistema); chama a RPC T.3. |
| T.6 | ✅ Rota registrada em `src/server.ts` (`/api/webhooks/quiver-transmissao`), ao lado da existente. |
| T.7 | ✅ `.env.example` documentado. |
| T.8 | ✅ 12 testes (`tests/db/quiver-transmissao-webhook.test.ts`): auth (401/500), payload inválido (400), tentativa não encontrada/já processada (404), sucesso/falha end-to-end, seleção da tentativa mais recente com múltiplas em aberto. |

## Onda 3 — Front: disparo e acompanhamento da tentativa ✅ mergeada (PR #183)

| Task | Descrição |
|---|---|
| T.9 | ✅ `transmitirPropostaQuiver` (`quiver.functions.ts`): antes de chamar o robô, insere a linha em `cotacao_transmissoes` (`status='enviada'`) com os dados do card escolhido; devolve `tentativaId` pro front. |
| T.10 | ✅ `StepCalculo.tsx`: ao clicar "gerar proposta" num card, entra em modo "transmitindo" — esconde os outros cards, mostra um painel só do card escolhido com spinner "Aguardando confirmação da seguradora…"; faz polling em `cotacao_transmissoes` a cada 4s até `status != 'enviada'`. Sucesso: confirmação + link pra Aceite & Transmissão. Falha: mensagem real do robô + chip de motivo + botão "Tentar novamente" que volta a mostrar todos os cards. |
| T.11 | ✅ `venda/aceite.tsx` / `operacao/vendas.tsx`: exibem `transmissao_status`/`transmissao_motivo`/`transmissao_mensagem` quando vierem preenchidos — chip "Falha na transmissão automática"/"Falha na transmissão" distinto do fluxo manual "Aguardando transmissão". |

## Onda 4 — Testes de UI/E2E ✅ mergeada (PR #184)

| Task | Descrição |
|---|---|
| T.12 | ✅ `tests/e2e/webhook-transmissao.spec.ts`, 3 cenários: sucesso (polling detecta `transmitida`, mostra link pra Aceite), falha (mensagem real + "Tentar novamente" + reflexo em Aceite & Transmissão), 401 credenciais erradas. Robô real não roda no teste — clique em "gerar proposta" interceptado e respondido com o `tentativaId` de uma linha real em `cotacao_transmissoes`; dali em diante tudo roda de verdade (polling via Supabase + endpoint do webhook real). |

## Pontos em aberto para revisão durante a implementação (não bloqueiam início)

- Nome exato dos `motivo` que o robô envia (`RECUSADA_PELO_PORTAL`, `CAMPOS_PENDENTES`,
  `PRODUTO_INDEFINIDO`, `ERRO_INESPERADO`) — mapear pra mensagens amigáveis na tela ou
  mostrar a `mensagem` crua? Sugestão: mostrar a `mensagem` (já é texto real do robô/portal)
  e usar `motivo` só como chip/categoria.
- `CAMPOS_PENDENTES` pode vir com `opcoesProduto` quando `motivo=PRODUTO_INDEFINIDO` — se
  quisermos que o vendedor resolva isso na hora (escolher o produto certo) sem sair da
  tela, é uma iteração futura; nesta v1 a mensagem aparece, mas resolver isso significa
  reabrir os cards e tentar de novo manualmente.
- Falha na transmissão hoje não distingue "abortada, pode tentar de novo igual" de
  "precisa mudar dado no formulário" — o botão "Tentar novamente" (T.10) cobre os dois
  casos de forma simples por enquanto.

## Estado

- **17/08/2026 — plano concluído.** As 4 ondas (T.1–T.12) foram implementadas, revisadas e
  mergeadas na `main`: [#181](https://github.com/DiegoGervasioAllcom/cotecerto33/pull/181),
  [#182](https://github.com/DiegoGervasioAllcom/cotecerto33/pull/182),
  [#183](https://github.com/DiegoGervasioAllcom/cotecerto33/pull/183),
  [#184](https://github.com/DiegoGervasioAllcom/cotecerto33/pull/184). Branches das 4 ondas
  apagadas local e remotamente após o merge. O CI precisou de um ajuste no meio do caminho
  (job `db-tests` e depois `e2e` não exportavam as credenciais de teste do webhook novo —
  corrigido em `.github/workflows/ci.yml`).
- Os 3 pontos "em aberto" listados acima não bloquearam o fechamento — nenhum é bug, são
  iterações futuras possíveis (mapeamento de `motivo`, resolução de `PRODUTO_INDEFINIDO`
  sem sair da tela, distinção entre falha retomável e falha que exige correção manual).
