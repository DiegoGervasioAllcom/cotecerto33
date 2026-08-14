import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarDistribuicaoMovidaFixture,
  criarPersona,
  lerDestinoLeadMovidaE2E,
  limparDistribuicaoMovidaFixture,
  limparPersona,
  type DistribuicaoMovidaFixture,
  type Persona,
} from "./provision";

const MATRIZ_EMAIL = "desenvolvimento@suppercerto.com.br";
const MATRIZ_SENHA = "Supper@123!";

test.describe.serial("V11.9.6 — distribuição Movida por loja", () => {
  let fixture: DistribuicaoMovidaFixture;
  let intruso: Persona;

  test.beforeAll(async () => {
    fixture = await criarDistribuicaoMovidaFixture();
    intruso = await criarPersona({ role: "vendedor" });
  });

  test.afterAll(async () => {
    await limparDistribuicaoMovidaFixture(fixture);
    await limparPersona(intruso);
  });

  test("matriz cria rota com vendedor único e reprocessa o lead da Fila Global", async ({
    page,
  }) => {
    await loginAs(page, MATRIZ_EMAIL, MATRIZ_SENHA);
    await page.goto("/comando/distribuicao");
    await expect(page.getByRole("heading", { name: "Captação Movida por loja" })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Nova rota" }).click();
    await page.locator('input[name="nome"]').fill(fixture.lojaNome);
    await page.locator('input[name="alias"]').fill(fixture.alias);
    await page.locator('select[name="empresaId"]').selectOption({ label: fixture.empresaNome });
    await page.getByLabel("Exigir vendedor online").check();
    await page.getByRole("button", { name: "Criar rota" }).click();
    await expect(page.getByText("Rota Movida criada.")).toBeVisible({ timeout: 10_000 });

    // O requisito online é configurável, mas fica desligado neste cenário para
    // que o vendedor único seja elegível e o reprocessamento tenha caminho feliz.
    await page.getByLabel("Exigir vendedor online").uncheck();
    await page.getByRole("button", { name: "Salvar rota" }).click();
    await expect(page.getByText("Rota Movida atualizada.")).toBeVisible({ timeout: 10_000 });

    await page.locator('input[name="peso"]').fill("3");
    await page.locator('input[name="limiteDiario"]').fill("1");
    const vendedorSelect = page.locator('select[name="vendedorId"]');
    await vendedorSelect.selectOption({ label: fixture.vendedor.nome });
    await expect(vendedorSelect).toHaveValue(fixture.vendedor.userId);
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByText("Vendedor adicionado ao pool.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Peso 3 · limite diário 1")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Reprocessar pendentes" }).click();
    await expect(
      page.getByText("1 de 1 lead(s) distribuído(s); 0 permaneceram na Fila Global."),
    ).toBeVisible({ timeout: 10_000 });

    await expect
      .poll(() => lerDestinoLeadMovidaE2E(fixture.leadId))
      .toEqual({
        empresa_id: fixture.vendedor.empresaId,
        responsavel_id: fixture.vendedor.userId,
      });
  });

  test("vendedor comum não acessa a configuração Movida por URL direta", async ({ page }) => {
    await loginAs(page, intruso.email, intruso.senha);
    await page.goto("/comando/distribuicao");
    await expect(page).toHaveURL(/\/inicio$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Captação Movida por loja" })).toHaveCount(0);
  });
});
