import type { Page } from "@playwright/test";

/**
 * Faz login na tela /auth usando e-mail e senha, e aguarda a navegação
 * pós-login (o app redireciona automaticamente para a tela inicial do perfil).
 */
export async function loginAs(page: Page, email: string, senha: string) {
  // Docker Desktop pode recusar uma conexão isolada logo após o reset/start
  // do Supabase. Repetimos apenas o login enquanto a própria tela /auth
  // permanece aberta; nunca mascaramos falha depois da autenticação.
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    await page.goto("/auth");
    // Os <label> do formulário não têm `for`/`id` associado ao input (não são
    // wrappers), então getByLabel não funciona aqui. Os campos são únicos na
    // página por `type`, o que é estável o suficiente.
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(senha);
    await page.getByRole("button", { name: /entrar/i }).click();
    try {
      await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 5_000 });
      return;
    } catch {
      if (tentativa === 3) throw new Error(`login não saiu de /auth após ${tentativa} tentativas`);
      await page.waitForTimeout(300);
    }
  }
}
