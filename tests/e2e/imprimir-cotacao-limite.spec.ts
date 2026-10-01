import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarCotacaoComStatusExtra,
  criarCotacaoQuiverFixture,
  criarTentativaTransmissaoEnviada,
  limparCotacaoComStatusExtra,
  limparCotacaoQuiverFixture,
  marcarCalculoVistoE2E,
  QUIVER_WEBHOOK_HEADERS,
  type CotacaoQuiverFixture,
  type CotacaoStatusExtra,
} from "./provision";

/**
 * E2E do limite de 3 seguradoras no "Configurar impressão" (`ImprimirCotacaoModal`).
 * Reusa o fixture/webhook do Passo 6, mas com 4 seguradoras: o padrão marca só as
 * 3 primeiras, a 4ª fica bloqueada até desmarcar uma, e a Impressão expressa
 * também sai com 3.
 */
test.describe("Imprimir cotação — limite de 3 seguradoras", () => {
  let fixture: CotacaoQuiverFixture;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(45_000);
    fixture = await criarCotacaoQuiverFixture();
    const res = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: {
        cotacaoId: fixture.cotacaoId,
        temPremios: true,
        cards: [
          {
            index: 10,
            seguradora: "Alfa",
            produto: "Auto",
            nome: "Plano Alfa",
            opcoes: [
              {
                tipo: "Compreensiva",
                franquia: "Normal · R$ 3.100,00",
                avista: "R$ 2.000,00",
                parcelas: "10x de R$ 250,00",
              },
            ],
            coberturasBasicas: { Casco: "100% FIPE" },
          },
          {
            index: 20,
            seguradora: "Beta",
            produto: "Auto",
            nome: "Plano Beta",
            opcoes: [
              {
                tipo: "Compreensiva",
                franquia: "Normal · R$ 3.100,00",
                avista: "R$ 3.000,00",
                parcelas: "10x de R$ 250,00",
              },
            ],
            coberturasBasicas: { Casco: "100% FIPE" },
          },
          {
            index: 30,
            seguradora: "Gama",
            produto: "Auto",
            nome: "Plano Gama",
            opcoes: [
              {
                tipo: "Compreensiva",
                franquia: "Normal · R$ 3.100,00",
                avista: "R$ 4.000,00",
                parcelas: "10x de R$ 250,00",
              },
            ],
            coberturasBasicas: { Casco: "100% FIPE" },
          },
          {
            index: 40,
            seguradora: "Delta",
            produto: "Auto",
            nome: "Plano Delta",
            opcoes: [
              {
                tipo: "Compreensiva",
                franquia: "Normal · R$ 3.100,00",
                avista: "R$ 5.000,00",
                parcelas: "10x de R$ 250,00",
              },
            ],
            coberturasBasicas: { Casco: "100% FIPE" },
          },
        ],
      },
    });
    expect(res.ok()).toBeTruthy();
    // O aviso lateral "COTAÇÃO FINALIZADA" (`cotacao-finalizada-aviso.tsx`)
    // não é o alvo deste spec e fica atrás do modal — marca vista de
    // antemão pra ele nunca aparecer e interceptar cliques.
    await marcarCalculoVistoE2E(fixture.cotacaoId);

    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
  });

  test.afterEach(async () => {
    if (fixture) await limparCotacaoQuiverFixture(fixture);
  });

  test("limite de 3: padrão marca as 3 primeiras, a 4ª fica bloqueada e a expressa respeita o limite", async ({
    page,
  }) => {
    await page.goto(`/venda/cotacoes/${fixture.cotacaoId}`);
    await page.getByRole("button", { name: "Imprimir comparativo" }).click();
    await page.getByText("Configurar impressão", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Configurar impressão" })).toBeVisible();

    await expect(page.getByText("3 de 4", { exact: false })).toBeVisible();
    const cards = page.locator(".pr-card");
    await expect(cards).toHaveCount(4);
    await expect(page.locator(".pr-card.on")).toHaveCount(3);
    await expect(cards.nth(3)).not.toHaveClass(/\bon\b/);

    // A 4ª não marca enquanto o limite estiver atingido.
    await cards.nth(3).click();
    await expect(page.getByText("3 de 4", { exact: false })).toBeVisible();
    await expect(cards.nth(3)).not.toHaveClass(/\bon\b/);

    // Desmarcar uma libera a 4ª.
    await cards.nth(0).click();
    await expect(page.getByText("2 de 4", { exact: false })).toBeVisible();
    await cards.nth(3).click();
    await expect(page.getByText("3 de 4", { exact: false })).toBeVisible();
    await expect(cards.nth(3)).toHaveClass(/\bon\b/);

    // "Nenhuma" limpa e vira "Primeiras 3".
    await page.getByRole("button", { name: "Nenhuma" }).click();
    await expect(page.getByText("0 de 4", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Primeiras 3" }).click();
    await expect(page.getByText("3 de 4", { exact: false })).toBeVisible();
  });

  test("Impressão expressa sai só com as 3 primeiras seguradoras", async ({ page }) => {
    await page.goto(`/venda/cotacoes/${fixture.cotacaoId}`);
    await page.getByRole("button", { name: "Imprimir comparativo" }).click();
    await page.getByText("Impressão expressa", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Impressão da cotação" })).toBeVisible();
    await expect(page.locator(".pv-resumo div", { hasText: "Seguradoras" })).toContainText("3");
    await expect(page.locator(".pv-doc .doc-seg")).toHaveCount(3);
  });
});
