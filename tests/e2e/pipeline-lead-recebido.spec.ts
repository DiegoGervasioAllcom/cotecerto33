// Pipeline V12 (T11): reescrito para a tela nova (`pipeline.tsx`/`pipeline-card.tsx`,
// T9) — 5 buckets automáticos (`novo`/`cotacao`/`negociacao`/`finalizacao`/`fechamento`)
// derivados de `leadEtapaBucket` (`@/lib/lead-etapa`), sem coluna "Qualificando"
// separada e sem drag-and-drop (removido de propósito — não recriar aqui).
//
// Fixture `criarVendedorComLead({ statusPipeline: "qualificado" })`: o status
// "qualificado" cai em `NOVO_SEM_COTACAO_STATUSES` (nenhuma cotação ainda),
// então o bucket automático é "novo" ("Lead novo") — mesma fixture do spec
// antigo, resultado esperado diferente (antes: coluna "Qualificando").
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import { criarVendedorComLead, limparVendedorComLead, type VendedorComLead } from "./provision";

test.describe("pipeline — lead externo recebido", () => {
  let vendedorTabela: VendedorComLead;
  let vendedorKanban: VendedorComLead;
  let vendedorFiltros: VendedorComLead;

  test.beforeAll(async () => {
    [vendedorTabela, vendedorKanban, vendedorFiltros] = await Promise.all([
      criarVendedorComLead({ statusPipeline: "qualificado" }),
      criarVendedorComLead({ statusPipeline: "qualificado" }),
      criarVendedorComLead({ statusPipeline: "qualificado" }),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([
      limparVendedorComLead(vendedorTabela),
      limparVendedorComLead(vendedorKanban),
      limparVendedorComLead(vendedorFiltros),
    ]);
  });

  test("tabela exibe chip Lead novo; clique na linha assume e abre wizard com id", async ({
    page,
  }) => {
    await loginAs(page, vendedorTabela.email, vendedorTabela.senha);
    await page.goto("/venda/pipeline");

    await page.getByRole("button", { name: "Tabela" }).click();
    const linha = page.locator("tbody tr", { hasText: "Cliente E2E" }).first();
    await expect(linha).toBeVisible();
    await expect(linha.getByText("Lead novo", { exact: true })).toBeVisible();
    await expect(linha.getByText("aguardando o primeiro contato")).toBeVisible();
    await linha.click();

    await expect(page).toHaveURL(/\/venda\/novo-lead\?id=[^&]+&step=0/);
    await expect(page.getByRole("heading", { name: "Dados do Segurado" })).toBeVisible();
    await expect(page.getByText(/não veio da Central/i)).toHaveCount(0);
  });

  test("card qualificado aparece na coluna Lead novo do kanban; clique assume e abre wizard com id", async ({
    page,
  }) => {
    await loginAs(page, vendedorKanban.email, vendedorKanban.senha);
    await page.goto("/venda/pipeline");

    const colunaLeadNovo = page.locator('.kcol[data-stage="novo"]');
    const card = colunaLeadNovo.getByText("Cliente E2E", { exact: false });
    await expect(card).toBeVisible();
    await expect(colunaLeadNovo.getByText("aguardando o primeiro contato")).toBeVisible();

    // Não existe mais coluna "Qualificando" separada.
    await expect(page.locator('.kcol[data-stage="contato"]')).toHaveCount(0);

    await card.click();

    await expect(page).toHaveURL(/\/venda\/novo-lead\?id=[^&]+&step=0/);
    await expect(page.getByRole("heading", { name: "Dados do Segurado" })).toBeVisible();
    await expect(page.getByText(/não veio da Central/i)).toHaveCount(0);
  });

  test("filtro de Estágio esconde o lead novo em outro estágio e volta a mostrar em Lead novo", async ({
    page,
  }) => {
    await loginAs(page, vendedorFiltros.email, vendedorFiltros.senha);
    await page.goto("/venda/pipeline");

    const cardTexto = page.getByText("Cliente E2E", { exact: false });
    await expect(cardTexto).toBeVisible();

    const filtroEstagio = page
      .locator("select")
      .filter({ has: page.locator('option[value="novo"]') });

    // Negativo: lead está no bucket "novo" — filtrar por "cotacao" esconde o card.
    await filtroEstagio.selectOption("cotacao");
    await expect(cardTexto).toHaveCount(0);

    // Positivo: voltar ao próprio bucket do lead reexibe o card.
    await filtroEstagio.selectOption("novo");
    await expect(cardTexto).toBeVisible();

    // "todas" (default) também mostra o card.
    await filtroEstagio.selectOption("todas");
    await expect(cardTexto).toBeVisible();
  });

  test("filtro Status ativos/perdidos: Ativos esconde a coluna Perdido; Perdidos esconde o lead ativo", async ({
    page,
  }) => {
    await loginAs(page, vendedorFiltros.email, vendedorFiltros.senha);
    await page.goto("/venda/pipeline");

    const cardTexto = page.getByText("Cliente E2E", { exact: false });
    await expect(cardTexto).toBeVisible();

    const colunaPerdido = page.locator('.kcol[data-stage="perdido"]');
    // Default (Status · todos): coluna Perdido existe (vazia, sem lead perdido nesta fixture).
    await expect(colunaPerdido).toBeVisible();

    const filtroStatus = page
      .locator("select")
      .filter({ has: page.locator('option[value="ativos"]') });

    // Negativo: "Ativos" some com a coluna Perdido por completo.
    await filtroStatus.selectOption("ativos");
    await expect(colunaPerdido).toHaveCount(0);
    await expect(cardTexto).toBeVisible();

    // Negativo: "Perdidos" esconde o lead ativo (ele não é 'perdido').
    await filtroStatus.selectOption("perdidos");
    await expect(cardTexto).toHaveCount(0);

    await filtroStatus.selectOption("todos");
    await expect(cardTexto).toBeVisible();
  });

  test("botão Lead Manual continua sendo a entrada do modal manual", async ({ page }) => {
    await loginAs(page, vendedorTabela.email, vendedorTabela.senha);
    await page.goto("/venda/pipeline");
    await page.getByRole("main").getByRole("link", { name: "Lead Manual" }).click();

    await expect(page).toHaveURL(/\/venda\/novo-lead$/);
    await expect(page.getByText(/não veio da Central/i)).toBeVisible();
  });
});
