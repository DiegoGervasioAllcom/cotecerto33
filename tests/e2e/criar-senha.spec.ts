import { expect, test } from "@playwright/test";
import { criarLinkRecoveryE2E, limparUsuarioAuth } from "./provision";

test.describe("Boas-vindas — criação de senha", () => {
  test("link ausente mostra estado inválido sem formulário", async ({ page }) => {
    await page.goto("/auth/criar-senha");
    await expect(page.getByText(/link é inválido, já foi usado ou expirou/i)).toBeVisible();
    await expect(page.locator("#nova-senha")).toHaveCount(0);
  });

  test("link recovery válido cria senha e vira uso único", async ({ page }) => {
    const fixture = await criarLinkRecoveryE2E();
    try {
      await page.goto(fixture.actionLink);
      await expect(page.getByText(/Link válido.*48 horas/i)).toBeVisible({ timeout: 15_000 });
      await page.locator("#nova-senha").fill("NovaSenha456");
      await page.locator("#confirmar-senha").fill("NovaSenha456");
      await page.getByRole("button", { name: /Criar senha e entrar/i }).click();
      await expect(page.getByText(/Senha criada!/i)).toBeVisible({ timeout: 15_000 });

      await page.goto(fixture.actionLink);
      await expect(page.getByText(/link é inválido, já foi usado ou expirou/i)).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await limparUsuarioAuth(fixture.userId);
    }
  });
});
