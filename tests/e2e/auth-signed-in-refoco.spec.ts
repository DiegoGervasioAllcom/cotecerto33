import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import { criarPersona, limparPersona, type Persona } from "./provision";

test.describe("sessão autenticada ao recuperar o foco", () => {
  let vendedor: Persona;

  test.beforeAll(async () => {
    vendedor = await criarPersona({ role: "vendedor" });
  });

  test.afterAll(async () => {
    await limparPersona(vendedor);
  });

  test("refoco com a mesma sessão preserva rota e conteúdo sem remontar o splash global", async ({
    page,
    context,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).toHaveURL(/\/inicio$/, { timeout: 15_000 });
    const saudacao = page.getByRole("heading", { name: /^Olá,/ });
    await expect(saudacao).toBeVisible();

    const urlAntesDoRefoco = page.url();
    await page.locator("main.main").evaluate((main) => {
      main.setAttribute("data-auth-refoco-sentinel", "preservado");
      (
        window as typeof window & { authSplashGlobalObservado?: boolean }
      ).authSplashGlobalObservado = false;
      new MutationObserver(() => {
        const splashGlobal = [...document.querySelectorAll(".auth-stage")].some(
          (element) => element.textContent?.trim() === "Carregando…",
        );
        if (splashGlobal) {
          (
            window as typeof window & { authSplashGlobalObservado?: boolean }
          ).authSplashGlobalObservado = true;
        }
      }).observe(document.body, { childList: true, subtree: true });
    });

    const segundaAba = await context.newPage();
    await segundaAba.goto("about:blank");
    await segundaAba.bringToFront();

    await page.bringToFront();
    // O Chromium headless mantém visibilityState="visible" mesmo após bringToFront
    // em outra aba. Disparamos os eventos nativos que os clientes de auth observam
    // ao recuperar uma aba; não há mock do Supabase nem hook no código de produção.
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await page.waitForTimeout(1_000);

    expect(page.url()).toBe(urlAntesDoRefoco);
    await expect(page.locator('main.main[data-auth-refoco-sentinel="preservado"]')).toBeVisible();
    await expect(saudacao).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { authSplashGlobalObservado?: boolean })
              .authSplashGlobalObservado,
        ),
      )
      .toBe(false);
  });
});
