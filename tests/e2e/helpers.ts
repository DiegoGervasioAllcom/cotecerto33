import type { Page } from "@playwright/test";

/**
 * Faz login na tela /auth usando e-mail e senha, e aguarda a navegação
 * pós-login (o app redireciona automaticamente para a tela inicial do perfil).
 */
export async function loginAs(page: Page, email: string, senha: string) {
  await page.goto("/auth");
  // Os <label> do formulário não têm `for`/`id` associado ao input (não são
  // wrappers), então getByLabel não funciona aqui. Os campos são únicos na
  // página por `type`, o que é estável o suficiente.
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(senha);
  await page.getByRole("button", { name: /entrar/i }).click();
}
