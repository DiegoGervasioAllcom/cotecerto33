import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import { criarPersona, desligarUsuarioE2E, limparPersona, type Persona } from "./provision";

const MENSAGEM_DESLIGADO = "Seu acesso está desativado. Entre em contato com a Matriz.";

async function existeSessaoSupabase(page: Page) {
  return page.evaluate(() =>
    Object.entries(localStorage).some(([key, value]) => {
      if (!key.endsWith("-auth-token")) return false;
      try {
        const parsed = JSON.parse(value) as { access_token?: string };
        return Boolean(parsed.access_token);
      } catch {
        return false;
      }
    }),
  );
}

test.describe("login de usuário desligado", () => {
  let vendedor: Persona;

  test.beforeEach(async () => {
    vendedor = await criarPersona({ role: "vendedor" });
  });

  test.afterEach(async () => {
    await limparPersona(vendedor);
  });

  test("usuário aprovado entra; após desligamento, sessão antiga sai e a URL não oscila", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await expect.poll(() => existeSessaoSupabase(page)).toBe(true);

    await desligarUsuarioE2E(vendedor.userId);

    const navegacoesDepoisDoDesligamento: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame())
        navegacoesDepoisDoDesligamento.push(new URL(frame.url()).pathname);
    });
    await page.reload();

    await expect(page).toHaveURL(/\/auth\/?$/, { timeout: 15_000 });
    await expect(page.getByText(MENSAGEM_DESLIGADO, { exact: true })).toBeVisible();
    await expect.poll(() => existeSessaoSupabase(page)).toBe(false);

    // A navegação inicial /inicio -> /auth é esperada após o reload. A partir
    // do primeiro /auth, nenhuma rota protegida pode reaparecer (o bug antigo
    // alternava continuamente entre /auth e /inicio).
    navegacoesDepoisDoDesligamento.length = 0;
    await page.waitForTimeout(1_500);
    await expect(page).toHaveURL(/\/auth\/?$/);
    expect(navegacoesDepoisDoDesligamento.filter((url) => url !== "/auth")).toEqual([]);

    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/auth\/?$/);
  });

  test("tentativa de login de usuário já desligado permanece no auth sem sessão", async ({
    page,
  }) => {
    await desligarUsuarioE2E(vendedor.userId);

    const rotas: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) rotas.push(new URL(frame.url()).pathname);
    });
    await loginAs(page, vendedor.email, vendedor.senha, { expectStayOnAuth: true });

    await expect(page).toHaveURL(/\/auth\/?$/, { timeout: 15_000 });
    await expect(page.getByText(MENSAGEM_DESLIGADO, { exact: true })).toBeVisible();
    await expect.poll(() => existeSessaoSupabase(page)).toBe(false);

    await page.waitForTimeout(1_500);
    await expect(page).toHaveURL(/\/auth\/?$/);
    expect(rotas.filter((url) => url !== "/auth")).toEqual([]);
  });
});
