import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import { criarVendedorComLead, limparVendedorComLead, type VendedorComLead } from "./provision";

test.describe("pipeline — lead externo recebido", () => {
  let vendedorTabela: VendedorComLead;
  let vendedorKanban: VendedorComLead;

  test.beforeAll(async () => {
    [vendedorTabela, vendedorKanban] = await Promise.all([
      criarVendedorComLead({ statusPipeline: "qualificado" }),
      criarVendedorComLead({ statusPipeline: "qualificado" }),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([
      limparVendedorComLead(vendedorTabela),
      limparVendedorComLead(vendedorKanban),
    ]);
  });

  test("filtro e tabela exibem Qualificando; clique na linha assume e abre wizard com id", async ({
    page,
  }) => {
    await loginAs(page, vendedorTabela.email, vendedorTabela.senha);
    await page.goto("/venda/pipeline");

    await page.getByRole("button", { name: "Tabela" }).click();
    await page
      .locator("select")
      .filter({ has: page.locator('option[value="contato"]') })
      .selectOption("contato");
    const linha = page.locator("tbody tr", { hasText: "Cliente E2E" }).first();
    await expect(linha).toBeVisible();
    await expect(linha.getByText("Qualificando", { exact: true })).toBeVisible();
    await linha.click();

    await expect(page).toHaveURL(/\/venda\/novo-lead\?id=[^&]+&step=0/);
    await expect(page.getByRole("heading", { name: "Dados do Segurado" })).toBeVisible();
    await expect(page.getByText(/não veio da Central/i)).toHaveCount(0);
  });

  test("card qualificado aparece em Qualificando; clique assume e abre wizard com id", async ({
    page,
  }) => {
    await loginAs(page, vendedorKanban.email, vendedorKanban.senha);
    await page.goto("/venda/pipeline");

    const colunaQualificando = page.locator('.kcol[data-stage="Qualificando"]');
    const card = colunaQualificando.getByText("Cliente E2E", { exact: false });
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(/\/venda\/novo-lead\?id=[^&]+&step=0/);
    await expect(page.getByRole("heading", { name: "Dados do Segurado" })).toBeVisible();
    await expect(page.getByText(/não veio da Central/i)).toHaveCount(0);
  });

  test("botão Lead Manual continua sendo a entrada do modal manual", async ({ page }) => {
    await loginAs(page, vendedorTabela.email, vendedorTabela.senha);
    await page.goto("/venda/pipeline");
    await page.getByRole("main").getByRole("link", { name: "Lead Manual" }).click();

    await expect(page).toHaveURL(/\/venda\/novo-lead$/);
    await expect(page.getByText(/não veio da Central/i)).toBeVisible();
  });
});
