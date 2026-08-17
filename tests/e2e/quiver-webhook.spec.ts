import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarCotacaoQuiverFixture,
  limparCotacaoQuiverFixture,
  QUIVER_WEBHOOK_HEADERS,
  type CotacaoQuiverFixture,
} from "./provision";

/**
 * E2E da integração com a Quiver (Fase 6): simula o webhook (`POST
 * /api/webhooks/quiver`, ver src/lib/quiver-webhook.ts) chamando o endpoint
 * real via `page.request` (sem depender do bot Playwright da Quiver estar no
 * ar), e confirma que o Passo 6 (Cálculo) do wizard reage certo aos 3 estados
 * possíveis: `calculada` (prêmios reais), `erro_quiver` com mensagem, e
 * `erro_quiver` por placa não encontrada.
 *
 * Cada teste usa sua própria cotação (fixture criada direto via admin,
 * já com os dados mínimos pra abrir o Passo 6) — não depende de preencher
 * o wizard inteiro pela UI (mesma decisão de `venda.spec.ts`: preenchimento
 * completo é frágil e não é o objeto deste teste).
 */
test.describe("Quiver webhook — wizard reage aos 3 estados", () => {
  let fixture: CotacaoQuiverFixture;

  test.afterEach(async () => {
    if (fixture) await limparCotacaoQuiverFixture(fixture);
  });

  test("calculada: webhook mostra os cards e move o lead relacionado para Cotação", async ({
    page,
  }) => {
    fixture = await criarCotacaoQuiverFixture();

    const res = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: {
        cotacaoId: fixture.cotacaoId,
        temPremios: true,
        cards: [
          {
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
                desconto: "5% no débito",
              },
              {
                tipo: "Roubo e furto",
                franquia: "Sem franquia",
                avista: "R$ 1.234,50",
                parcelas: "6x de R$ 220,10",
              },
            ],
            formasPagamento: {
              selecionada: "Cartão de crédito",
              opcoes: ["Cartão de crédito", "Débito em conta"],
            },
            formaPagamento: "Boleto",
            premiosPorFormaPagamento: [
              {
                formaPagamento: "Cartão de crédito",
                opcoes: [
                  {
                    tipo: "Compreensiva cartão",
                    franquia: "Reduzida cartão · R$ 2.450,00",
                    avista: "R$ 2.345,67",
                    parcelas: "10x de R$ 251,90",
                    desconto: "5% no cartão",
                  },
                  {
                    tipo: "Roubo e furto cartão",
                    franquia: "Sem franquia",
                    avista: "R$ 1.234,50",
                    parcelas: "6x de R$ 220,10",
                  },
                  {
                    tipo: "À vista no cartão",
                    franquia: "Normal · R$ 2.200,00",
                    avista: "R$ 2.111,11",
                    parcelas: "",
                  },
                ],
              },
              {
                formaPagamento: "Débito em conta",
                opcoes: [
                  {
                    tipo: "Compreensiva débito",
                    franquia: "Reduzida débito · R$ 2.300,00",
                    avista: "R$ 2.300,00",
                    parcelas: "1x de R$ 2.300,00",
                    desconto: "7% no débito",
                  },
                ],
              },
            ],
            coberturasBasicas: {
              Casco: "100% FIPE",
              "Danos materiais": "R$ 150.000,00",
            },
            coberturasAdicionais: { Vidros: "Completo", Reserva: "15 dias" },
          },
          {
            index: 10,
            seguradora: "Seguradora Alfa",
            produto: "Auto Essencial",
            nome: "Plano Econômico",
            opcoes: [
              {
                tipo: "Compreensiva Econômica",
                franquia: "Normal · R$ 3.100,00",
                avista: "R$ 1.987,65",
                parcelas: "8x de R$ 310,00",
              },
            ],
            formasPagamento: { selecionada: "Boleto", opcoes: ["Boleto"] },
            coberturasBasicas: { Casco: "90% FIPE" },
            coberturasAdicionais: { Vidros: "Básico" },
          },
          {
            index: 30,
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
            coberturasAdicionais: { "Carro reserva": "7 dias" },
          },
          {
            index: 40,
            seguradora: "Seguradora Gama",
            produto: "Auto Protegido",
            nome: "Plano Gama",
            opcoes: [
              {
                tipo: "Compreensiva Gama",
                franquia: "Normal · R$ 3.500,00",
                avista: "R$ 2.800,00",
                parcelas: "10x de R$ 300,00",
              },
            ],
            formaPagamento: "Cartão",
            coberturasBasicas: { Casco: "100% FIPE" },
          },
          {
            index: 50,
            seguradora: "Seguradora Ômega",
            produto: "Auto Total",
            nome: "Plano Ômega",
            opcoes: [
              {
                tipo: "Compreensiva Ômega",
                franquia: "Reduzida · R$ 2.900,00",
                avista: "R$ 3.200,00",
                parcelas: "12x de R$ 290,00",
              },
            ],
            formaPagamento: "PIX",
            coberturasBasicas: { Casco: "105% FIPE" },
          },
        ],
      },
    });
    expect(res.ok()).toBeTruthy();

    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

    await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
    await expect(page.getByText(/seguradoras calculadas/i)).toBeVisible({ timeout: 10_000 });
    for (const valor of [
      "Auto Completo · Plano Premium",
      "Auto Essencial · Plano Econômico",
      "Auto Flex · Plano Flexível",
      "Reduzida cartão · R$ 2.450,00",
      "R$ 2.345,67",
      "R$ 1.987,65",
      "10x de R$ 251,90",
      "100% FIPE",
      "90% FIPE",
      "110% FIPE",
      "Completo",
      "Básico",
    ]) {
      await expect(page.getByText(valor, { exact: true }).first()).toBeVisible();
    }

    // A forma de pagamento deixou de ser um chip de texto e virou um <select>
    // alimentado pelas opções que a seguradora retornou — o vendedor precisa
    // poder trocar para Débito/Boleto antes de gerar a proposta, e o valor
    // escolhido é o que o robô usa na transmissão. `<option>` não conta como
    // "visível" para o Playwright, então asserta-se o valor e as opções.
    const cardCompleto = page.locator(".calc-card").filter({ hasText: "Auto Completo" });
    const cardEconomico = page.locator(".calc-card").filter({ hasText: "Auto Essencial" });
    const selectPagamento = cardCompleto.getByLabel("Forma de pagamento");
    await expect(selectPagamento).toHaveValue("forma-0");
    await expect(selectPagamento.locator("option")).toHaveText([
      "Cartão de crédito",
      "Débito em conta",
    ]);

    const selectParcelas = cardCompleto.getByLabel("Parcelas");
    await expect(selectParcelas).toHaveValue("forma-0-opcao-0");
    await expect(selectParcelas.locator("option")).toHaveText([
      "Compreensiva cartão · 10x de R$ 251,90",
      "Roubo e furto cartão · 6x de R$ 220,10",
      "À vista no cartão",
    ]);
    const opcoesParcelasReais = await selectParcelas.locator("option").allTextContents();
    expect(opcoesParcelasReais).not.toContain("À vista");
    const parcelasReais = opcoesParcelasReais.join(" · ");
    expect(parcelasReais).not.toContain("12x");

    // A troca afeta somente o card escolhido e passa a exibir exatamente a
    // opção vinculada à nova forma, sem recalcular ou fabricar parcelas.
    await selectPagamento.selectOption("forma-1");
    await expect(selectParcelas).toHaveValue("forma-1-opcao-0");
    await expect(cardCompleto.getByText("1x de R$ 2.300,00", { exact: true })).toBeVisible();
    await expect(
      cardCompleto.getByText("Reduzida débito · R$ 2.300,00", { exact: true }),
    ).toBeVisible();
    await expect(cardEconomico.getByLabel("Forma de pagamento")).toHaveValue("forma-legada-0");
    await expect(cardEconomico.getByLabel("Parcelas")).toHaveValue("forma-legada-0-opcao-0");

    let requisicaoTransmissao = "";
    await page.route("**/*", async (route) => {
      const corpo = route.request().postData() ?? "";
      if (
        route.request().method() === "POST" &&
        corpo.includes(fixture.cotacaoId) &&
        corpo.includes("formaPagamento")
      ) {
        requisicaoTransmissao = corpo;
        await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
        return;
      }
      await route.continue();
    });
    await cardCompleto.getByRole("button", { name: "Gerar proposta (Seguradora Alfa)" }).click();
    await expect.poll(() => requisicaoTransmissao).not.toBe("");
    expect(requisicaoTransmissao).toContain("Débito em conta");
    expect(requisicaoTransmissao).toContain("1x de R$ 2.300,00");
    expect(requisicaoTransmissao).not.toContain("valorParcela");
    expect(requisicaoTransmissao).not.toContain('"calculo"');

    // Trocar a condição dentro da mesma forma atualiza o mesmo card. A opção
    // real à vista tem parcelas vazio e deve continuar selecionável/transmissível.
    await selectPagamento.selectOption("forma-0");
    await selectParcelas.selectOption("forma-0-opcao-1");
    await expect(cardCompleto.getByText("R$ 1.234,50", { exact: true })).toBeVisible();
    await expect(cardCompleto.getByText("6x de R$ 220,10", { exact: true })).toBeVisible();
    await selectParcelas.selectOption("forma-0-opcao-2");
    await expect(cardCompleto.getByText("R$ 2.111,11", { exact: true })).toBeVisible();
    await expect(cardCompleto.getByText("Normal · R$ 2.200,00", { exact: true })).toBeVisible();
    await expect(cardCompleto.getByText("À vista", { exact: true })).toHaveCount(0);
    const botaoTransmitir = cardCompleto.getByRole("button", {
      name: "Gerar proposta (Seguradora Alfa)",
    });
    await expect(botaoTransmitir).toBeEnabled();
    requisicaoTransmissao = "";
    await botaoTransmitir.click();
    await expect.poll(() => requisicaoTransmissao).not.toBe("");
    const corpoSerializado = JSON.parse(requisicaoTransmissao) as {
      t: { p: { v: Array<{ p: { k: string[]; v: Array<{ t: number; s?: string }> } }> } };
    };
    const objetoData = corpoSerializado.t.p.v[0].p;
    const indiceParcelas = objetoData.k.indexOf("parcelas");
    expect(indiceParcelas).toBeGreaterThanOrEqual(0);
    expect(objetoData.v[indiceParcelas]).toEqual({ t: 1, s: "" });
    expect(requisicaoTransmissao).not.toContain("À vista");
    await page.unroute("**/*");

    await page.getByRole("link", { name: "Comparativo lado a lado" }).click();
    await expect(page).toHaveURL(new RegExp(`/venda/cotacoes/${fixture.cotacaoId}$`));

    await page.setViewportSize({ width: 900, height: 800 });
    const scrollRegion = page.getByRole("region", {
      name: "Comparativo de propostas com rolagem horizontal",
    });
    const anterior = page.getByRole("button", { name: "Ver proposta anterior" });
    const proxima = page.getByRole("button", { name: "Ver próxima proposta" });
    await expect(scrollRegion).toBeVisible();
    await expect(scrollRegion).toHaveAttribute("tabindex", "0");
    await expect(page.getByText("Há mais propostas à direita.", { exact: true })).toBeVisible();
    await expect(anterior).toBeDisabled();
    await expect(proxima).toBeEnabled();
    await expect
      .poll(() => scrollRegion.evaluate((element) => element.scrollWidth > element.clientWidth))
      .toBe(true);

    const primeiraCelula = scrollRegion.locator("thead th").first();
    const primeiraCelulaCorpo = scrollRegion.locator("tbody td.cov-name").first();
    const stickyInicial = await primeiraCelula.evaluate((element) => ({
      position: getComputedStyle(element).position,
      left: element.getBoundingClientRect().left,
    }));
    const stickyCorpoInicial = await primeiraCelulaCorpo.evaluate((element) => ({
      position: getComputedStyle(element).position,
      left: element.getBoundingClientRect().left,
      zIndex: getComputedStyle(element).zIndex,
      backgroundColor: getComputedStyle(element).backgroundColor,
    }));
    expect(stickyInicial.position).toBe("sticky");
    expect(stickyCorpoInicial.position).toBe("sticky");
    expect(stickyCorpoInicial.zIndex).toBe("2");
    expect(stickyCorpoInicial.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");

    const scrollInicial = await scrollRegion.evaluate((element) => element.scrollLeft);
    await proxima.click();
    await expect
      .poll(() => scrollRegion.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(scrollInicial);
    await expect(anterior).toBeEnabled();
    await expect(
      page.getByText("Há mais propostas à esquerda e à direita.", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => primeiraCelula.evaluate((element) => element.getBoundingClientRect().left))
      .toBeCloseTo(stickyInicial.left, 0);
    await expect
      .poll(() => primeiraCelulaCorpo.evaluate((element) => element.getBoundingClientRect().left))
      .toBeCloseTo(stickyCorpoInicial.left, 0);

    await scrollRegion.focus();
    const scrollAntesTeclado = await scrollRegion.evaluate((element) => element.scrollLeft);
    await scrollRegion.press("ArrowRight");
    await expect
      .poll(() => scrollRegion.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(scrollAntesTeclado);

    for (let tentativa = 0; tentativa < 10 && (await proxima.isEnabled()); tentativa += 1) {
      const alvo = await scrollRegion.evaluate((element) =>
        Math.min(element.scrollLeft + 280, element.scrollWidth - element.clientWidth),
      );
      await proxima.evaluate((element) => (element as HTMLButtonElement).click());
      await expect
        .poll(() => scrollRegion.evaluate((element) => element.scrollLeft))
        .toBeGreaterThanOrEqual(alvo - 1);
    }
    await expect(proxima).toBeDisabled();
    await expect(page.getByText("Há mais propostas à esquerda.", { exact: true })).toBeVisible();
    const ultimaProposta = scrollRegion.getByText("Auto Total · Plano Ômega", { exact: true });
    await expect(ultimaProposta).toBeVisible();
    expect(
      await ultimaProposta.evaluate((element) => {
        const proposal = element.getBoundingClientRect();
        const region = element.closest('[role="region"]')!.getBoundingClientRect();
        return proposal.right <= region.right + 1 && proposal.left >= region.left - 1;
      }),
    ).toBe(true);

    await anterior.click();
    await expect(proxima).toBeEnabled();
    await scrollRegion.evaluate((element) => element.scrollTo({ left: 0 }));
    await expect(anterior).toBeDisabled();
    await expect(page.getByText("Há mais propostas à direita.", { exact: true })).toBeVisible();

    const larguraEstreita = await scrollRegion.evaluate((element) => element.clientWidth);
    await page.setViewportSize({ width: 1400, height: 800 });
    await expect
      .poll(() => scrollRegion.evaluate((element) => element.clientWidth))
      .toBeGreaterThan(larguraEstreita);
    await expect(anterior).toBeDisabled();
    await expect(proxima).toBeEnabled();
    expect(
      await scrollRegion.evaluate(
        (element) => element.scrollLeft < element.scrollWidth - element.clientWidth - 1,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 900, height: 800 });
    await expect(proxima).toBeVisible();
    await expect(anterior).toBeDisabled();

    // O comparativo deve renderizar o mesmo payload, inclusive múltiplos
    // produtos da mesma seguradora, sem resumir para uma cobertura genérica.
    for (const valor of [
      "Auto Completo · Plano Premium",
      "Auto Essencial · Plano Econômico",
      "Auto Flex · Plano Flexível",
      "Reduzida cartão · R$ 2.450,00",
      "Sem franquia",
      "Normal · R$ 3.100,00",
      "Majorada · R$ 4.000,00",
      "R$ 2.345,67",
      "R$ 1.234,50",
      "R$ 3.010,05",
      "10x de R$ 251,90",
      "6x de R$ 220,10",
      "8x de R$ 310,00",
      "12x de R$ 275,40",
      "100% FIPE",
      "90% FIPE",
      "110% FIPE",
      "R$ 150.000,00",
      "Completo",
      "Básico",
      "15 dias",
      "7 dias",
      "7% no débito",
    ]) {
      await expect(page.getByText(valor).first()).toBeVisible();
    }
    await expect(page.getByText(/Cartão de crédito.*Débito em conta.*Boleto/)).toBeVisible();
    await expect(page.getByText("Compreensiva débito", { exact: true })).toBeVisible();
    await expect(page.getByText(/Reduzida débito · R\$ 2\.300,00/)).toBeVisible();

    // Os dois produtos Alfa têm pareamentos financeiros distintos e inequívocos,
    // mas desconto é uma ação da seguradora inteira: ambos permanecem bloqueados.
    await expect(page.getByText(/o desconto é aplicado à seguradora inteira/i)).toHaveCount(2);
    await expect(page.getByText(/não foi possível vincular este produto/i)).toHaveCount(0);
    await expect(page.getByText("R$ 1.987,65", { exact: true })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Solicitar desconto adicional" })).toHaveCount(3);
    await expect(page.getByText("12x de R$ 195,48", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Cobertura padrão", { exact: true })).toHaveCount(0);

    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Imprimir comparativo" }).click();
    const popup = await popupPromise;
    await expect(popup.locator("body")).toContainText("Auto Completo · Plano Premium");
    await expect(popup.locator("body")).toContainText("Auto Essencial · Plano Econômico");
    await expect(popup.locator("body")).toContainText("Reduzida cartão · R$ 2.450,00");
    await expect(popup.locator("body")).toContainText("10x de R$ 251,90");
    await expect(popup.locator("body")).toContainText("5% no cartão");
    await expect(popup.locator("body")).toContainText("Compreensiva débito");
    await expect(popup.locator("body")).toContainText("Auto Protegido · Plano Gama");
    await expect(popup.locator("body")).toContainText("Auto Total · Plano Ômega");
    await expect(popup.locator("body")).toContainText("Reduzida débito · R$ 2.300,00");
    await expect(popup.locator("body")).toContainText("7% no débito");
    await expect(popup.locator("body")).toContainText("R$ 150.000,00");
    await expect(popup.locator("body")).toContainText("Prêmio registradoR$ 1.987,65R$ 2.345,67");
    await expect(popup.locator("body")).not.toContainText("Vínculo indisponível");
    await expect(popup.locator("body")).not.toContainText("12x de R$ 195,48");
    await popup.close();

    await page.goto("/venda/pipeline");
    // O status canônico é `cotacao`; a coluna correspondente ainda é rotulada
    // "Cotando" na UI atual.
    const colunaCotacao = page.locator('.kcol[data-stage="Cotando"]');
    await expect(colunaCotacao.getByText(fixture.leadNome, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("erro_quiver: webhook sem prêmios → Passo 6 mostra a mensagem de erro", async ({ page }) => {
    fixture = await criarCotacaoQuiverFixture();

    const res = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: {
        cotacaoId: fixture.cotacaoId,
        temPremios: false,
        mensagem: "Portal indisponível para o produto solicitado.",
      },
    });
    expect(res.ok()).toBeTruthy();

    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

    await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
    await expect(page.getByText("Portal indisponível para o produto solicitado.")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("NEGATIVO: retorno legado ambíguo não libera combinação inventada", async ({ page }) => {
    fixture = await criarCotacaoQuiverFixture();
    const res = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: {
        cotacaoId: fixture.cotacaoId,
        temPremios: true,
        cards: [
          {
            seguradora: "Seguradora Ambígua",
            formaPagamento: "Boleto",
            formasPagamento: { selecionada: "Cartão", opcoes: ["Cartão", "PIX"] },
            opcoes: [
              {
                tipo: "Compreensiva",
                avista: "R$ 2.300,00",
                parcelas: "10x de R$ 250,00",
              },
            ],
          },
        ],
      },
    });
    expect(res.ok()).toBeTruthy();

    await loginAs(page, fixture.email, fixture.senha);
    await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
    const card = page.locator(".calc-card").filter({ hasText: "Seguradora Ambígua" });
    await expect(card.getByLabel("Forma de pagamento")).toBeDisabled();
    await expect(card.getByLabel("Forma de pagamento")).toHaveText("Indisponível");
    await expect(card.getByLabel("Parcelas")).toBeDisabled();
    await expect(
      card.getByRole("button", { name: "Gerar proposta (Seguradora Ambígua)" }),
    ).toBeDisabled();
  });

  test("placa não encontrada: webhook sem prêmios → Passo 6 mostra a mensagem específica", async ({
    page,
  }) => {
    fixture = await criarCotacaoQuiverFixture();

    const res = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: {
        cotacaoId: fixture.cotacaoId,
        temPremios: false,
        placaNaoEncontrada: true,
      },
    });
    expect(res.ok()).toBeTruthy();

    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

    await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
    await expect(page.getByText(/placa não encontrada/i)).toBeVisible({ timeout: 10_000 });
  });

  test("webhook rejeita segredo incorreto (401)", async ({ page }) => {
    fixture = await criarCotacaoQuiverFixture();

    const res = await page.request.post("/api/webhooks/quiver", {
      headers: {
        "content-type": "application/json",
        "x-client-key": "errado",
        "x-client-secret": "errado",
      },
      data: { cotacaoId: fixture.cotacaoId, temPremios: true, cards: [] },
    });
    expect(res.status()).toBe(401);
  });

  test("NEGATIVO: vendedor de outra empresa não abre o comparativo por URL direta", async ({
    page,
  }) => {
    fixture = await criarCotacaoQuiverFixture();
    const intruso = await criarCotacaoQuiverFixture();
    try {
      await loginAs(page, intruso.email, intruso.senha);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

      await page.goto(`/venda/cotacoes/${fixture.cotacaoId}`);
      await expect(page.getByText("Cotação não encontrada.", { exact: true })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByRole("heading", { name: /Comparativo ·/ })).toHaveCount(0);
    } finally {
      await limparCotacaoQuiverFixture(intruso);
    }
  });
});
