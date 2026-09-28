// "Minha agenda" — filtros por tipo + fontes acrescentadas em V12.3.2
// (pendência da seguradora e aprovações pedidas). Reaproveita
// `criarVendedorComFilaDia` (3 fontes originais: retorno atrasado, retorno
// de hoje, lembrete atrasado e negócio em risco) via
// `criarVendedorComAgendaCompleta`, que acrescenta uma proposta bloqueada
// (`transmissao_status='falha'`) e uma `desconto_solicitacoes` pendente do
// próprio vendedor — as 5 fontes de `montarAgenda` ficam todas populadas.
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarColegaComAgendaCompleta,
  criarVendedorComAgendaCompleta,
  limparColegaComAgendaCompleta,
  limparVendedorComAgendaCompleta,
  type ColegaComAgendaCompleta,
  type VendedorComAgendaCompleta,
} from "./provision";

// .serial: os testes compartilham a mesma fixture (mesmo vendedor/lembrete) e
// o último marca o lembrete como feito — mutação real que precisa rodar
// depois das leituras dos demais (fullyParallel do projeto rodaria os testes
// deste arquivo em paralelo/fora de ordem sem isso).
test.describe.serial("minha agenda — filtros por tipo (V12.3.2)", () => {
  let vendedor: VendedorComAgendaCompleta;

  test.beforeAll(async () => {
    vendedor = await criarVendedorComAgendaCompleta();
  });

  test.afterAll(async () => {
    await limparVendedorComAgendaCompleta(vendedor);
  });

  test("chips mostram contagem por tipo, filtram a lista e limpam o filtro", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/venda/agenda");
    await expect(page).toHaveURL(/\/venda\/agenda/);

    const chips = page.locator('[data-tour="agenda-filtros"]');
    await expect(chips).toBeVisible();

    // Contagem por tipo: 2 retornos (atrasado + hoje), 1 risco, 1 seguradora,
    // 1 aprovação, 1 lembrete — total 6.
    const chipRetorno = chips.getByRole("button", { name: /Retorno agendado/ });
    const chipRisco = chips.getByRole("button", { name: /Negócio em risco/ });
    const chipSeguradora = chips.getByRole("button", { name: /Pendências da seguradora/ });
    const chipAprovacao = chips.getByRole("button", { name: /Aprovações que você pediu/ });
    const chipLembrete = chips.getByRole("button", { name: /^Lembrete/ });

    await expect(chipRetorno).toContainText("2");
    await expect(chipRisco).toContainText("1");
    await expect(chipSeguradora).toContainText("1");
    await expect(chipAprovacao).toContainText("1");
    await expect(chipLembrete).toContainText("1");

    // Header "Pendências" começa mostrando o total, sem filtro.
    const header = page.getByRole("heading", { name: "Pendências" });
    await expect(header).toContainText("— 6");

    // Filtrar por "Negócio em risco" reduz a lista e mostra "N de M".
    await chipRisco.click();
    await expect(header).toContainText("1 de 6");
    await expect(page.locator(".action-row")).toHaveCount(1);
    await expect(
      page.locator(".action-row").filter({ hasText: "Cliente Em Risco E2E" }),
    ).toBeVisible();

    // "Limpar filtro" volta ao total.
    await page.getByRole("button", { name: "Limpar filtro" }).click();
    await expect(header).toContainText("— 6");
    await expect(page.locator(".action-row")).toHaveCount(6);

    // Clicar de novo no mesmo chip alterna: liga e desliga o filtro.
    await chipSeguradora.click();
    await expect(header).toContainText("1 de 6");
    await chipSeguradora.click();
    await expect(header).toContainText("— 6");
  });

  test("itens de seguradora e aprovação não têm visto (marcar como feito)", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/venda/agenda");

    const chips = page.locator('[data-tour="agenda-filtros"]');

    await chips.getByRole("button", { name: /Pendências da seguradora/ }).click();
    const linhaSeguradora = page
      .locator(".action-row")
      .filter({ hasText: "Cliente Pendência Seguradora E2E" });
    await expect(linhaSeguradora).toBeVisible();
    await expect(linhaSeguradora.getByRole("button", { name: "Marcar como feito" })).toHaveCount(0);
    await page.getByRole("button", { name: "Limpar filtro" }).click();

    await chips.getByRole("button", { name: /Aprovações que você pediu/ }).click();
    const linhaAprovacao = page.locator(".action-row").filter({ hasText: "Desconto de 12%" });
    await expect(linhaAprovacao).toBeVisible();
    await expect(linhaAprovacao.getByRole("button", { name: "Marcar como feito" })).toHaveCount(0);
  });

  test("clicar na pendência da seguradora leva à Emissão com a proposta em falha", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/venda/agenda");

    const chips = page.locator('[data-tour="agenda-filtros"]');
    await chips.getByRole("button", { name: /Pendências da seguradora/ }).click();
    const linhaSeguradora = page
      .locator(".action-row")
      .filter({ hasText: "Cliente Pendência Seguradora E2E" });
    await linhaSeguradora.click();

    await expect(page).toHaveURL(/\/venda\/emissao/);
    // V12.3.11: o destaque de "de onde você veio" virou `foco=<fonte>:<id>`
    // (ver tests/e2e/foco-ao-chegar.spec.ts) — `selected` era o mecanismo
    // antigo, sem faixa nem pulso.
    await expect(page).toHaveURL(new RegExp(`foco=seguradora.*${vendedor.propostaFalhaId}`));

    const linha = page.locator("tr").filter({ hasText: "PRP-E2E-FALHA" });
    await expect(linha).toBeVisible();
    await expect(linha.getByText("Pendência da seguradora")).toBeVisible();
  });

  test("visto num lembrete o tira da lista", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/venda/agenda");

    const linhaLembrete = page.locator(".action-row").filter({ hasText: "Lembrete atrasado E2E" });
    await expect(linhaLembrete).toBeVisible();
    await linhaLembrete.getByRole("button", { name: "Marcar como feito" }).click();
    await expect(
      page.locator(".action-row").filter({ hasText: "Lembrete atrasado E2E" }),
    ).toHaveCount(0, { timeout: 10_000 });

    // Contagem do chip "Lembrete" cai para 0 e o total cai para 5.
    const chipLembrete = page
      .locator('[data-tour="agenda-filtros"]')
      .getByRole("button", { name: /^Lembrete/ });
    await expect(chipLembrete).toContainText("0");
    await expect(page.getByRole("heading", { name: "Pendências" })).toContainText("— 5");
  });

  test("#btnNovoLembrete existe e abre o modal de novo lembrete", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/venda/agenda");

    const botao = page.locator("#btnNovoLembrete");
    await expect(botao).toBeVisible();
    await botao.click();
    await expect(page.getByRole("heading", { name: /Novo lembrete/i })).toBeVisible();
  });
});

// Não-vazamento entre colegas da mesma empresa (revisão pós-reprovação da
// V12.3.2): RLS de `cotacoes`/`propostas` libera SELECT pra empresa inteira
// (matriz/gestão precisa enxergar), então "Minha agenda" só continua sendo
// SÓ MINHA porque `fetchRiscoAgenda`/`fetchSeguradoraAgenda`/
// `fetchAprovacoesAgenda` filtram explicitamente por uid — sem isso, um
// vendedor veria o negócio em risco, a proposta bloqueada e o desconto
// pendente do colega ao lado.
test.describe("minha agenda — não vaza entre colegas da mesma empresa (V12.3.2)", () => {
  let vendedor: VendedorComAgendaCompleta;
  let colega: ColegaComAgendaCompleta;

  test.beforeAll(async () => {
    vendedor = await criarVendedorComAgendaCompleta();
    colega = await criarColegaComAgendaCompleta(vendedor.empresaId);
  });

  test.afterAll(async () => {
    await limparColegaComAgendaCompleta(colega);
    await limparVendedorComAgendaCompleta(vendedor);
  });

  test("vendedor não vê risco/seguradora/aprovação do colega na agenda, só os seus", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await page.goto("/venda/agenda");
    await expect(page).toHaveURL(/\/venda\/agenda/);

    // Total continua 6 (2 retorno + 1 risco + 1 seguradora + 1 aprovação + 1
    // lembrete) — os 3 itens do colega (risco + seguradora + aprovação) não
    // entram na conta.
    await expect(page.getByRole("heading", { name: "Pendências" })).toContainText("— 6");
    await expect(page.locator(".action-row")).toHaveCount(6);

    // Negativo: nenhum texto do colega aparece na tela.
    await expect(page.getByText("Cliente Em Risco Colega E2E")).toHaveCount(0);
    await expect(page.getByText("Cliente Pendência Seguradora Colega E2E")).toHaveCount(0);
    await expect(page.getByText("Desconto de 30%")).toHaveCount(0);

    // Positivo: os próprios itens continuam lá.
    await expect(page.getByText("Cliente Em Risco E2E")).toBeVisible();
    await expect(page.getByText("Cliente Pendência Seguradora E2E")).toBeVisible();
    await expect(page.getByText("Desconto de 12%")).toBeVisible();

    // Chips de contagem também não somam os itens do colega.
    const chips = page.locator('[data-tour="agenda-filtros"]');
    await expect(chips.getByRole("button", { name: /Negócio em risco/ })).toContainText("1");
    await expect(chips.getByRole("button", { name: /Pendências da seguradora/ })).toContainText(
      "1",
    );
    await expect(chips.getByRole("button", { name: /Aprovações que você pediu/ })).toContainText(
      "1",
    );
  });

  test("fila do Início ('O que fazer agora') também não vaza o colega", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).toHaveURL(/\/inicio/, { timeout: 15_000 });

    const card = page.locator('[data-tour="home-fila"]');
    await expect(card).toBeVisible();

    await expect(card.getByText("Cliente Em Risco Colega E2E")).toHaveCount(0);
    await expect(card.getByText("Cliente Pendência Seguradora Colega E2E")).toHaveCount(0);
    await expect(card.getByText("Desconto de 30%")).toHaveCount(0);

    // Positivo: o próprio negócio em risco (mesma fonte que vazaria) aparece.
    await expect(card.getByText("Cliente Em Risco E2E")).toBeVisible();
  });
});
