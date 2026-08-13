import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarVendedorComLead,
  limparVendedorComLead,
  criarPersona,
  distribuirLeadE2E,
  limparLeadE2E,
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

function vigiarConsultasFilaAtender(page: Page) {
  const consultas: string[] = [];
  const listener = (request: { url(): string }) => {
    const url = new URL(request.url());
    if (
      url.pathname.endsWith("/rest/v1/leads") &&
      url.searchParams.get("select") ===
        "id,nome,contato,origem,valor,criado_em,distribuido_em,dados,bloqueado" &&
      url.searchParams.get("responsavel_id")?.startsWith("eq.") &&
      url.searchParams.get("status_pipeline") === "eq.novo" &&
      url.searchParams.get("arquivado") === "eq.false" &&
      url.searchParams.get("ultimo_atendimento_em") === "is.null"
    ) {
      consultas.push(request.url());
    }
  };
  page.on("request", listener);
  return {
    consultas,
    parar: () => page.off("request", listener),
  };
}

async function expectAcessoDiretoAtenderNegado(page: Page) {
  const fila = vigiarConsultasFilaAtender(page);
  try {
    await page.goto("/venda/atender");
    await expect(page).toHaveURL(/\/comando\/visao-geral$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Atender agora" })).toHaveCount(0);
    // Dá tempo para denunciar query montada antes do guard ou efeito tardio após o redirect.
    await page.waitForTimeout(500);
    expect(fila.consultas).toEqual([]);
  } finally {
    fila.parar();
  }
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
    await expect(page.getByRole("link", { name: /Atender agora/ })).toHaveCount(0);
    await expect(
      page.locator('[data-tour="shell-react-pill"]', { hasText: "Atender agora" }),
    ).toHaveCount(0);
    await expectAcessoDiretoAtenderNegado(page);
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
    await expect(page.getByRole("link", { name: /Atender agora/ })).toHaveCount(0);
    await expect(
      page.locator('[data-tour="shell-react-pill"]', { hasText: "Atender agora" }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Distribuição" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Configurações" })).toHaveCount(0);
    await expect(page.getByText("MASTER", { exact: true }).first()).toBeVisible();
    await expectAcessoDiretoAtenderNegado(page);
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
    await expect(page.getByRole("link", { name: /Atender agora/ })).toHaveCount(0);
    await expect(
      page.locator('[data-tour="shell-react-pill"]', { hasText: "Atender agora" }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Distribuição" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Configurações" })).toHaveCount(0);
    await expect(page.getByText("SUPERVISOR DE VENDAS", { exact: true }).first()).toBeVisible();
    await expectAcessoDiretoAtenderNegado(page);
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
    await expect(page.getByRole("link", { name: /Atender agora/ })).toHaveCount(0);
    await expect(
      page.locator('[data-tour="shell-react-pill"]', { hasText: "Atender agora" }),
    ).toHaveCount(0);
    // franquia Full não é "· individual" no avatar (esse selo só sai na Individual).
    await expect(page.getByText("· individual")).toHaveCount(0);
    await expectAcessoDiretoAtenderNegado(page);
  });
});

test.describe("navegação por perfil — franquia Individual (venLike)", () => {
  let franquiaIndividual: Persona;
  let leadId: string;

  test.beforeAll(async () => {
    franquiaIndividual = await criarPersona({ role: "franqueado", modalidade: "individual" });
    leadId = await distribuirLeadE2E(franquiaIndividual.userId, franquiaIndividual.empresaId);
  });

  test.afterAll(async () => {
    await limparLeadE2E(leadId);
    await limparPersona(franquiaIndividual);
  });

  test("franquia Individual vê a nav de VENDA (Novo lead) e o selo · individual", async ({
    page,
  }) => {
    await loginAs(page, franquiaIndividual.email, franquiaIndividual.senha);
    await navPronta(page);

    await expect(page).toHaveURL(/\/inicio$/);

    await expect(page.getByRole("link", { name: "Lead Manual" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Atender agora.*1 lead aguardando/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-tour="shell-react-pill"]')).toContainText("1Atender agora");
    await expect(page.getByRole("link", { name: "Vendedores" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Configurações" })).toHaveCount(0);
    await expect(page.getByText("· individual")).toBeVisible();
  });

  /**
   * QA 10/08/2026: `/operacao/xacessos` (Acessos da equipe — master/franquia
   * Full) não tinha guard nenhum. A Individual (mesmo `role` da Full, sem
   * menu para esta tela) conseguia abrir por URL direta e via "Convidar
   * vendedor" plenamente funcional, apesar de ela operar como um vendedor,
   * sem cadastro de vendedores — ver `useRequireGrupoAcessos`.
   */
  test("franquia Individual é redirecionada ao acessar /operacao/xacessos por URL direta", async ({
    page,
  }) => {
    await loginAs(page, franquiaIndividual.email, franquiaIndividual.senha);
    await navPronta(page);

    await page.goto("/operacao/xacessos");
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByRole("button", { name: "Convidar vendedor" })).toHaveCount(0);
  });
});
