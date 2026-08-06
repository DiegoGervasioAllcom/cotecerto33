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

    await expect(page).toHaveURL(/\/inicio$/);

    await expect(page.getByRole("link", { name: "Lead Manual" })).toBeVisible();
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
    await expect(page.getByRole("link", { name: "Lead Manual" })).toHaveCount(0);
  });
});

test.describe("navegação por perfil — grpLike (master/supervisor)", () => {
  let master: Persona;
  let supervisor: Persona;

  test.beforeAll(async () => {
    [master, supervisor] = await Promise.all([
      criarPersona({ role: "master" }),
      // V11: o supervisor precisa de cargo — o menu dele vem das áreas do cargo.
      criarPersona({ role: "supervisor", cargo: "sup_vendas" }),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([limparPersona(master), limparPersona(supervisor)]);
  });

  test("master vê a nav de GRUPO (Vendedores) e não vê Novo lead/Distribuição", async ({
    page,
  }) => {
    await loginAs(page, master.email, master.senha);
    await navPronta(page);

    await expect(page).toHaveURL(/\/comando\/visao-geral$/);

    await expect(page.getByRole("link", { name: "Visão geral" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Vendedores" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lead Manual" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Distribuição" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Configurações" })).toHaveCount(0);
    await expect(page.getByText("MASTER", { exact: true }).first()).toBeVisible();
  });

  /**
   * V11: o supervisor saiu da nav de GRUPO e virou time interno da Matriz, com o
   * menu recortado pelas ÁREAS do cargo. Para `sup_vendas` o protótipo r40 define
   * 10 áreas — inclui Vendedores e Supervisão, e não inclui Distribuição (que é
   * do Supervisor Operacional) nem Leads.
   *
   * O selo também mudou: mostra o CARGO, não o perfil, porque os três
   * supervisores moram no mesmo `perfil` e ele não distingue.
   */
  test("Supervisor de Vendas vê o menu do cargo dele e não vê Novo lead/Distribuição", async ({
    page,
  }) => {
    await loginAs(page, supervisor.email, supervisor.senha);
    await navPronta(page);

    await expect(page.getByRole("link", { name: "Vendedores" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Supervisão" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Aprovações" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lead Manual" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Distribuição" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Configurações" })).toHaveCount(0);
    await expect(page.getByText("SUPERVISOR DE VENDAS", { exact: true }).first()).toBeVisible();
  });
});

/**
 * V11.5.2a: a franquia Full sai do `grpLike` (12 itens, igual Master) e ganha
 * o espelho de 15 áreas da Matriz — regra 8 das Regras Decididas (Lis,
 * 26/07/2026): "de fora só Franquias e Configurações globais". Por isso ela
 * agora vê Leads/Distribuição (que master nunca viu), mas continua sem
 * Franquias/Configurações (exclusivas da Matriz) e sem a nav de venda.
 */
test.describe("navegação por perfil — fullLike (franquia Full)", () => {
  let franquiaFull: Persona;

  test.beforeAll(async () => {
    franquiaFull = await criarPersona({ role: "franqueado", modalidade: "full" });
  });

  test.afterAll(async () => {
    await limparPersona(franquiaFull);
  });

  test("franquia Full vê o espelho da Matriz (Leads/Distribuição) e não vê Franquias/Configurações/Novo lead", async ({
    page,
  }) => {
    await loginAs(page, franquiaFull.email, franquiaFull.senha);
    await navPronta(page);

    await expect(page).toHaveURL(/\/comando\/visao-geral$/);

    // Sidebar (role complementary) — a home de venda em /inicio também renderiza
    // um botão "Mensagens" (pra /venda/mensagens-prontas) com o mesmo nome
    // acessível; escopar ao menu evita colisão com esse atalho não relacionado.
    const menu = page.getByRole("complementary");
    await expect(menu.getByRole("link", { name: "Vendedores" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Leads" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Distribuição" })).toBeVisible();
    // V11.5.2b: Mensagens ficou de fora do menu da Full — a tela mantém o
    // guard `useRequireRole("matriz")` (mistura escopo global/pessoal, fora
    // do recorte desta task, que é só leads/distribuição/SLA/canais).
    await expect(menu.getByRole("link", { name: "Mensagens" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Franquias" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Configurações" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Lead Manual" })).toHaveCount(0);
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

    await expect(page).toHaveURL(/\/inicio$/);

    await expect(page.getByRole("link", { name: "Lead Manual" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Vendedores" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Configurações" })).toHaveCount(0);
    await expect(page.getByText("· individual")).toBeVisible();
  });
});
