// Mini-app mobile (/m/*): lista de recentes, detalhe, wizard de cotar e banner
// sugerindo a versão mobile nas telas desktop. Viewport de celular (Pixel 7).
import { devices, expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarVendedorComLeadEmCotacao,
  limparVendedorComLeadEmCotacao,
  type VendedorComLeadEmCotacao,
} from "./provision";

test.use({ ...devices["Pixel 7"] });

test.describe.serial("mobile — cotações (/m)", () => {
  let vendedor: VendedorComLeadEmCotacao;

  test.beforeAll(async () => {
    vendedor = await criarVendedorComLeadEmCotacao();
  });

  test.afterAll(async () => {
    if (vendedor) await limparVendedorComLeadEmCotacao(vendedor);
  });

  test("lista de recentes mostra a cotação do vendedor, sem scroll horizontal", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/m/cotacoes");
    await expect(page.getByRole("link", { name: /rascunho/i }).first()).toBeVisible();
    const larguraOk = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(larguraOk).toBe(true);
    await expect(page.getByRole("link", { name: /cotar/i })).toBeVisible();
  });

  test("detalhe da cotação abre e oferece a versão completa", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto(`/m/cotacoes/${vendedor.cotacaoId}`);
    await expect(page.getByRole("link", { name: /versão completa/i })).toBeVisible();
  });

  test("wizard /m/cotar abre no passo Segurado", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/m/cotar");
    await expect(page.getByText(/segurado/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /continuar/i })).toBeVisible();
  });

  test("login no celular cai direto em /m/cotacoes", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).toHaveURL(/\/m\/cotacoes/);
  });

  test("versão completa grava preferência; banner volta ao mobile e a remove", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/m/menu");
    await page.getByRole("link", { name: /versão completa/i }).click();
    await expect(page).toHaveURL(/\/inicio/);
    await page.reload();
    await expect(page).toHaveURL(/\/inicio/);
    const banner = page.getByRole("button", { name: /usar versão mobile/i });
    await expect(banner).toBeVisible();
    await banner.click();
    await expect(page).toHaveURL(/\/m\/cotacoes/);
    expect(await page.evaluate(() => localStorage.getItem("cc:versao-preferida"))).toBeNull();
  });

  test("banner pode ser dispensado (com preferência completa)", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.evaluate(() => localStorage.setItem("cc:versao-preferida", "completa"));
    await page.goto("/inicio");
    const banner = page.getByRole("button", { name: /usar versão mobile/i });
    await expect(banner).toBeVisible();
    await page.getByRole("button", { name: /agora não/i }).click();
    await expect(banner).toBeHidden();
  });
});

test.describe("desktop não é redirecionado", () => {
  const { defaultBrowserType: _ignorado, ...desktop } = devices["Desktop Chrome"];
  test.use(desktop);
  test("fica na landing", async ({ page }) => {
    const v = await criarVendedorComLeadEmCotacao();
    try {
      await loginAs(page, v.email, v.senha);
      await page.waitForTimeout(1_000);
      await expect(page).not.toHaveURL(/\/m\//);
    } finally {
      await limparVendedorComLeadEmCotacao(v);
    }
  });
});
