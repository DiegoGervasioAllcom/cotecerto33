import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
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
 * `doc/PLANO_WEBHOOK_TRANSMISSAO.md`): confirma que o Passo 6 (Cálculo) do
 * wizard entra em modo "transmitindo" ao clicar em "gerar proposta", reage ao
 * webhook `POST /api/webhooks/quiver-transmissao` (sucesso e falha) via
 * polling, e que a tela de Aceite & Transmissão reflete uma falha automática.
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
  await expect(page.getByText(/seguradoras calculadas/i)).toBeVisible({ timeout: 10_000 });

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

  const cardAlfa = page.locator(".calc-card").filter({ hasText: CARD_ALFA.seguradora });
  const cardBeta = page.locator(".calc-card").filter({ hasText: CARD_BETA.seguradora });
  await expect(cardBeta).toBeVisible();
  await cardAlfa.getByRole("button", { name: `Gerar proposta (${CARD_ALFA.seguradora})` }).click();

  // Modo "transmitindo": os demais cards somem, só sobra o painel de espera.
  await expect(page.getByText("Aguardando confirmação da seguradora…")).toBeVisible();
  await expect(cardBeta).toHaveCount(0);
  await expect(cardAlfa).toHaveCount(0);

  return tentativaId;
}

test.describe("Webhook de transmissão — StepCalculo reage ao resultado do robô", () => {
  test("sucesso: webhook transmitido=true → UI mostra confirmação e link para Aceite", async ({
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

      // O polling do front roda a cada 4s — margem generosa acima disso.
      await expect(page.getByText("Proposta transmitida com sucesso")).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole("link", { name: "Ir para Aceite & Transmissão" })).toBeVisible();
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });

  test("falha por RECUSADA_PELO_PORTAL → sem 'Tentar novamente', 'Ver proposta' leva pra Propostas com negociação recusada", async ({
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

      // "Ver proposta" leva pra Propostas (não Aceite & Transmissão) — a
      // negociação já foi marcada como recusada, com o motivo no histórico.
      await page.getByRole("link", { name: "Ver proposta" }).click();
      await expect(page).toHaveURL(/\/venda\/propostas\?/);
      await expect(page.locator("span.chip", { hasText: "Recusada" })).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        page.getByText(/Recusada pelo portal.*Mensagem de teste do portal/),
      ).toBeVisible();
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });

  test("falha por CAMPOS_PENDENTES → mantém 'Tentar novamente' e link pra Aceite & Transmissão", async ({
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
      await expect(
        page.locator(".calc-card").filter({ hasText: CARD_ALFA.seguradora }),
      ).toBeVisible();
      await expect(
        page.locator(".calc-card").filter({ hasText: CARD_BETA.seguradora }),
      ).toBeVisible();
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
