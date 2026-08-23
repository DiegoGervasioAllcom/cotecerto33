import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarPersona,
  criarVendedorComLead,
  definirAreasPersona,
  limparPersona,
  limparVendedorComLead,
  type Persona,
  type VendedorComLead,
} from "./provision";

const MATRIZ_EMAIL = "desenvolvimento@suppercerto.com.br";
const MATRIZ_SENHA = "Supper@123!";

async function esperarLogin(page: Page) {
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
  await expect(page.locator(".nav-label").first()).toBeVisible({ timeout: 15_000 });
}

async function abrirSemRedirecionar(page: Page, rota: string) {
  await page.goto(rota);
  await expect(page).toHaveURL(new RegExp(`${rota.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?$`), {
    timeout: 15_000,
  });
  await expect(page.getByText("Acesso restrito")).toHaveCount(0);
}

test.describe("regressões da auditoria visual V11", () => {
  test("Pipeline geral renderiza veículo estruturado sem crash do React", async ({ page }) => {
    let vendedor: VendedorComLead | undefined;
    try {
      vendedor = await criarVendedorComLead();
      await loginAs(page, MATRIZ_EMAIL, MATRIZ_SENHA);
      await esperarLogin(page);

      await abrirSemRedirecionar(page, "/operacao/pipeline-geral");
      await expect(page.getByText("FIAT UNO 2020")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Objects are not valid as a React child/)).toHaveCount(0);
    } finally {
      if (vendedor) await limparVendedorComLead(vendedor);
    }
  });

  test("Coordenador abre as 17 áreas anunciadas e administra Configurações por completo", async ({
    page,
  }) => {
    let coordenador: Persona | undefined;
    try {
      coordenador = await criarPersona({ role: "coordenador", cargo: "coord_com" });
      await loginAs(page, coordenador.email, coordenador.senha);
      await esperarLogin(page);

      const links = page.getByRole("complementary").getByRole("link");
      await expect(links).toHaveCount(17);
      for (const rota of [
        "/comando/leads",
        "/comando/distribuicao",
        "/operacao/franquias",
        "/operacao/mensagens",
        "/operacao/configuracoes",
      ]) {
        await abrirSemRedirecionar(page, rota);
      }
      // Revisão 22/08/2026: a área já decidiu quem entra (17 áreas concedidas
      // ao Coordenador); quem entra administra por completo — sem modo
      // somente-leitura por baixo da decisão da Matriz.
      await expect(page.getByRole("heading", { name: "Configurações" }).last()).toBeVisible();
      await expect(page.getByText("Somente leitura.")).toHaveCount(0);
      await expect(page.getByRole("spinbutton").first()).toBeEnabled();
    } finally {
      if (coordenador) await limparPersona(coordenador);
    }
  });

  test("Supervisores Operacional e Backoffice abrem Leads e Distribuição", async ({ page }) => {
    const personas: Persona[] = [];
    try {
      personas.push(
        await criarPersona({ role: "supervisor", cargo: "sup_operacional" }),
        await criarPersona({ role: "supervisor", cargo: "sup_backoffice" }),
      );

      for (const persona of personas) {
        await loginAs(page, persona.email, persona.senha);
        await esperarLogin(page);
        await abrirSemRedirecionar(page, "/comando/leads");
        await abrirSemRedirecionar(page, "/comando/distribuicao");
        await page.context().clearCookies();
        await page.evaluate(() => localStorage.clear());
      }
    } finally {
      await Promise.all(personas.map(limparPersona));
    }
  });

  test("override bloqueia URL removida e concede Configurações/Acessos por completo para interno", async ({
    page,
  }) => {
    let supervisor: Persona | undefined;
    let consulta: Persona | undefined;
    try {
      supervisor = await criarPersona({ role: "supervisor", cargo: "sup_vendas" });
      await definirAreasPersona(supervisor.userId, ["mdash", "mrel"]);
      await loginAs(page, supervisor.email, supervisor.senha);
      await esperarLogin(page);
      await page.goto("/operacao/aprovacoes");
      await expect(page).toHaveURL(/\/comando\/visao-geral$/);
      await expect(page.getByRole("link", { name: "Aprovações" })).toHaveCount(0);

      await page.context().clearCookies();
      await page.evaluate(() => localStorage.clear());
      // Revisão 22/08/2026: a área é o único portão — um cargo sem alçada
      // nenhuma (marketing) que recebe `macessos`/`mconf` da Matriz administra
      // as duas telas por completo, sem modo somente-leitura por baixo.
      consulta = await criarPersona({ role: "interno", cargo: "marketing" });
      await definirAreasPersona(consulta.userId, ["macessos", "mconf"]);
      await loginAs(page, consulta.email, consulta.senha);
      await esperarLogin(page);

      await abrirSemRedirecionar(page, "/operacao/acessos");
      await expect(page.getByText("Somente leitura.")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Convidar · time interno" })).toBeVisible();
      await abrirSemRedirecionar(page, "/operacao/configuracoes");
      await expect(page.getByText("Somente leitura.")).toHaveCount(0);
      await expect(page.getByRole("spinbutton").first()).toBeEnabled();
    } finally {
      if (consulta) await limparPersona(consulta);
      if (supervisor) await limparPersona(supervisor);
    }
  });
});
