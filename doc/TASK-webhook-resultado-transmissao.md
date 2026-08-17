# Task: endpoint/UI para resultado da transmissão (webhook)

## Contexto

O robô (repo `playwright`) já envia webhook com `{ transmitido, motivo, mensagem }` ao final de cada transmissão pós-venda, tanto em sucesso quanto em falha (`src/api/services/transmissao.service.ts:81-135`, motivo lido de `data/transmissoes/{requestId}.json`).

O front do cotecerto33 **não tem nenhum endpoint dedicado** pra receber esse resultado — só existe `/api/webhooks/quiver` (`src/lib/quiver-webhook.ts`), feito especificamente pro fluxo de **cotação** (espera `cotacaoId` + `cards`, chama a RPC `registrar_premios_quiver`). Se o `WEBHOOK_URL` de transmissão configurado no robô aponta pra essa mesma rota, o payload de transmissão é mal interpretado pela RPC (formato incompatível) ou ignorado.

Objetivo original do usuário: quando a transmissão falhar (ex.: "Preencha o campo Dia de Vencimento das Demais Parcelas", "Transmissão abortada: produto divergente"), o vendedor precisa ver essa mensagem real **no front**, não só no log do robô via SSH.

## O que falta

1. **Decidir onde o resultado aparece pro vendedor** — status na própria tela da cotação? Tela dedicada de transmissões/vendas efetivadas? Notificação?
2. **Migration** pra guardar status/mensagem/motivo da transmissão — provavelmente colunas novas em `cotacoes` (ex.: `transmissao_status`, `transmissao_mensagem`, `transmissao_em`) ou uma tabela nova `cotacao_transmissoes` se precisar de histórico de tentativas.
3. **Endpoint dedicado** (ex.: `/api/webhooks/quiver-transmissao`), autenticado do mesmo jeito que `/api/webhooks/quiver` (`x-client-key`/`x-client-secret`), que recebe `{ transmitido, motivo, mensagem, numeroCotacao ou cotacaoId }` e persiste.
4. **UI** mostrando o resultado — sucesso (protocolo da seguradora) ou falha (mensagem real do erro).

## Não é um fix pontual

Precisa alinhar com o usuário o formato/UX antes de implementar (schema da tabela, onde a tela vive, como o vendedor é notificado).

---
Registrado em 17/08/2026, junto com a investigação de bugs de transmissão no robô (playwright PRs #14, #15, #16).
