import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarVendedorComLead,
  limparVendedorComLead,
  criarPersona,
  limparPersona,
  type VendedorComLead,
  type Persona,
} from "./provision";

/**
 * E2E de navegação das 6 personas (T3): valida o gating de sidebar do G1.6a
 * (`app-shell.tsx` + `group-scope.ts`). Não somos exaustivos com todos os
 * itens de cada grupo — conferimos um item "marcador" que só existe naquela
 * experiência (presença) e os marcadores das outras duas experiências
 * (ausência), o que já cobre a regra de negócio (venLike vs grpLike vs matriz).
 */

const MATRIZ_EMAIL = "desenvolvimento@suppercerto.com.br";
const MATRIZ_SENHA = "Supper@123!";

async function navPronta(page: Page) {
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
  // A sidebar só pinta os grupos depois que auth+group-scope resolvem; espera
  // qualquer nav-label aparecer antes de asserir presença/ausência de itens,
  // pra não pegar o instante "loading" (sidebar vazia) do franqueado.
  await expect(page.locator(".nav-label").first()).toBeVisible({ timeout: 15_000 });
}

test.describe("navegação por perfil — venLike (vendedor)", () => {
  let vendedor: VendedorComLead;

  test.beforeAll(async () => {
    vendedor = await criarVendedorComLead();
  });

  test.afterAll(async () => {
    await limparVendedorComLead(vendedor);
  });

  test("vendedor vê a nav de VENDA (Novo lead) e não vê a de grupo/matriz", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await navPronta(page);

    await expect(page.getByRole("link", { name: "Novo lead" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Vendedores" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Configurações" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Distribuição" })).toHaveCount(0);
  });
});

test.describe("navegação por perfil — matriz", () => {
  test("admin da matriz vê Distribuição/Configurações e não vê Novo lead", async ({ page }) => {
    await loginAs(page, MATRIZ_EMAIL, MATRIZ_SENHA);
    await navPronta(page);

    await expect(page.getByRole("link", { name: "Distribuição" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Configurações" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Novo lead" })).toHaveCount(0);
  });
});

test.describe("navegação por perfil — grpLike (master/supervisor/franquia Full)", () => {
  let master: Persona;
  let supervisor: Persona;
  let franquiaFull: Persona;

  test.beforeAll(async () => {
    [master, supervisor, franquiaFull] = await Promise.all([
      criarPersona({ role: "master" }),
      criarPersona({ role: "supervisor" }),
      criarPersona({ role: "franqueado", modalidade: "full" }),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([
      limparPersona(master),
      limparPersona(supervisor),
      limparPersona(franquiaFull),
    ]);
  });

  test("master vê a nav de GRUPO (Vendedores) e não vê Novo lead/Distribuição", async ({
    page,
  }) => {
    await loginAs(page, master.email, master.senha);
    await navPronta(page);

    await expect(page.getByRole("link", { name: "Visão geral" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Vendedores" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Novo lead" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Distribuição" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Configurações" })).toHaveCount(0);
    await expect(page.getByText("MASTER", { exact: true }).first()).toBeVisible();
  });

  test("supervisor vê a nav de GRUPO (Vendedores) e não vê Novo lead/Distribuição", async ({
    page,
  }) => {
    await loginAs(page, supervisor.email, supervisor.senha);
    await navPronta(page);

    await expect(page.getByRole("link", { name: "Vendedores" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Supervisão" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Novo lead" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Distribuição" })).toHaveCount(0);
    await expect(page.getByText("SUPERVISOR", { exact: true }).first()).toBeVisible();
  });

  test("franquia Full vê a nav de GRUPO (Vendedores) e não vê Novo lead/Distribuição", async ({
    page,
  }) => {
    await loginAs(page, franquiaFull.email, franquiaFull.senha);
    await navPronta(page);

    await expect(page.getByRole("link", { name: "Vendedores" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Novo lead" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Distribuição" })).toHaveCount(0);
    // franquia Full não é "· individual" no avatar (esse selo só sai na Individual).
    await expect(page.getByText("· individual")).toHaveCount(0);
  });
});

test.describe("navegação por perfil — franquia Individual (venLike)", () => {
  let franquiaIndividual: Persona;

  test.beforeAll(async () => {
    franquiaIndividual = await criarPersona({ role: "franqueado", modalidade: "individual" });
  });

  test.afterAll(async () => {
    await limparPersona(franquiaIndividual);
  });

  test("franquia Individual vê a nav de VENDA (Novo lead) e o selo · individual", async ({
    page,
  }) => {
    await loginAs(page, franquiaIndividual.email, franquiaIndividual.senha);
    await navPronta(page);

    await expect(page.getByRole("link", { name: "Novo lead" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Vendedores" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Configurações" })).toHaveCount(0);
    await expect(page.getByText("· individual")).toBeVisible();
  });
});
