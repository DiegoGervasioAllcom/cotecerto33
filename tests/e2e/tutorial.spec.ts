import { expect, test, type Locator, type Page } from "@playwright/test";
import { tutorialProgressStorageKey } from "@/components/tutorial/tutorial-progress";
import { loginAs } from "./helpers";
import {
  criarPersona,
  criarVendedorComTutorial,
  limparPersona,
  limparVendedorComTutorial,
  type Persona,
  type VendedorComTutorial,
} from "./provision";

const MATRIZ_EMAIL = "desenvolvimento@suppercerto.com.br";
const MATRIZ_SENHA = "Supper@123!";

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const source = message.location().url;
      // O servidor Vite local não serve o asset virtual legado do Lovable.
      // A falha é preexistente e não deve esconder erros do engine durante a troca de rota.
      if (
        source.includes("/__l5e/assets-v1/") &&
        message.text().includes("the server responded with a status of 404")
      )
        return;
      // O serviço Realtime pode responder 503 durante a inicialização no runner da CI.
      // O tutorial não depende desse canal; mantenha qualquer outro erro como bloqueante.
      if (
        source.includes("@supabase_supabase-js") &&
        message.text().includes("/realtime/v1/websocket") &&
        message.text().includes("Unexpected response code: 503")
      )
        return;
      errors.push(`console${source ? ` (${source})` : ""}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function abrirTutorial(page: Page) {
  const trigger = page.getByRole("button", { name: "Tutorial" });
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.click();
  await expect(page.locator(".tour-welcome")).toBeVisible();
}

async function esperarPasso(page: Page, title: string | RegExp, progress: string) {
  const dialog = page.locator(".tour-tip");
  await expect(dialog).toBeVisible();
  await expect(page.locator(".tour-host")).toHaveAttribute("aria-busy", "false", {
    timeout: 10_000,
  });
  await expect(dialog.getByRole("heading", { name: title })).toBeVisible();
  await expect(dialog.locator(".progress")).toHaveText(progress);
  return dialog;
}

async function posicionarTutorial(
  page: Page,
  userId: string,
  kind: "sales" | "matriz" | "group",
  chapter: number,
  step: number,
) {
  const key = tutorialProgressStorageKey(userId, kind);
  await page.evaluate(
    ({ storageKey, progress }) => {
      localStorage.setItem(storageKey, JSON.stringify({ status: "step", progress }));
    },
    { storageKey: key, progress: { chapter, step } },
  );
  await abrirTutorial(page);
  await page.getByRole("button", { name: "Começar de onde parei" }).click();
}

async function currentUserId(page: Page) {
  return page.evaluate(() => {
    for (const value of Object.values(localStorage)) {
      try {
        const parsed = JSON.parse(value) as {
          user?: { id?: string };
          currentSession?: { user?: { id?: string } };
        };
        const id = parsed.user?.id ?? parsed.currentSession?.user?.id;
        if (id) return id;
      } catch {
        // Outras preferências locais não precisam ser JSON.
      }
    }
    throw new Error("Sessão autenticada não encontrada no localStorage.");
  });
}

async function expectSpotlightAround(page: Page, target: Locator) {
  const actualTarget = target.first();
  await expect(actualTarget).toBeVisible();
  await expect(page.locator(".tour-spotlight")).toBeVisible();
  await expect
    .poll(
      async () => {
        const [spotlightBox, targetBox, viewport] = await Promise.all([
          page.locator(".tour-spotlight").boundingBox(),
          actualTarget.boundingBox(),
          page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
        ]);
        if (!spotlightBox || !targetBox) return false;
        const visibleRight = Math.min(targetBox.x + targetBox.width, viewport.width);
        const visibleBottom = Math.min(targetBox.y + targetBox.height, viewport.height);
        return (
          spotlightBox.x <= Math.max(0, targetBox.x) + 1 &&
          spotlightBox.y <= Math.max(0, targetBox.y) + 1 &&
          spotlightBox.x + spotlightBox.width >= visibleRight - 1 &&
          spotlightBox.y + spotlightBox.height >= visibleBottom - 1
        );
      },
      { message: "spotlight deve acompanhar o retângulo visível do alvo", timeout: 7_000 },
    )
    .toBe(true);
}

async function monitorSupabaseMutations(page: Page) {
  const mutations: string[] = [];
  const readOnlyRpcs = new Set([
    "fn_areas_do_usuario",
    "funis_por_canal_visao_geral",
    "normalizar_periodo_visao_geral",
    "saldo_comissao_visao_geral",
    "franquias_abaixo_meta_visao_geral",
    "contar_pendentes_seguradora_visao_geral",
  ]);
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const pathname = new URL(request.url()).pathname;
    // Heartbeat global da aplicação; não é preparação nem ação de negócio do tutorial.
    if (pathname.endsWith("/rest/v1/rpc/presence_set")) {
      await route.continue();
      return;
    }
    // RPCs globais somente leitura não são ações de negócio do tutorial.
    // O PostgREST usa POST mesmo quando a função apenas consulta; por isso
    // elas precisam ser classificadas pela função, não pelo verbo HTTP.
    const rpcName = pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
    if (rpcName && readOnlyRpcs.has(rpcName)) {
      await route.continue();
      return;
    }
    if (pathname.includes("/rest/v1/rpc/") || ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      mutations.push(`${method} ${pathname}`);
    }
    await route.continue();
  });
  return mutations;
}

test("Matriz mantém o tutorial ao navegar da Visão geral para Leads", async ({ page }) => {
  await loginAs(page, MATRIZ_EMAIL, MATRIZ_SENHA);
  await expect(page).toHaveURL(/\/comando\/visao-geral/, { timeout: 15_000 });

  await abrirTutorial(page);
  await expect(page.locator(".tour-welcome")).toContainText("CENTRO DE COMANDO DA MATRIZ");
  const browserErrors = collectBrowserErrors(page);
  await page
    .locator(".tour-welcome")
    .getByRole("button", { name: /Central de Leads/ })
    .click();

  await expect(page).toHaveURL(/\/comando\/leads/);
  let dialog = await esperarPasso(page, "A tela mais importante pra você", "1 / 5");
  await dialog.getByRole("button", { name: "Próximo" }).click();

  await expect(page).toHaveURL(/\/comando\/leads/);
  dialog = await esperarPasso(page, "Speed-to-lead — a sua régua", "2 / 5");
  await expect(page.locator(".tour-spotlight")).toBeVisible();

  await dialog.getByRole("button", { name: "Anterior" }).click();
  dialog = await esperarPasso(page, "A tela mais importante pra você", "1 / 5");
  await dialog.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page.locator(".tour-tip")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tutorial" })).toBeFocused();
  expect(browserErrors).toEqual([]);
});

test.describe("roteiro de vendas", () => {
  let vendedor: VendedorComTutorial;

  test.beforeAll(async () => {
    vendedor = await criarVendedorComTutorial();
  });

  test.afterAll(async () => {
    await limparVendedorComTutorial(vendedor);
  });

  test("Vendedor recebe a abertura sales e avança com spotlight", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).toHaveURL(/\/inicio/, { timeout: 15_000 });

    await abrirTutorial(page);
    await expect(page.locator(".tour-welcome")).toContainText("A PRIMEIRA SEMANA DA RAFINHA");
    const browserErrors = collectBrowserErrors(page);
    await page.getByRole("button", { name: /Começar do início/ }).click();

    let dialog = await esperarPasso(page, "Bem-vinda à Supper", "1 / 13");
    await dialog.getByRole("button", { name: "Próximo" }).click();
    dialog = await esperarPasso(page, "Essa é a sua navegação", "2 / 13");
    await expect(page.locator(".tour-spotlight")).toBeVisible();
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();
    expect(browserErrors).toEqual([]);
  });

  test("previews do Novo lead não disparam autosave ou RPC e destacam Histórico", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    const mutations = await monitorSupabaseMutations(page);

    await posicionarTutorial(page, vendedor.userId, "sales", 2, 0);
    let dialog = await esperarPasso(page, "Você entrou no João Silva", "1 / 15");
    await expect(page.getByRole("heading", { name: "Dados do Segurado" })).toBeVisible();

    for (const [title, progress] of [
      ["Seis passos, espelhando o Quiver", "2 / 15"],
      ["Passo 1 — Segurado: CPF primeiro", "3 / 15"],
      ["CEP puxa endereço", "4 / 15"],
      ["Passo 2 — Seguro", "5 / 15"],
      ["Passo 3 — Veículo: placa → FIPE", "6 / 15"],
    ] as const) {
      await dialog.getByRole("button", { name: "Próximo" }).click();
      dialog = await esperarPasso(page, title, progress);
    }
    await expect(page.getByRole("heading", { name: "Dados do Veículo" })).toBeVisible();
    await expectSpotlightAround(page, page.locator('.wizard-grid input[placeholder="AAA0A00"]'));
    await page.waitForTimeout(1_700);
    expect(mutations, "preview não pode persistir rascunho nem chamar RPC").toEqual([]);
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();

    await posicionarTutorial(page, vendedor.userId, "sales", 2, 12);
    dialog = await esperarPasso(page, "Pronto para cotar", "13 / 15");
    const ready = page.locator(".stepper .ready");
    await expect(ready).toBeVisible();
    await expect(ready).toHaveText(/Pronto para cotar/);
    await expectSpotlightAround(page, ready);
    await page.waitForTimeout(1_700);
    expect(mutations, "selo demonstrativo não pode persistir formulário inválido").toEqual([]);
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(ready).toHaveCount(0);
    // Fora do preview do tour (sem ?id=, sem tutorialPreview ativo), a página
    // real de "Novo lead" volta a mostrar o gate — nenhum progresso de fato
    // foi feito durante a demonstração.
    await expect(page.getByRole("heading", { name: "Lead Manual — origem" })).toBeVisible();

    await posicionarTutorial(page, vendedor.userId, "sales", 2, 13);
    dialog = await esperarPasso(page, "Agende um retorno — e seja lembrada", "14 / 15");
    const historico = page.getByRole("button", { name: "Histórico", exact: true });
    await expect(historico).toHaveAttribute("data-tour", "lead-historico");
    await expectSpotlightAround(page, historico);
    await expect(page.getByRole("button", { name: "Classificar perda" })).toHaveAttribute(
      "data-tour",
      "lead-perda",
    );
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();
  });

  test("destinos de cotação e proposta resolvem registros visíveis e seletores reais", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    const mutations = await monitorSupabaseMutations(page);

    await posicionarTutorial(page, vendedor.userId, "sales", 3, 0);
    let dialog = await esperarPasso(page, "O comparativo multi-seguradora", "1 / 7");
    await expect(page).toHaveURL(new RegExp(`/venda/cotacoes/${vendedor.cotacaoId}`));
    await expect(page).not.toHaveURL(new RegExp(`/venda/cotacoes/${vendedor.rascunhoId}`));
    const compareTargets = [
      [".compare-table thead", "Os selos no topo", "2 / 7"],
      [".ctable tbody tr:nth-child(2)", "Coberturas, linha por linha", "3 / 7"],
      [".compare-bar .switch", "Aplicar em todas ou só em uma", "4 / 7"],
      [".ctable .total-row", "O preço final, com parcelamento", "5 / 7"],
      ['[data-tour="comparar-mais"]', "Mais seguradoras?", "6 / 7"],
      [".ctable .actions-row .ins-actions", "Pra cada seguradora, 3 ações", "7 / 7"],
    ] as const;
    for (const [selector, title, progress] of compareTargets) {
      await dialog.getByRole("button", { name: "Próximo" }).click();
      dialog = await esperarPasso(page, title, progress);
      await expectSpotlightAround(page, page.locator(selector));
    }
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();

    await posicionarTutorial(page, vendedor.userId, "sales", 4, 0);
    dialog = await esperarPasso(page, "A proposta da Azul", "1 / 6");
    await expect(page).toHaveURL(new RegExp(`/venda/propostas\\?selected=${vendedor.propostaId}`));
    const proposalTargets = [
      ['[data-tour="proposta-versao"]', "Ajuste fino de cobertura", "2 / 6"],
      ['[data-tour="proposta-pagamento"]', "Como o cliente vai pagar", "3 / 6"],
      ['[data-tour="proposta-nota"]', "Notas internas (não vão ao cliente)", "4 / 6"],
      [".history", "Histórico de versões com diff", "5 / 6"],
      ['[data-tour="proposta-enviar"]', "Enviar nova versão", "6 / 6"],
    ] as const;
    for (const [selector, title, progress] of proposalTargets) {
      await dialog.getByRole("button", { name: "Próximo" }).click();
      dialog = await esperarPasso(page, title, progress);
      const target = page.locator(selector);
      await expectSpotlightAround(page, target);
      if (progress === "2 / 6") {
        await expect(target).toHaveAttribute("aria-readonly", "true");
        await expect(target).toContainText("Franquia · casco");
        await expect(target).toContainText("R$ 3.000");
        await expect(target).toContainText("RCF · danos materiais");
        await expect(target).toContainText("R$ 150.000");
        await expect(target).toContainText("Carro reserva");
        await expect(target).toContainText("30 dias");
        await expect(target.locator("select")).toHaveCount(4);
        for (const select of await target.locator("select").all()) {
          await expect(select).toBeDisabled();
        }
      }
      if (progress === "4 / 6") {
        await expect(target.getByText("Nota para esta versão")).toBeVisible();
      }
      if (progress === "6 / 6") {
        await expect(target).toBeDisabled();
        await expect(target).toHaveText("Enviar nova versão (V3) ao cliente");
      }
    }
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();

    const propostaRequests: string[] = [];
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith("/rest/v1/propostas")) {
        propostaRequests.push(`${request.method()} ${pathname}`);
      }
    });
    await posicionarTutorial(page, vendedor.userId, "sales", 5, 0);
    dialog = await esperarPasso(page, "Aceite & Transmissão", "1 / 7");
    await expect(page.getByText("Proposta de exemplo")).toBeVisible();
    for (const [selector, title, progress] of [
      ['[data-tour="aceite-timeline"]', "A linha do tempo do aceite", "2 / 7"],
      ['[data-tour="aceite-conferencia"]', "Conferência final dos dados", "3 / 7"],
      ['[data-tour="aceite-checkbox"]', "O checkbox de responsabilidade", "4 / 7"],
      ['[data-tour="aceite-transmitir"]', "Transmitir = oficializar a venda", "5 / 7"],
    ] as const) {
      await dialog.getByRole("button", { name: "Próximo" }).click();
      dialog = await esperarPasso(page, title, progress);
      const target = page.locator(selector);
      await expectSpotlightAround(page, target);
      if (progress === "2 / 7") {
        await expect(target).toContainText("Exemplo do tutorial");
        await expect(target).toContainText("Aceita pelo cliente");
      }
      if (progress === "3 / 7") {
        await expect(target.locator("xpath=..")).toHaveAttribute("aria-readonly", "true");
        await expect(target).toContainText("Fernanda Souza");
        await expect(target).toContainText("Seguradora do exemplo");
      }
      if (progress === "4 / 7") {
        await expect(target.locator('input[type="checkbox"]')).toBeDisabled();
      }
    }
    const transmitir = page.locator('[data-tour="aceite-transmitir"]');
    await expect(transmitir).toBeDisabled();
    await expect(transmitir).toHaveText("Transmitir para a seguradora");
    await dialog.getByRole("button", { name: "Próximo" }).click();
    dialog = await esperarPasso(page, "E se a seguradora pedir uma pendência?", "6 / 7");
    const pendencia = page.locator('[data-tour="aceite-pendencia"]');
    await expectSpotlightAround(page, pendencia);
    await expect(
      page.getByRole("heading", { name: "Aceite & transmissão · Eduardo Lima" }),
    ).toBeVisible();
    await expect(
      page.getByText("Proposta de exemplo · Porto Seguro · Toyota Hilux 2023"),
    ).toBeVisible();
    const timelinePendencia = page.locator('[data-tour="aceite-timeline"]');
    await expect(timelinePendencia).toContainText("17/05 · 15:20");
    await expect(timelinePendencia).toContainText("18/05 · 10:12");
    await expect(timelinePendencia).toContainText("19/05 · 09:14");
    await expect(pendencia).toHaveAttribute("aria-readonly", "true");
    await expect(pendencia).toContainText("Pendência aberta");
    await expect(pendencia).toHaveCSS("background-color", "rgb(253, 236, 234)");
    await expect(pendencia).toHaveCSS("border-top-color", "rgb(243, 214, 210)");
    for (const button of await pendencia.locator("button").all()) {
      await expect(button).toBeDisabled();
    }
    await expect(pendencia.locator("textarea")).toHaveAttribute("readonly", "");
    expect(propostaRequests, "preview de aceite não pode consultar a tabela propostas").toEqual([]);
    expect(mutations, "previews de aceite não podem escrever nem chamar RPC").toEqual([]);
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();

    await posicionarTutorial(page, vendedor.userId, "sales", 7, 3);
    dialog = await esperarPasso(page, "Cada linha é uma venda sua", "4 / 7");
    const vendaExemplo = page.locator('[data-tour="extrato-venda-exemplo"]');
    await expectSpotlightAround(page, vendaExemplo);
    await expect(page.getByText("0 vendas", { exact: true })).toBeVisible();
    await expect(page.getByText("Nenhuma venda transmitida no período.")).toBeVisible();
    await expect(vendaExemplo.locator("xpath=ancestor::div[@aria-readonly='true']")).toBeVisible();
    await expect(vendaExemplo).toContainText("EXEMPLO-001");
    await expect(vendaExemplo).toContainText("Exemplo do tutorial");
    await expect(vendaExemplo).toContainText("Seguradora A");
    expect(mutations, "linha EXEMPLO em conta vazia não pode criar venda").toEqual([]);
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();

    await posicionarTutorial(page, vendedor.userId, "sales", 7, 5);
    dialog = await esperarPasso(page, "Campanhas ativas", "6 / 7");
    const campanha = page.locator('[data-tour="extrato-campanha"]');
    await expectSpotlightAround(page, campanha);
    await expect(campanha.locator("xpath=..")).toHaveAttribute("aria-readonly", "true");
    await expect(campanha).toContainText("Exemplo do tutorial");
    await expect(campanha).toContainText("CAMPANHA PORTO");
    await expect(campanha).toContainText("3 das 5 apólices");
    await expect(campanha).toContainText("Faltam 2 apólices");
    await dialog.getByRole("button", { name: "Próximo" }).click();
    dialog = await esperarPasso(page, "Quando o dinheiro entra", "7 / 7");
    const pagamentos = page.locator('[data-tour="extrato-pagamentos"]');
    await expectSpotlightAround(page, pagamentos);
    await expect(pagamentos.locator("xpath=..")).toHaveAttribute("aria-readonly", "true");
    await expect(pagamentos).toContainText("Próximos pagamentos");
    await expect(pagamentos).toContainText("Exemplo do tutorial");
    await expect(pagamentos).toContainText("Seguradora A");
    await expect(pagamentos).toContainText("Seguradora B");
    await expect(pagamentos).toContainText("Seguradora C");
    await expect(pagamentos).toContainText("R$ 1.980,00");
    await expect(pagamentos).toContainText("R$ 1.080,00");
    await expect(pagamentos).toContainText("R$ 540,00");
    await page.waitForTimeout(500);
    expect(mutations, "previews de proposta e extrato não podem escrever nem chamar RPC").toEqual(
      [],
    );
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();
  });

  test("fechar durante a resolução pendente não navega depois", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).toHaveURL(/\/inicio/, { timeout: 15_000 });

    let liberarRequisicao!: () => void;
    const requisicaoLiberada = new Promise<void>((resolve) => {
      liberarRequisicao = resolve;
    });
    let registrarInterceptacao!: () => void;
    const requisicaoInterceptada = new Promise<void>((resolve) => {
      registrarInterceptacao = resolve;
    });

    await page.route("**/rest/v1/cotacoes*", async (route) => {
      if (!decodeURIComponent(route.request().url()).includes("cotacao_premios!inner")) {
        await route.continue();
        return;
      }
      registrarInterceptacao();
      await requisicaoLiberada;
      await route.continue().catch(() => undefined);
    });

    await posicionarTutorial(page, vendedor.userId, "sales", 3, 0);
    await requisicaoInterceptada;
    const dialog = page.locator(".tour-tip");
    await expect(
      dialog.getByRole("heading", { name: "O comparativo multi-seguradora" }),
    ).toBeVisible();
    await expect(page.locator(".tour-host")).toHaveAttribute("aria-busy", "true");
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(dialog).toHaveCount(0);

    liberarRequisicao();
    await page.waitForTimeout(750);
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page).not.toHaveURL(/\/venda\/cotacoes\/[0-9a-f-]+$/);
  });
});

test.describe("roteiro da Matriz — previews e destinos de detalhe", () => {
  let franquia: Persona;
  let vendedor: VendedorComTutorial;

  test.beforeAll(async () => {
    [franquia, vendedor] = await Promise.all([
      criarPersona({ role: "franqueado", modalidade: "full" }),
      criarVendedorComTutorial(),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([limparPersona(franquia), limparVendedorComTutorial(vendedor)]);
  });

  test("previews de Vendas e Acessos não fazem writes, autosave ou RPC", async ({ page }) => {
    await loginAs(page, MATRIZ_EMAIL, MATRIZ_SENHA);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    const matrizId = await currentUserId(page);
    const mutations = await monitorSupabaseMutations(page);

    await posicionarTutorial(page, matrizId, "matriz", 6, 0);
    let dialog = await esperarPasso(page, "O extrato geral da operação", "1 / 3");
    await expect(page.locator('[data-tour="vendas-tab-transmissao"]')).toHaveClass(/on/);
    await expectSpotlightAround(page, page.locator(".filters-bar .toggle"));
    await dialog.getByRole("button", { name: "Próximo" }).click();
    dialog = await esperarPasso(page, "A fase de transmissão", "2 / 3");
    await dialog.getByRole("button", { name: "Próximo" }).click();
    dialog = await esperarPasso(page, "Emitidas, pagas, não pagas, canceladas", "3 / 3");
    await expect(page.locator('[data-tour="vendas-tab-naopagas"]')).toHaveClass(/on/);
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();

    await posicionarTutorial(page, matrizId, "matriz", 9, 4);
    dialog = await esperarPasso(page, "Personalização geral — Modelo Franquia", "5 / 6");
    await expect(page.locator('[data-tour="acessos-modelos-franquia"]')).toHaveClass(/on/);
    await expectSpotlightAround(page, page.locator(".toggle-sub"));
    await dialog.getByRole("button", { name: "Próximo" }).click();
    dialog = await esperarPasso(page, "Personalização geral — Modelo CLT", "6 / 6");
    await expect(page.locator('[data-tour="acessos-modelos-clt"]')).toHaveClass(/on/);
    await expectSpotlightAround(page, page.locator(".card").first());
    await page.waitForTimeout(1_700);
    expect(mutations, "previews não podem salvar modelos ou chamar RPC").toEqual([]);
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();
  });

  test("Matriz abre franquia e vendedor visíveis em detalhes read-only", async ({ page }) => {
    await loginAs(page, MATRIZ_EMAIL, MATRIZ_SENHA);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    const matrizId = await currentUserId(page);
    const mutations = await monitorSupabaseMutations(page);

    await posicionarTutorial(page, matrizId, "matriz", 4, 1);
    let dialog = await esperarPasso(page, "Por dentro de uma franquia", "2 / 4");
    await expect(page).toHaveURL(/\/operacao\/franquias\/[0-9a-f-]+$/);
    await expectSpotlightAround(page, page.locator('[data-tour="franquia-funil"]'));
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();

    await posicionarTutorial(page, matrizId, "matriz", 4, 3);
    dialog = await esperarPasso(page, "Por dentro de um vendedor", "4 / 4");
    await expect(page).toHaveURL(/\/operacao\/vendedores\/[0-9a-f-]+$/);
    await expectSpotlightAround(page, page.locator('[data-tour="vendedor-funil"]'));
    expect(mutations, "destinos dinâmicos devem consultar sem mutar").toEqual([]);
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();
  });
});

test.describe("roteiro de grupo", () => {
  let master: Persona;

  test.beforeAll(async () => {
    master = await criarPersona({ role: "master" });
  });

  test.afterAll(async () => {
    await limparPersona(master);
  });

  test("Master conclui capítulo intermediário e o roteiro final", async ({ page }) => {
    await loginAs(page, master.email, master.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/comando/visao-geral");

    await abrirTutorial(page);
    await expect(page.locator(".tour-welcome")).toContainText("ÁREA DO MASTER FRANQUEADO");
    await page
      .locator(".tour-welcome")
      .getByRole("button", { name: /Renovações e relatórios/ })
      .click();

    let dialog = await esperarPasso(page, "Renovações no automático", "1 / 2");
    await dialog.getByRole("button", { name: "Próximo" }).click();
    dialog = await esperarPasso(page, "Relatórios", "2 / 2");
    await dialog.getByRole("button", { name: "Próximo capítulo" }).click();

    const chapterEnd = page.locator(".tour-end");
    await expect(chapterEnd.getByRole("heading", { name: "Capítulo 4 concluído" })).toBeVisible();
    await chapterEnd.getByRole("button", { name: "Encerrar por agora" }).click();
    await expect(chapterEnd).toHaveCount(0);
    await page.getByRole("button", { name: "Tutorial" }).click();
    await expect(chapterEnd.getByRole("heading", { name: "Capítulo 4 concluído" })).toBeVisible();
    await chapterEnd.getByRole("button", { name: "Próximo capítulo" }).click();

    dialog = await esperarPasso(page, "Cadastrar vendedor", "1 / 2");
    await dialog.getByRole("button", { name: "Próximo" }).click();
    dialog = await esperarPasso(page, "Vendedores ativos e desligamento", "2 / 2");
    await dialog.getByRole("button", { name: "Terminar tour" }).click();

    await expect(
      page.locator(".tour-end").getByRole("heading", { name: "Tutorial concluído!" }),
    ).toBeVisible();
    await page.locator(".tour-end").getByRole("button", { name: "Encerrar por agora" }).click();
    await abrirTutorial(page);
    await expect(page.locator(".tour-welcome")).toBeVisible();
    await expect(page.getByRole("button", { name: "Começar novamente" })).toBeVisible();
  });
});

test.describe("abertura das demais experiências", () => {
  let supervisor: Persona;
  let individual: Persona;
  let full: Persona;

  test.beforeAll(async () => {
    [supervisor, individual, full] = await Promise.all([
      criarPersona({ role: "supervisor", cargo: "sup_vendas" }),
      criarPersona({ role: "franqueado", modalidade: "individual" }),
      criarPersona({ role: "franqueado", modalidade: "full" }),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([limparPersona(supervisor), limparPersona(individual), limparPersona(full)]);
  });

  test("Supervisor recebe apresentação e roteiro de grupo", async ({ page }) => {
    await loginAs(page, supervisor.email, supervisor.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await abrirTutorial(page);

    await expect(page.locator(".tour-welcome")).toContainText("ÁREA DO SUPERVISOR (MATRIZ)");
    await page
      .locator(".tour-welcome")
      .getByRole("button", { name: /Bem-vindo à sua área/ })
      .click();
    await esperarPasso(page, "A sua área de gestão", "1 / 5");
  });

  test("Franquia Individual recebe apresentação e roteiro sales", async ({ page }) => {
    await loginAs(page, individual.email, individual.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await abrirTutorial(page);

    await expect(page.locator(".tour-welcome")).toContainText("ÁREA DA FRANQUIA (INDIVIDUAL)");
    await page
      .locator(".tour-welcome")
      .getByRole("button", { name: /Bem-vinda ao CoteCerto/ })
      .click();
    await esperarPasso(page, "Bem-vinda à Supper", "1 / 13");
  });

  test("Franquia Full recebe apresentação e roteiro de grupo", async ({ page }) => {
    await loginAs(page, full.email, full.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await abrirTutorial(page);

    await expect(page.locator(".tour-welcome")).toContainText("ÁREA DO FRANQUEADO");
    await page
      .locator(".tour-welcome")
      .getByRole("button", { name: /Bem-vindo à sua área/ })
      .click();
    await esperarPasso(page, "A sua área de gestão", "1 / 5");
  });
});
