import { expect, test, type Page } from "@playwright/test";
import { confirmarDadosComplementaresTransmissao, loginAs } from "./helpers";
import {
  criarColegaComPropostaEmissao,
  criarCotacaoTransmissaoFixture,
  criarTentativaTransmissaoEnviada,
  criarVendedorComPropostasEmissao,
  limparColegaComPropostaEmissao,
  limparCotacaoTransmissaoFixture,
  limparVendedorComPropostasEmissao,
  QUIVER_TRANSMISSAO_WEBHOOK_HEADERS,
  QUIVER_WEBHOOK_HEADERS,
  type CotacaoQuiverFixture,
  type VendedorComPropostasEmissao,
} from "./provision";

/**
 * E2E da Frente 3 (`docs/v12/PLANO_TASKS_V12.md`): "Emissão & histórico"
 * (V12.1.25 parcial) e sub-passo "Transmitida" do wizard (V12.1.13 parcial).
 *
 * Regra da task (ver `src/lib/proposta-situacao.ts`): o front fica pronto
 * para os status que a integração futura vai devolver (bloqueada/análise/
 * emitida/recusada), mas sem dado real mostra "—" e nunca simula um status
 * — hoje só `transmitida`/`falha` são alcançáveis de verdade.
 */

const CARD_ALFA = {
  index: 10,
  seguradora: "Seguradora Alfa E2E",
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

test.describe("Emissão & histórico — lista (V12.1.25 parcial)", () => {
  let vendedor: VendedorComPropostasEmissao;

  test.beforeAll(async () => {
    vendedor = await criarVendedorComPropostasEmissao();
  });

  test.afterAll(async () => {
    await limparVendedorComPropostasEmissao(vendedor);
  });

  test("propostas transmitida e em falha caem em 'Aguardando a seguradora'; 'Concluídas' fica vazia; ações desabilitadas", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/venda/emissao");
    await expect(page).toHaveURL(/\/venda\/emissao/);

    const aguardando = page.locator('[data-tour="emissao-aguardando"]');
    const concluidas = page.locator('[data-tour="emissao-concluidas"]');

    const linhaTransmitida = aguardando
      .locator("tr")
      .filter({ hasText: "PRP-E2E-EMISSAO-TRANSMITIDA" });
    const linhaFalha = aguardando.locator("tr").filter({ hasText: "PRP-E2E-EMISSAO-FALHA" });
    await expect(linhaTransmitida).toBeVisible();
    await expect(linhaFalha).toBeVisible();

    // "Concluídas" só recebe `emitida` — nada aqui simula esse status, então
    // a seção fica vazia com a frase de vazio (V12.1.28: nunca simular).
    await expect(concluidas.getByText("Assim que uma apólice for emitida")).toBeVisible();
    await expect(concluidas.locator("table")).toHaveCount(0);

    // Sem dado da integração ainda → protocolo "—" nas duas.
    await expect(linhaTransmitida.getByText("protocolo —")).toBeVisible();
    await expect(linhaFalha.getByText("protocolo —")).toBeVisible();

    // Chip de situação de cada uma.
    await expect(linhaTransmitida.getByText("Transmitida", { exact: true })).toBeVisible();
    await expect(linhaFalha.getByText("Pendência da seguradora")).toBeVisible();

    // Ações desabilitadas — clicar não navega nem dispara request (sem
    // integração ligada, nada de "Documentos"/"Consultar" funcional ainda).
    for (const linha of [linhaTransmitida, linhaFalha]) {
      const docs = linha.getByRole("button", { name: "Documentos" });
      const consultar = linha.getByRole("button", { name: "Consultar" });
      await expect(docs).toBeDisabled();
      await expect(consultar).toBeDisabled();
    }

    let requisicaoDisparada = false;
    page.on("request", (req) => {
      if (req.url().includes("/documentos") || req.url().includes("/consultar")) {
        requisicaoDisparada = true;
      }
    });
    await linhaTransmitida.getByRole("button", { name: "Documentos" }).click({ force: true });
    await expect(page).toHaveURL(/\/venda\/emissao/);
    expect(requisicaoDisparada).toBe(false);
  });

  test("?selected=<id> destaca e leva a rolagem até a proposta", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto(`/venda/emissao?selected=${vendedor.propostaFalhaId}`);
    await expect(page).toHaveURL(new RegExp(`selected=${vendedor.propostaFalhaId}`));

    const linhaFalha = page.locator("tr").filter({ hasText: "PRP-E2E-EMISSAO-FALHA" });
    await expect(linhaFalha).toBeVisible();
    // Destaque visual (outline) aplicado via inline style quando `selected` bate.
    await expect(linhaFalha).toHaveCSS("outline-color", /37, 99, 235|rgb\(37, 99, 235\)/);
  });

  test("um colega da mesma empresa NÃO aparece na Emissão — a tela é 'minhas propostas'", async ({
    page,
  }) => {
    // A policy `prop_select` de `propostas` libera SELECT para toda a
    // empresa (`empresa_id in profiles.empresa_id`) — o mesmo padrão já
    // documentado em `criarColegaComAgendaCompleta`. Mas `fetchEmissaoRows`
    // filtra por `.eq("responsavel_id", uid)` (decisão do usuário): a RLS
    // continua sendo a segurança, o filtro é a semântica de "minhas
    // propostas", igual `fetchSeguradoraAgenda`.
    const colega = await criarColegaComPropostaEmissao(vendedor.empresaId);
    try {
      await loginAs(page, vendedor.email, vendedor.senha);
      await page.goto("/venda/emissao");
      await expect(page).toHaveURL(/\/venda\/emissao/);

      const linhaColega = page.locator("tr").filter({ hasText: "PRP-E2E-EMISSAO-COLEGA" });
      await expect(linhaColega).toHaveCount(0);
    } finally {
      await limparColegaComPropostaEmissao(colega);
    }
  });
});

/** Cria a fixture já calculada (webhook de cotação) e abre o Passo 6 logado. */
async function prepararCotacaoCalculada(page: Page): Promise<CotacaoQuiverFixture> {
  const fixture = await criarCotacaoTransmissaoFixture();

  const res = await page.request.post("/api/webhooks/quiver", {
    headers: QUIVER_WEBHOOK_HEADERS,
    data: { cotacaoId: fixture.cotacaoId, temPremios: true, cards: [CARD_ALFA] },
  });
  expect(res.ok()).toBeTruthy();

  await loginAs(page, fixture.email, fixture.senha);
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
  await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
  await expect(page.getByText(/seguradoras calculadas/i)).toBeVisible({ timeout: 10_000 });

  return fixture;
}

/** Gera a proposta, interceptando a chamada ao robô real (mesma técnica de `webhook-transmissao.spec.ts`). */
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
          result: { ok: true, numeroCotacao: "N-E2E-EMISSAO-123", tentativaId },
        }),
      });
      return;
    }
    await route.continue();
  });

  const cardAlfa = page.locator(".calc-card").filter({ hasText: CARD_ALFA.seguradora });
  await cardAlfa.getByRole("button", { name: `Gerar proposta (${CARD_ALFA.seguradora})` }).click();
  await expect(page.getByRole("heading", { name: "Dados complementares" })).toBeVisible();
  await confirmarDadosComplementaresTransmissao(page);
  await expect(page.getByText("Aguardando confirmação da seguradora…")).toBeVisible();

  await page.unroute("**/_serverFn/**");
  return tentativaId;
}

test.describe("Sub-passo Transmitida do wizard (V12.1.13 parcial)", () => {
  test("proposta transmitida mostra o card completo, com '—' nos campos sem dado e atalhos navegáveis", async ({
    page,
  }) => {
    const fixture = await prepararCotacaoCalculada(page);
    try {
      await gerarPropostaComTentativaReal(page, fixture);

      const res = await page.request.post("/api/webhooks/quiver-transmissao", {
        headers: QUIVER_TRANSMISSAO_WEBHOOK_HEADERS,
        data: {
          cotacaoId: fixture.cotacaoId,
          transmitido: true,
          numeroCotacao: "N-E2E-EMISSAO-123",
        },
      });
      expect(res.ok()).toBeTruthy();

      const acoes = page.locator('[data-tour="transmitida-acoes"]');
      await expect(acoes).toBeVisible({ timeout: 15_000 });

      // Docs/atalhos do card.
      const docs = page.locator('[data-tour="transmitida-docs"]');
      await expect(docs).toBeVisible();
      const atalhos = page.locator('[data-tour="transmitida-atalhos"]');
      await expect(atalhos).toBeVisible();

      // "—" nos campos que a integração futura preenche (protocolo, orçamento
      // na cia, apólice) — não há esses dados ainda, e a tela nunca simula.
      await expect(page.getByRole("cell", { name: "Protocolo" })).toBeVisible();
      const linhaProtocolo = page.locator("tr").filter({ hasText: "Protocolo" });
      await expect(linhaProtocolo.getByText("—")).toBeVisible();
      const linhaOrcamento = page.locator("tr").filter({ hasText: "Orçamento na cia" });
      await expect(linhaOrcamento.getByText("—")).toBeVisible();

      // Ações desabilitadas — clicar não navega nem dispara nada.
      const botaoDocs = acoes.getByRole("button", { name: "Documentos e envio" });
      const botaoConsultar = acoes.getByRole("button", { name: "Consultar protocolo" });
      await expect(botaoDocs).toBeDisabled();
      await expect(botaoConsultar).toBeDisabled();
      await botaoDocs.click({ force: true });
      await expect(page).not.toHaveURL(/\/venda\/emissao/);

      // Atalhos navegam de verdade.
      await atalhos.getByRole("link", { name: /Pipeline/ }).click();
      await expect(page).toHaveURL(/\/venda\/pipeline/);
      await page.goBack();
      await expect(acoes).toBeVisible({ timeout: 15_000 });

      await page
        .locator('[data-tour="transmitida-atalhos"]')
        .getByRole("link", { name: /Nova cotação/ })
        .click();
      await expect(page).toHaveURL(/\/venda\/novo-lead/);
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });

  test("atalho 'Emissão & histórico' leva pra lá com a proposta selecionada", async ({ page }) => {
    const fixture = await prepararCotacaoCalculada(page);
    try {
      await gerarPropostaComTentativaReal(page, fixture);

      const res = await page.request.post("/api/webhooks/quiver-transmissao", {
        headers: QUIVER_TRANSMISSAO_WEBHOOK_HEADERS,
        data: {
          cotacaoId: fixture.cotacaoId,
          transmitido: true,
          numeroCotacao: "N-E2E-EMISSAO-124",
        },
      });
      expect(res.ok()).toBeTruthy();

      const atalhos = page.locator('[data-tour="transmitida-atalhos"]');
      await expect(atalhos).toBeVisible({ timeout: 15_000 });
      await atalhos.getByRole("link", { name: /Emissão & histórico/ }).click();

      await expect(page).toHaveURL(/\/venda\/emissao\?selected=/);
      const linha = page.locator("tr").filter({ hasText: /2\.345,67|Seguradora Alfa E2E/ });
      await expect(linha.first()).toBeVisible();
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });
});
