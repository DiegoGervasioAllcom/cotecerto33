import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  adicionarRoleE2E,
  criarPersona,
  desligarUsuarioE2E,
  limparPersona,
  limparPersonaSemEmpresa,
  type Persona,
} from "./provision";

/**
 * Regressão da auditoria de persona Master: os filtros de Pipeline e
 * Relatórios precisam listar só quem efetivamente vende na rede ativa. Uma
 * franquia Full é parte da rede, mas não é vendedor; o próprio Master também
 * não. Um perfil que acumula `vendedor` e `coordenador` tampouco é elegível:
 * a função de filtro precisa reconhecer sua atribuição de gestão, sem
 * depender de uma única role retornada. O vendedor suspenso continua visível
 * pela hierarquia, portanto o cenário impede que a UI dependa apenas do
 * escopo retornado pela RLS.
 */
async function esperarSomenteVendedoresAtivos(
  page: Page,
  rota: "/operacao/pipeline-geral" | "/operacao/relatorios",
  vendedores: Persona[],
  naoVendedores: Persona[],
) {
  await page.goto(rota);

  const rotulo = rota === "/operacao/pipeline-geral" ? /^Vendedor$/ : /^Todos os vendedores$/;
  const filtroVendedor = page
    .locator(".filters-bar select")
    .filter({ has: page.locator("option", { hasText: rotulo }) });
  await expect(filtroVendedor).toHaveCount(1);
  await expect(filtroVendedor.locator("option", { hasText: vendedores[0].nome })).toHaveCount(1);

  const opcoes = await filtroVendedor.locator("option").allTextContents();
  const esperado = [
    rota === "/operacao/pipeline-geral" ? "Vendedor" : "Todos os vendedores",
    ...vendedores.map((vendedor) => vendedor.nome),
  ];
  expect([...opcoes].sort()).toEqual([...esperado].sort());

  for (const persona of naoVendedores) {
    expect(opcoes).not.toContain(persona.nome);
  }
}

test.describe.serial("filtros de vendedores da persona Master", () => {
  let master: Persona;
  let vendedorProprio: Persona;
  let franquiaFull: Persona;
  let vendedorDaFull: Persona;
  let vendedorCoordenador: Persona;
  let vendedorSuspenso: Persona;

  test.beforeAll(async () => {
    master = await criarPersona({ role: "master" });
    vendedorProprio = await criarPersona({ role: "vendedor", superiorId: master.userId });
    franquiaFull = await criarPersona({
      role: "franqueado",
      modalidade: "full",
      superiorId: master.userId,
    });
    vendedorDaFull = await criarPersona({
      role: "vendedor",
      empresaId: franquiaFull.empresaId,
      superiorId: franquiaFull.userId,
    });
    vendedorCoordenador = await criarPersona({ role: "vendedor", superiorId: master.userId });
    await adicionarRoleE2E(vendedorCoordenador.userId, "coordenador");
    vendedorSuspenso = await criarPersona({ role: "vendedor", superiorId: master.userId });
    await desligarUsuarioE2E(vendedorSuspenso.userId);
  });

  test.afterAll(async () => {
    await limparPersona(vendedorSuspenso);
    await limparPersona(vendedorCoordenador);
    await limparPersonaSemEmpresa(vendedorDaFull);
    await limparPersona(franquiaFull);
    await limparPersona(vendedorProprio);
    await limparPersona(master);
  });

  test("master não lista coordenador com role vendedor em Pipeline e Relatórios", async ({
    page,
  }) => {
    await loginAs(page, master.email, master.senha);
    await expect(page).toHaveURL(/\/comando\/visao-geral$/, { timeout: 15_000 });

    for (const rota of ["/operacao/pipeline-geral", "/operacao/relatorios"] as const) {
      await test.step(`filtro em ${rota}`, async () => {
        await esperarSomenteVendedoresAtivos(
          page,
          rota,
          [vendedorProprio, vendedorDaFull],
          [master, franquiaFull, vendedorCoordenador, vendedorSuspenso],
        );
      });
    }
  });
});
