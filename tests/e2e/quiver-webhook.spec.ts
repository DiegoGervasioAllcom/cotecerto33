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
          { seguradora: "Porto", opcoes: [{ tipo: "Compreensiva", avista: "1.850,00" }] },
          { seguradora: "Azul", opcoes: [{ tipo: "Compreensiva", avista: "1.920,50" }] },
        ],
      },
    });
    expect(res.ok()).toBeTruthy();

    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

    await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
    await expect(page.getByText(/seguradoras calculadas/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Porto")).toBeVisible();
    await expect(page.getByText("Azul")).toBeVisible();

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
});
