import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { criarVendedorComLead, limparVendedorComLead, type VendedorComLead } from "./provision";

/**
 * E2E do caminho feliz de venda (vendedor): login → vê o lead distribuído em
 * "Atender agora" → assume o lead (cria a cotação via `assumir_lead`) → cai no
 * wizard de cotação ("Novo lead") já no passo 1 (Segurado), com os dados do
 * lead pré-carregados.
 *
 * Onde paramos e por quê: o wizard de cotação (`novo-lead.tsx`, ~3000 linhas,
 * 6 passos) exige preencher seguradoras/veículo/perfil/coberturas com listas
 * carregadas do banco (marcas/modelos, tabelas de seguradoras habilitadas) e
 * dispara cálculo de prêmio — depender de todos esses valores tornaria o teste
 * frágil e fortemente acoplado a dados de seed que não são o objeto desta
 * tarefa. Preferimos parar num ponto sólido (a cotação foi criada e o wizard
 * abriu com os dados do lead) a simular preenchimentos que quebrariam a cada
 * mudança de seed/UI. Avançar até gerar a proposta fica para um follow-up
 * (idealmente usando fixtures que já deixem a cotação "calculada").
 */

test.describe("venda — caminho feliz do vendedor", () => {
  let vendedor: VendedorComLead;

  test.beforeAll(async () => {
    vendedor = await criarVendedorComLead();
  });

  test.afterAll(async () => {
    await limparVendedorComLead(vendedor);
  });

  test("vendedor loga, vê o lead distribuído e assume o atendimento", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);

    // aguarda o redirecionamento pós-login (saída de /auth) antes de navegar
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

    // navega para a fila de atendimento
    await page.goto("/venda/atender");
    await expect(page.getByRole("heading", { name: "Atender agora" }).last()).toBeVisible();

    const card = page.getByText("Cliente E2E", { exact: false }).first();
    await expect(card).toBeVisible();

    await page
      .getByRole("button", { name: /assumir e iniciar/i })
      .first()
      .click();

    // `assumir_lead` cria a cotação e o app navega para o wizard já no passo 0
    await expect(page).toHaveURL(/\/venda\/novo-lead/);
    await expect(page.getByRole("heading", { name: "Dados do Segurado" })).toBeVisible();
  });
});
