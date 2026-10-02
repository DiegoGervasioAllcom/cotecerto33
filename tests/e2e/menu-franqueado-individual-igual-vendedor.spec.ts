import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import { criarPersona, limparPersona, type Persona } from "./provision";

/**
 * O menu lateral do franqueado INDIVIDUAL é o mesmo do vendedor (CLT): as duas
 * contas caem na nav de venda com "Minha agenda". A franquia FULL é diferente
 * (espelho da Matriz). Compara a lista completa de itens do menu, não só um
 * item marcador.
 */
async function itensDoMenu(page: Page, itemFinal: string): Promise<string[]> {
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
  await expect(page.locator(".nav-label").first()).toBeVisible({ timeout: 15_000 });
  const menu = page.getByRole("complementary");
  // A sidebar da franquia pinta vazia enquanto o escopo resolve: espera o último
  // item esperado do perfil antes de ler a lista (evita ler menu parcial).
  await expect(menu.getByRole("link", { name: itemFinal })).toBeVisible({ timeout: 15_000 });
  // Remove contadores/selos (ex.: "Atender agora 1 lead aguardando") para comparar só o rótulo.
  const textos = await menu.getByRole("link").allInnerTexts();
  return textos
    .map((t) =>
      t
        .replace(/\s+/g, " ")
        .replace(/\s*\d+.*$/, "")
        .trim(),
    )
    .filter(Boolean);
}

test.describe("menu lateral — franqueado Individual × vendedor (CLT) × Full", () => {
  let vendedor: Persona;
  let individual: Persona;
  let full: Persona;

  test.beforeAll(async () => {
    vendedor = await criarPersona({ role: "vendedor" });
    individual = await criarPersona({ role: "franqueado", modalidade: "individual" });
    full = await criarPersona({ role: "franqueado", modalidade: "full" });
  });

  test.afterAll(async () => {
    await limparPersona(vendedor);
    await limparPersona(individual);
    await limparPersona(full);
  });

  test("Individual tem exatamente o mesmo menu do vendedor, com Minha agenda; a Full não", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    const menuVendedor = await itensDoMenu(page, "Mensagens prontas");
    await page.context().clearCookies();
    await page.evaluate(() => window.localStorage.clear()).catch(() => {});

    await loginAs(page, individual.email, individual.senha);
    const menuIndividual = await itensDoMenu(page, "Mensagens prontas");
    await page.context().clearCookies();
    await page.evaluate(() => window.localStorage.clear()).catch(() => {});

    await loginAs(page, full.email, full.senha);
    const menuFull = await itensDoMenu(page, "Acessos e permissões");

    expect(menuVendedor).toContain("Minha agenda");
    expect(menuIndividual).toContain("Minha agenda");
    expect(menuIndividual).toEqual(menuVendedor);
    expect(menuFull).not.toContain("Minha agenda");
    expect(menuFull).not.toEqual(menuVendedor);
    expect(menuFull).toContain("Visão geral");
  });
});
