import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarCotacaoQuiverFixture,
  definirSeguradorasSelE2E,
  gravarAjusteSeguradoraE2E,
  marcarCalculoVistoE2E,
  QUIVER_WEBHOOK_HEADERS,
  lerAjustesSeguradoraE2E,
  limparCotacaoQuiverFixture,
  virarPropostaE2E,
  type CotacaoQuiverFixture,
} from "./provision";

/**
 * E2E do bloco "Personalizar por seguradora" no passo Coberturas (V12.3.7,
 * fatia 4). Não envia nada ao robô: só grava/le `cotacao_seguradora_ajustes`.
 */
test.describe("Personalizar por seguradora — passo Coberturas (V12.3.7)", () => {
  let fixture: CotacaoQuiverFixture | undefined;

  test.afterEach(async () => {
    if (fixture) await limparCotacaoQuiverFixture(fixture);
    fixture = undefined;
  });

  async function abrir(page: Page) {
    fixture = await criarCotacaoQuiverFixture();
    await definirSeguradorasSelE2E(fixture.cotacaoId, ["Mapfre", "Porto"]);
    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=4`);
    await expect(page.getByText("Personalizar por seguradora")).toBeVisible({ timeout: 15_000 });
  }

  test("uma linha por seguradora, abas em breve, grava só o que difere e recarrega", async ({
    page,
  }) => {
    await abrir(page);
    await expect(page.locator(".seg-perso .seg-row")).toHaveCount(2);
    await expect(page.getByTestId("seg-row-Mapfre")).toBeVisible();
    await expect(page.getByTestId("seg-row-Porto")).toBeVisible();
    for (const nome of [
      /Assistências \(em breve\)/,
      /Descontos \(em breve\)/,
      /Comissões \(em breve\)/,
    ])
      await expect(page.locator(".seg-perso").getByRole("button", { name: nome })).toBeDisabled();
    await expect(page.locator(".seg-marcas, .seg-minis")).toHaveCount(0);
    await expect(page.getByText(/O ajuste vale só ao recalcular uma seguradora/)).toBeVisible();

    const porto = page.getByTestId("seg-row-Porto");
    await porto.getByLabel("1ª opção de franquia").selectOption("Reduzida 25%");
    await expect(page.getByTestId("seg-status-Porto")).toHaveText("guardado", { timeout: 10_000 });

    const linhas = await lerAjustesSeguradoraE2E(fixture?.cotacaoId ?? "");
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      seguradora: "porto", // chave canônica do robô, não o nome de exibição
      franquia_primeira_opcao: "Reduzida 25%",
      franquia_segunda_opcao: null,
      vidros: null,
      carro_reserva: null,
    });

    await page.reload();
    await expect(page.getByTestId("seg-row-Porto")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("seg-row-Porto").getByLabel("1ª opção de franquia")).toHaveValue(
      "Reduzida 25%",
    );
    await expect(
      page.getByTestId("seg-row-Mapfre").getByLabel("1ª opção de franquia"),
    ).not.toHaveValue("Reduzida 25%");
  });

  test("cotação já virada em proposta mostra a mensagem clara", async ({ page }) => {
    await abrir(page);
    await virarPropostaE2E(fixture?.cotacaoId ?? "");
    await page.getByTestId("seg-row-Mapfre").getByLabel("Carro reserva").selectOption({ index: 1 });
    await expect(page.getByRole("alert").filter({ hasText: /já virou proposta/ })).toBeVisible({
      timeout: 10_000,
    });
    expect(await lerAjustesSeguradoraE2E(fixture?.cotacaoId ?? "")).toHaveLength(0);
  });

  const cardPorto = {
    index: 0,
    seguradora: "Porto",
    produto: "Auto Flex",
    nome: "Plano Flexível",
    opcoes: [{ tipo: "Compreensiva Plus", franquia: "R$ 4.000,00", avista: "R$ 4.200,00" }],
    coberturasBasicas: { Casco: "110% FIPE" },
  };

  async function abrirModalPortoNoCalculo(page: Page) {
    const res = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: { cotacaoId: fixture?.cotacaoId, temPremios: true, cards: [cardPorto] },
    });
    expect(res.ok()).toBeTruthy();
    await page.goto(`/venda/novo-lead?id=${fixture?.cotacaoId}&step=5`);
    await expect(page.getByText(/compare, personalize e escolha a seguradora/i)).toBeVisible({
      timeout: 15_000,
    });
    await page.locator(".seg-acoes").first().getByTitle("Opções: análise do envio").click();
    await page.getByText("Personalizar coberturas").click();
    await expect(page.getByRole("heading", { name: "Personalizar Porto" })).toBeVisible();
  }

  test("ajuste gravado pelo bloco (chave canônica) abre no modal do Cálculo com o valor guardado", async ({
    page,
  }) => {
    await abrir(page);
    await marcarCalculoVistoE2E(fixture?.cotacaoId ?? "");
    await page
      .getByTestId("seg-row-Porto")
      .getByLabel("1ª opção de franquia")
      .selectOption("Reduzida 25%");
    await expect(page.getByTestId("seg-status-Porto")).toHaveText("guardado", { timeout: 10_000 });
    const linhas = await lerAjustesSeguradoraE2E(fixture?.cotacaoId ?? "");
    expect(linhas.map((l) => l.seguradora)).toEqual(["porto"]);

    await abrirModalPortoNoCalculo(page);
    await expect(page.getByLabel("1ª opção de franquia")).toHaveValue("Reduzida 25%");
  });

  test('ajuste gravado como "porto" (modal/RPC) aparece no bloco da seguradora "Porto"', async ({
    page,
  }) => {
    fixture = await criarCotacaoQuiverFixture();
    await definirSeguradorasSelE2E(fixture.cotacaoId, ["Mapfre", "Porto"]);
    await gravarAjusteSeguradoraE2E(fixture.cotacaoId, "porto", "Reduzida 25%");
    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=4`);
    await expect(page.getByText("Personalizar por seguradora")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("seg-row-Porto").getByLabel("1ª opção de franquia")).toHaveValue(
      "Reduzida 25%",
    );
  });
});
