// "Foco ao chegar" (V12.3.11, Frente 3) — espelha focoIr()/focoBarra()/
// focoScroll() do protótipo v12. Clicar num item da agenda/fila do Início
// navega com `foco=<fonte>:<id>`; a tela de destino destaca a linha
// (`.em-foco`/`.foco-pisca`) e mostra a `.foco-barra` com o motivo real do
// clique (ou o rótulo da fonte, sem motivo salvo — ex.: refresh). O X tira
// o destaque e a faixa sem sair da tela. Ver `src/lib/use-foco-ao-chegar.ts`.
import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarVendedorComAgendaCompleta,
  criarVendedorComRetornoEmFinalizacao,
  criarVendedorComRetornoEmNegociacao,
  limparVendedorComAgendaCompleta,
  limparVendedorComRetornoEmFinalizacao,
  limparVendedorComRetornoEmNegociacao,
  type VendedorComAgendaCompleta,
  type VendedorComRetornoEmFinalizacao,
  type VendedorComRetornoEmNegociacao,
} from "./provision";

function focoDaUrl(page: Page): string | null {
  return new URL(page.url()).searchParams.get("foco");
}

async function abrirTutorial(page: Page) {
  const trigger = page.getByRole("button", { name: "Tutorial" });
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.click();
  await expect(page.locator(".tour-welcome")).toBeVisible();
}

test.describe("pendência da seguradora → Emissão (V12.3.11)", () => {
  let vendedor: VendedorComAgendaCompleta;

  test.beforeAll(async () => {
    vendedor = await criarVendedorComAgendaCompleta();
  });

  test.afterAll(async () => {
    await limparVendedorComAgendaCompleta(vendedor);
  });

  test("clicar na pendência destaca a linha na Emissão e mostra a faixa com o motivo real; X limpa sem sair da tela", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/venda/agenda");

    await page
      .locator('[data-tour="agenda-filtros"]')
      .getByRole("button", { name: /Pendências da seguradora/ })
      .click();
    const linhaAgenda = page
      .locator(".action-row")
      .filter({ hasText: "Cliente Pendência Seguradora E2E" });
    await linhaAgenda.click();

    await expect(page).toHaveURL(/\/venda\/emissao/);
    expect(focoDaUrl(page)).toBe(`seguradora:${vendedor.propostaFalhaId}`);

    const linha = page.locator("tr").filter({ hasText: "PRP-E2E-FALHA" });
    await expect(linha).toBeVisible();
    await expect(linha).toHaveClass(/em-foco/);

    const barra = page.locator(".foco-barra");
    await expect(barra).toBeVisible();
    await expect(barra).toContainText("Proposta PRP-E2E-FALHA bloqueada");
    await expect(barra).toContainText("Falta o CRLV do veículo E2E");

    await barra.getByRole("button", { name: "Sair do foco" }).click();

    await expect(page).toHaveURL(/\/venda\/emissao/);
    expect(focoDaUrl(page)).toBeNull();
    await expect(page.locator(".foco-barra")).toHaveCount(0);
    await expect(linha).not.toHaveClass(/em-foco/);
  });

  test("recarregar a página com `foco` na URL mostra a faixa com o rótulo da fonte, sem o motivo salvo", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    // Navegação direta (não passou por `abrirItem`) — sessionStorage não tem
    // o motivo salvo, então a faixa cai para `FONTE_LABEL[fonte]`.
    await page.goto(`/venda/emissao?foco=seguradora:${vendedor.propostaFalhaId}`);

    const linha = page.locator("tr").filter({ hasText: "PRP-E2E-FALHA" });
    await expect(linha).toBeVisible();
    await expect(linha).toHaveClass(/em-foco/);

    const barra = page.locator(".foco-barra");
    await expect(barra).toBeVisible();
    await expect(barra).toContainText("Pendências da seguradora");
    await expect(barra).not.toContainText("Falta o CRLV do veículo E2E");
  });

  test("com o tutorial aberto, nenhum destaque nem faixa aparecem mesmo com `foco` na URL", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto(`/venda/emissao?foco=seguradora:${vendedor.propostaFalhaId}`);
    await expect(page.locator(".foco-barra")).toBeVisible();

    await abrirTutorial(page);

    await expect(page.locator(".foco-barra")).toHaveCount(0);
    await expect(page.locator("tr.em-foco")).toHaveCount(0);
  });
});

test.describe("negócio em risco → wizard (V12.3.11)", () => {
  let vendedor: VendedorComAgendaCompleta;

  test.beforeAll(async () => {
    vendedor = await criarVendedorComAgendaCompleta();
  });

  test.afterAll(async () => {
    await limparVendedorComAgendaCompleta(vendedor);
  });

  test("clicar no negócio em risco leva ao wizard só com a faixa (sem lista pra destacar linha); X limpa sem sair do passo", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/venda/agenda");

    const linhaAgenda = page.locator(".action-row").filter({ hasText: "Cliente Em Risco E2E" });
    await linhaAgenda.click();

    await expect(page).toHaveURL(/\/venda\/novo-lead/);
    expect(focoDaUrl(page)).toBe(`risco:${vendedor.cotacaoRiscoId}`);
    await expect(page).toHaveURL(new RegExp(`id=${vendedor.cotacaoRiscoId}`));
    await expect(page).toHaveURL(/step=5/);

    const barra = page.locator(".foco-barra");
    await expect(barra).toBeVisible();
    await expect(barra).toContainText("Cliente Em Risco E2E");
    await expect(barra).toContainText("sem atualização");

    await barra.getByRole("button", { name: "Sair do foco" }).click();

    await expect(page).toHaveURL(/\/venda\/novo-lead/);
    expect(focoDaUrl(page)).toBeNull();
    await expect(page.locator(".foco-barra")).toHaveCount(0);
    // Continua no mesmo passo do wizard — o X só limpa o foco, não navega.
    await expect(page).toHaveURL(new RegExp(`id=${vendedor.cotacaoRiscoId}`));
  });
});

test.describe("retorno agendado que resolve para Em negociação (V12.3.11)", () => {
  let vendedor: VendedorComRetornoEmNegociacao;

  test.beforeAll(async () => {
    vendedor = await criarVendedorComRetornoEmNegociacao();
  });

  test.afterAll(async () => {
    await limparVendedorComRetornoEmNegociacao(vendedor);
  });

  test("clicar no retorno destaca a linha em Em negociação e continua abrindo o painel via `selected`", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/venda/agenda");

    const linhaAgenda = page
      .locator(".action-row")
      .filter({ hasText: "Retorno em negociação E2E" });
    await linhaAgenda.click();

    await expect(page).toHaveURL(/\/venda\/em-negociacao/);
    expect(focoDaUrl(page)).toBe(`retorno:${vendedor.propostaId}`);
    await expect(page).toHaveURL(new RegExp(`selected=${vendedor.propostaId}`));

    const linha = page.locator("tr").filter({ hasText: "Cliente Retorno Negociação E2E" });
    await expect(linha).toBeVisible();
    await expect(linha).toHaveClass(/em-foco/);

    // O painel de negociação continua abrindo normalmente via `selected`.
    await expect(
      page.getByRole("heading", { name: "Negociação · Cliente Retorno Negociação E2E" }),
    ).toBeVisible();
  });
});

test.describe("retorno agendado que resolve para Em finalização (revisão da V12.3.11)", () => {
  let vendedor: VendedorComRetornoEmFinalizacao;

  test.beforeAll(async () => {
    vendedor = await criarVendedorComRetornoEmFinalizacao();
  });

  test.afterAll(async () => {
    await limparVendedorComRetornoEmFinalizacao(vendedor);
  });

  test("clicar no retorno destaca a linha em Em finalização e mostra a faixa; X limpa sem navegar (kind: acceptance — só `foco`, sem `selected`)", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/venda/agenda");

    const linhaAgenda = page
      .locator(".action-row")
      .filter({ hasText: "Retorno em finalização E2E" });
    await linhaAgenda.click();

    await expect(page).toHaveURL(/\/venda\/em-finalizacao/);
    expect(focoDaUrl(page)).toBe(`retorno:${vendedor.propostaId}`);
    // `resolveExistingLeadDestination` resolve "acceptance" com `selected`,
    // mas `abrirItem` (use-agenda-itens.ts) navega só com `foco` pra este
    // destino — nunca existiu painel de "aceite" pra `selected` abrir aqui.
    await expect(page).not.toHaveURL(/selected=/);

    const linha = page.locator("tr").filter({ hasText: "Cliente Retorno Finalização E2E" });
    await expect(linha).toBeVisible();
    await expect(linha).toHaveClass(/em-foco/);

    const barra = page.locator(".foco-barra");
    await expect(barra).toBeVisible();
    await expect(barra).toContainText("Retorno em finalização E2E");

    await barra.getByRole("button", { name: "Sair do foco" }).click();

    await expect(page).toHaveURL(/\/venda\/em-finalizacao/);
    expect(focoDaUrl(page)).toBeNull();
    await expect(page.locator(".foco-barra")).toHaveCount(0);
    await expect(linha).not.toHaveClass(/em-foco/);
  });
});
