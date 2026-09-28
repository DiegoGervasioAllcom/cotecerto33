import { test, expect, type Page } from "@playwright/test";
import { confirmarDadosComplementaresTransmissao, loginAs } from "./helpers";
import {
  criarCotacaoTransmissaoFixture,
  limparCotacaoTransmissaoFixture,
  criarTentativaTransmissaoEnviada,
  QUIVER_WEBHOOK_HEADERS,
  QUIVER_TRANSMISSAO_WEBHOOK_HEADERS,
  type CotacaoQuiverFixture,
} from "./provision";

/**
 * E2E do webhook de resultado da transmissão automatizada (Onda 4 / T.12 do
 * `doc/PLANO_WEBHOOK_TRANSMISSAO.md`): confirma que a Etapa 7 (Transmissão) do
 * wizard — mini-wizard de sub-passos Dados complementares → Confirmação →
 * Transmitida (`StepTransmissao.tsx`) — entra em modo "transmitindo" ao
 * confirmar a transmissão, reage ao webhook `POST
 * /api/webhooks/quiver-transmissao` (sucesso e falha) via polling, e que a
 * tela de Em finalização reflete uma falha automática.
 *
 * Decisão de escopo (mesma lógica de `quiver-webhook.spec.ts`/`venda.spec.ts`):
 * o robô real (`transmitirPropostaQuiver` → serviço `cotacao-api`, que abre um
 * worker Playwright contra o portal de verdade da seguradora) não pode rodar
 * dentro deste teste — seria lento, flaky e dependente de credenciais/ambiente
 * externos. Por isso:
 * - a cotação chega a "calculada" via o MESMO truque já usado no webhook de
 *   cotação: `criarCotacaoTransmissaoFixture` (fixture direto no banco) +
 *   `POST /api/webhooks/quiver` simulando o retorno com prêmios;
 * - o clique em "Gerar proposta" é interceptado via `page.route` (mesma
 *   técnica de `quiver-webhook.spec.ts`/`venda.spec.ts`) ANTES de chegar no
 *   servidor, e respondido com o `tentativaId` de uma linha real inserida
 *   direto em `cotacao_transmissoes` (via `criarTentativaTransmissaoEnviada`,
 *   espelhando exatamente o insert que `transmitirPropostaQuiver` faria) —
 *   assim o polling da UI (Supabase real, sem mock) e o webhook de resultado
 *   (endpoint real do servidor) são testados de ponta a ponta de verdade.
 */

const CARD_ALFA = {
  index: 10,
  seguradora: "Seguradora Alfa",
  produto: "Auto Completo",
  nome: "Plano Premium",
  opcoes: [
    {
      tipo: "Compreensiva",
      franquia: "Reduzida · R$ 2.450,00",
      avista: "R$ 2.345,67",
      parcelas: "10x de R$ 251,90",
    },
  ],
  formaPagamento: "Boleto",
  coberturasBasicas: { Casco: "100% FIPE" },
};

const CARD_BETA = {
  index: 20,
  seguradora: "Seguradora Beta",
  produto: "Auto Flex",
  nome: "Plano Flexível",
  opcoes: [
    {
      tipo: "Compreensiva Plus",
      franquia: "Majorada · R$ 4.000,00",
      avista: "R$ 3.010,05",
      parcelas: "12x de R$ 275,40",
    },
  ],
  formaPagamento: "Cartão",
  coberturasBasicas: { Casco: "110% FIPE" },
};

// Ajustes pós-deploy V12 (item 2): produto só parcelado (sem preço à vista) —
// base do prêmio = nº de parcelas × valor da parcela (nunca o valor de 1
// parcela isolada, ver `calcularPremioTransmissao`/`fn_premio_total_de_parcelas`).
const CARD_SO_PARCELADO = {
  index: 30,
  seguradora: "Seguradora Suhai E2E",
  produto: "Roubo e Furto c/ Assistência",
  nome: "Plano Básico",
  opcoes: [
    {
      tipo: "Roubo e furto",
      franquia: "Sem franquia",
      parcelas: "em 12x de R$ 463,20",
    },
  ],
  formaPagamento: "Boleto",
  coberturasBasicas: { Casco: "Roubo e furto" },
};

/** Cria a fixture já calculada (webhook de cotação) e abre o Passo 6 logado. */
async function prepararCotacaoCalculada(page: Page): Promise<CotacaoQuiverFixture> {
  const fixture = await criarCotacaoTransmissaoFixture();

  const res = await page.request.post("/api/webhooks/quiver", {
    headers: QUIVER_WEBHOOK_HEADERS,
    data: { cotacaoId: fixture.cotacaoId, temPremios: true, cards: [CARD_ALFA, CARD_BETA] },
  });
  expect(res.ok()).toBeTruthy();

  await loginAs(page, fixture.email, fixture.senha);
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
  await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
  await expect(page.getByText(/compare, personalize e escolha a seguradora/i)).toBeVisible({
    timeout: 10_000,
  });

  return fixture;
}

/**
 * Clica em "gerar proposta" no card da Alfa, interceptando a chamada ao
 * servidor (que chamaria o robô de verdade) e devolvendo o `tentativaId` de
 * uma linha `cotacao_transmissoes` real já inserida com `status='enviada'`.
 */
async function gerarPropostaComTentativaReal(page: Page, fixture: CotacaoQuiverFixture) {
  const tentativaId = await criarTentativaTransmissaoEnviada({
    cotacaoId: fixture.cotacaoId,
    seguradora: CARD_ALFA.seguradora,
    produto: CARD_ALFA.produto,
    formaPagamento: CARD_ALFA.formaPagamento,
    parcelas: CARD_ALFA.opcoes[0].parcelas,
    premio: 2345.67,
  });

  await page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData() ?? "";
    if (body.includes(fixture.cotacaoId) && body.includes("formaPagamento")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: { ok: true, numeroCotacao: "N-E2E-123", tentativaId },
        }),
      });
      return;
    }
    await route.continue();
  });

  // Contratar pela lista comparativa (visão padrão do passo Cálculo,
  // V12.3.5): o botão "Contratar" carrega o mesmo título
  // `Gerar proposta (<seguradora>)` que o botão do card, então
  // `getByTitle` acha a célula certa em qualquer visão sem depender do
  // texto visível ("Contratar" na lista, ícone no card).
  await expect(page.getByText(CARD_BETA.seguradora).first()).toBeVisible();
  await page.getByTitle(`Gerar proposta (${CARD_ALFA.seguradora})`).click();
  await expect(page.getByRole("heading", { name: "Dados complementares" })).toBeVisible();
  await confirmarDadosComplementaresTransmissao(page);

  // Modo "transmitindo": o passo Cálculo inteiro some, só sobra o painel de
  // espera (que mostra só a seguradora escolhida, Alfa — Beta não aparece
  // mais em lugar nenhum da tela).
  await expect(page.getByText("Aguardando confirmação da seguradora…")).toBeVisible();
  await expect(page.locator(".calc-lista")).toHaveCount(0);
  await expect(page.getByText(CARD_BETA.seguradora)).toHaveCount(0);

  return tentativaId;
}

test.describe("Webhook de transmissão — StepCalculo reage ao resultado do robô", () => {
  test("sucesso: webhook transmitido=true → sub-passo Transmitida mostra o card completo (Frente 3, V12.1.13 parcial)", async ({
    page,
  }) => {
    const fixture = await prepararCotacaoCalculada(page);
    try {
      await gerarPropostaComTentativaReal(page, fixture);
      await page.unroute("**/_serverFn/**");

      const res = await page.request.post("/api/webhooks/quiver-transmissao", {
        headers: QUIVER_TRANSMISSAO_WEBHOOK_HEADERS,
        data: {
          cotacaoId: fixture.cotacaoId,
          transmitido: true,
          numeroCotacao: "N-E2E-123",
        },
      });
      expect(res.ok()).toBeTruthy();

      // O polling do front roda a cada 4s — margem generosa acima disso. A
      // proposta virou uma linha real (`registrar_resultado_transmissao_quiver`),
      // então o ramo `transmitida` do resultado ganha o card completo de
      // `TransmissaoTransmitidaCard` em vez do resumo antigo.
      const acoes = page.locator('[data-tour="transmitida-acoes"]');
      await expect(acoes).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Proposta transmitida com sucesso")).toHaveCount(0);

      // Ações desabilitadas — dependem da integração que ainda não devolve
      // protocolo/documentos (nunca simular, V12.1.28).
      await expect(acoes.getByRole("button", { name: "Documentos e envio" })).toBeDisabled();
      await expect(acoes.getByRole("button", { name: "Consultar protocolo" })).toBeDisabled();

      // Campos que a integração futura preenche continuam "—" hoje.
      await expect(page.getByRole("cell", { name: "Protocolo" })).toBeVisible();
      // Nome do segurado (embed 1:1 `cotacao_segurado` — `embed1a1` em
      // `useProposta`/`TransmissaoTransmitidaCard`): confirma que o PostgREST
      // devolve objeto (não array) e o card não trava em "—". Escopado em
      // `transmitida-docs` — o mesmo nome aparece em mais lugares da tela
      // (resumo, aviso de cotação finalizada), o que deixaria o locator
      // ambíguo se não escopado.
      const docs = page.locator('[data-tour="transmitida-docs"]');
      await expect(docs.getByText("CLIENTE TRANSMISSÃO E2E")).toBeVisible();
      const atalhos = page.locator('[data-tour="transmitida-atalhos"]');
      await expect(atalhos.getByRole("link", { name: /Emissão & histórico/ })).toBeVisible();
      await expect(atalhos.getByRole("link", { name: /Pipeline/ })).toBeVisible();
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });

  test("falha por RECUSADA_PELO_PORTAL → sem 'Tentar novamente', 'Ver proposta' leva pra Em negociação com negociação recusada", async ({
    page,
  }) => {
    const fixture = await prepararCotacaoCalculada(page);
    try {
      await gerarPropostaComTentativaReal(page, fixture);
      await page.unroute("**/_serverFn/**");

      const res = await page.request.post("/api/webhooks/quiver-transmissao", {
        headers: QUIVER_TRANSMISSAO_WEBHOOK_HEADERS,
        data: {
          cotacaoId: fixture.cotacaoId,
          transmitido: false,
          motivo: "RECUSADA_PELO_PORTAL",
          mensagem: "Mensagem de teste do portal",
        },
      });
      expect(res.ok()).toBeTruthy();

      await expect(page.getByText("Mensagem de teste do portal")).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText("RECUSADA_PELO_PORTAL")).toBeVisible();
      await expect(page.getByText("Proposta transmitida com sucesso")).toHaveCount(0);

      // Rejeição de regra de negócio (ex.: duplicidade) — reenviar os mesmos
      // dados não resolve, então não há "Tentar novamente" pra esse motivo.
      await expect(page.getByRole("button", { name: "Tentar novamente" })).toHaveCount(0);

      // "Ver proposta" leva pra Em negociação (não Em finalização) — a
      // negociação já foi marcada como recusada, com o motivo no histórico.
      await page.getByRole("link", { name: "Ver proposta" }).click();
      await expect(page).toHaveURL(/\/venda\/em-negociacao\?/);

      // Escopado no painel da proposta aberta (data-tour="proposta-painel"),
      // não na tabela inteira — em CI (fullyParallel) outra proposta rodando
      // em paralelo pode ter o mesmo chip "Recusada" visível na listagem.
      const painel = page.locator('[data-tour="proposta-painel"]');
      await expect(painel.locator("span.chip", { hasText: "Recusada" })).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        painel.getByText(/Recusada pelo portal.*Mensagem de teste do portal/),
      ).toBeVisible();
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });

  test("falha por CAMPOS_PENDENTES → mantém 'Tentar novamente' e link pra Em finalização", async ({
    page,
  }) => {
    const fixture = await prepararCotacaoCalculada(page);
    try {
      await gerarPropostaComTentativaReal(page, fixture);
      await page.unroute("**/_serverFn/**");

      const res = await page.request.post("/api/webhooks/quiver-transmissao", {
        headers: QUIVER_TRANSMISSAO_WEBHOOK_HEADERS,
        data: {
          cotacaoId: fixture.cotacaoId,
          transmitido: false,
          motivo: "CAMPOS_PENDENTES",
          mensagem: "Preencha o campo Dia de Vencimento das Demais Parcelas",
        },
      });
      expect(res.ok()).toBeTruthy();

      await expect(
        page.getByText("Preencha o campo Dia de Vencimento das Demais Parcelas"),
      ).toBeVisible({ timeout: 15_000 });

      // Esse motivo é corrigível pelo vendedor — mantém "Tentar novamente".
      await page.getByRole("button", { name: "Tentar novamente" }).click();
      await expect(page.getByRole("heading", { name: "Dados complementares" })).toBeVisible();
      await page.getByRole("button", { name: "Voltar ao cálculo" }).click();
      await expect(page.locator(".calc-lista")).toBeVisible();
      await expect(page.getByText(CARD_ALFA.seguradora).first()).toBeVisible();
      await expect(page.getByText(CARD_BETA.seguradora).first()).toBeVisible();
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });

  // Ajustes pós-deploy V12 (item 3): a oferta só parcelada precisa mostrar o
  // MESMO total (nº de parcelas × valor da parcela) tanto em Em finalização
  // quanto em Emissão — nunca o valor de 1 parcela isolada.
  test("oferta só parcelada: Em finalização e Emissão mostram o mesmo total (12x de R$ 463,20 = R$ 5.558,40)", async ({
    page,
  }) => {
    const fixture = await criarCotacaoTransmissaoFixture();
    try {
      const res = await page.request.post("/api/webhooks/quiver", {
        headers: QUIVER_WEBHOOK_HEADERS,
        data: { cotacaoId: fixture.cotacaoId, temPremios: true, cards: [CARD_SO_PARCELADO] },
      });
      expect(res.ok()).toBeTruthy();

      await loginAs(page, fixture.email, fixture.senha);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
      await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
      await expect(page.getByText(/compare, personalize e escolha a seguradora/i)).toBeVisible({
        timeout: 10_000,
      });

      // A tentativa real (`cotacao_transmissoes`) já nasce com os 3 campos
      // que `transmitirPropostaQuiver` calcularia no servidor (T.2) —
      // simulado aqui porque o robô real não roda no teste.
      const tentativaId = await criarTentativaTransmissaoEnviada({
        cotacaoId: fixture.cotacaoId,
        seguradora: CARD_SO_PARCELADO.seguradora,
        produto: CARD_SO_PARCELADO.produto,
        formaPagamento: CARD_SO_PARCELADO.formaPagamento,
        parcelas: CARD_SO_PARCELADO.opcoes[0].parcelas,
        premio: 5558.4,
        parcelasNum: 12,
        valorParcela: 463.2,
      });
      await page.route("**/_serverFn/**", async (route) => {
        const body = route.request().postData() ?? "";
        if (body.includes(fixture.cotacaoId) && body.includes("formaPagamento")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              result: { ok: true, numeroCotacao: "N-E2E-PARCELADO", tentativaId },
            }),
          });
          return;
        }
        await route.continue();
      });

      await page.getByTitle(`Gerar proposta (${CARD_SO_PARCELADO.seguradora})`).click();
      await expect(page.getByRole("heading", { name: "Dados complementares" })).toBeVisible();
      await confirmarDadosComplementaresTransmissao(page);
      await expect(page.getByText("Aguardando confirmação da seguradora…")).toBeVisible();
      await page.unroute("**/_serverFn/**");

      // Em finalização: linha com status "enviada" antes do webhook — a
      // célula PRÊMIO já mostra o total com o parcelamento.
      await page.goto("/venda/em-finalizacao");
      const linhaFinalizacao = page
        .locator('[data-tour="em-finalizacao-lista"] tbody tr')
        .filter({ hasText: CARD_SO_PARCELADO.seguradora });
      await expect(linhaFinalizacao).toBeVisible({ timeout: 10_000 });
      await expect(linhaFinalizacao).toContainText(/5\.558,40/);
      await expect(linhaFinalizacao).toContainText(/12x de/);
      await expect(linhaFinalizacao).toContainText(/463,20/);

      // Webhook de sucesso: proposta nasce com o mesmo detalhamento.
      const resTransmissao = await page.request.post("/api/webhooks/quiver-transmissao", {
        headers: QUIVER_TRANSMISSAO_WEBHOOK_HEADERS,
        data: {
          cotacaoId: fixture.cotacaoId,
          transmitido: true,
          numeroCotacao: "N-E2E-PARCELADO",
        },
      });
      expect(resTransmissao.ok()).toBeTruthy();

      // Emissão: mesma proposta, mesmo total/parcelamento. O webhook já
      // grava `propostas` de forma síncrona (`registrar_resultado_transmissao_quiver`)
      // antes de responder — sem precisar reabrir o wizard (a página, aqui,
      // já navegou para Em finalização acima).
      await page.goto("/venda/emissao");
      const linhaEmissao = page
        .locator('[data-tour="emissao-aguardando"] tbody tr')
        .filter({ hasText: CARD_SO_PARCELADO.seguradora });
      await expect(linhaEmissao).toBeVisible({ timeout: 10_000 });
      await expect(linhaEmissao).toContainText(/5\.558,40/);
      await expect(linhaEmissao).toContainText(/12x/);
      await expect(linhaEmissao).toContainText(/463,20/);
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });

  test("webhook de transmissão rejeita segredo incorreto (401)", async ({ page }) => {
    const fixture = await criarCotacaoTransmissaoFixture();
    try {
      const res = await page.request.post("/api/webhooks/quiver-transmissao", {
        headers: {
          "content-type": "application/json",
          "x-client-key": "errado",
          "x-client-secret": "errado",
        },
        data: { cotacaoId: fixture.cotacaoId, transmitido: true },
      });
      expect(res.status()).toBe(401);
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });
});
