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

## Onda 1 — Banco: histórico de tentativas + RPC de resultado

| Task | Descrição |
|---|---|
| T.1 | Migration: tabela `cotacao_transmissoes` (`id`, `cotacao_id` FK, `proposta_id` FK nullable, `seguradora`, `produto_id`, `produto`, `forma_pagamento`, `parcelas`, `status` [`enviada`\|`transmitida`\|`falha`], `motivo`, `mensagem`, `numero_cotacao_portal`, `capturado_em`, `criado_em`). RLS: mesma visibilidade herdada via `cotacoes` (padrão de `cotacao_premios`), leitura para `authenticated`, escrita só via `service_role`/RPC `security definer`. |
| T.2 | Migration: colunas novas em `propostas` — `transmissao_status` (`processando`\|`transmitida`\|`falha`, distinto do `status` de ciclo de vida), `transmissao_motivo`, `transmissao_mensagem`. Não mexe em `transmissao_obs` (segue sendo o campo livre do fluxo manual). |
| T.3 | RPC `registrar_resultado_transmissao_quiver(p_tentativa_id uuid, p_transmitido bool, p_motivo text, p_mensagem text, p_numero_cotacao text, p_capturado_em timestamptz)`, `security definer`, só para `service_role` (não expor a `authenticated`): atualiza a tentativa; se `transmitido=true`, garante a `propostas` (cria se não existir, reaproveitando o padrão do trigger existente) com `status='transmitida'`, `transmissao_status='transmitida'`, `forma_pagamento`/`premio`/`seguradora` vindos da tentativa; se `false`, garante `propostas` com `status='gerada'` e `transmissao_status='falha'` + motivo/mensagem, pra aparecer em Aceite & Transmissão com o erro visível. |
| T.4 | Testes de banco: RPC nos dois caminhos (sucesso/falha), idempotência (webhook duplicado não duplica proposta), RLS de `cotacao_transmissoes`. |

## Onda 2 — Banco: endpoint webhook de entrada

| Task | Descrição |
|---|---|
| T.5 | `src/lib/quiver-transmissao-webhook.ts`, mesmo modelo de `quiver-webhook.ts`: autentica via `x-client-key`/`x-client-secret` contra novas env vars `SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_KEY`/`SECRET` (distintas das de saída `SELF_QUIVER_TRANSMISSAO_CLIENT_KEY`/`SECRET`, e das do webhook de cotação); exige `cotacaoId` (400 se ausente — sem fallback por nome/número nesta v1); localiza a tentativa mais recente com `status='enviada'` para esse `cotacao_id`; chama a RPC T.3. |
| T.6 | Registrar a rota nova em `src/server.ts` (`/api/webhooks/quiver-transmissao`), ao lado da existente. |
| T.7 | `.env.example`: documentar as env vars novas. |
| T.8 | Testes: auth (401/500), payload inválido (400), sucesso/falha end-to-end contra a RPC. |

## Onda 3 — Front: disparo e acompanhamento da tentativa

| Task | Descrição |
|---|---|
| T.9 | `transmitirPropostaQuiver` (`quiver.functions.ts`): antes de chamar o robô, insere a linha em `cotacao_transmissoes` (`status='enviada'`) com os dados do card escolhido; devolve `tentativaId` pro front (além do `numeroCotacao` que já devolve hoje). |
| T.10 | `StepCalculo.tsx`: ao clicar "gerar proposta" num card, entra em modo "transmitindo" — esconde os outros cards, mostra um painel só do card escolhido com spinner "Aguardando confirmação da seguradora…"; faz polling em `cotacao_transmissoes` (mesmo padrão já usado no polling de `cotacoes.status`) até `status != 'enviada'`. Sucesso: estado de confirmação com link pra Aceite & Transmissão. Falha: mensagem real do robô + botão "Tentar novamente" que volta a mostrar todos os cards. |
| T.11 | `venda/aceite.tsx` / `operacao/vendas.tsx`: exibir `transmissao_status`/`transmissao_motivo`/`transmissao_mensagem` quando vierem preenchidos (chip distinto de "Aguardando transmissão" pra falha automática, ex. "Falha na transmissão — [motivo]"). |

## Onda 4 — Testes de UI/E2E

| Task | Descrição |
|---|---|
| T.12 | E2E: fluxo completo simulando o webhook (sucesso e falha) e conferindo que a UI do StepCalculo e a tela de Aceite refletem o resultado. |

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

- **17/08/2026**: plano criado e decisões de UX/schema fechadas com o usuário. Aguardando
  aprovação para iniciar a Onda 1.
