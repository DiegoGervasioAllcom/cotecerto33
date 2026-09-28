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

  // V12.3.10 reescreveu `salesTutorialChapters` do zero (protótipo V12, 10
  // capítulos): a abertura "Rafinha"/"primeira semana" virou "CoteCerto"/"o
  // dia a dia do vendedor", e as páginas simuladas de comparativo
  // (`compare`), proposta (`proposal`) e aceite (`aceite`) — que dependiam
  // de `destination: "cotacao-comparativo"/"proposta-selecionada"` e de
  // registros reais no banco — saíram do roteiro: a Etapa 7 (Cálculo/
  // Transmissão) agora é 100% preview estático dentro do próprio Lead Manual
  // (ver `test.describe("tour completo V12.3.10 ...")` abaixo, que cobre
  // esses capítulos ponta a ponta). Os dois testes abaixo foram reescritos
  // para a abertura nova e para o capítulo 3 (real, com o rascunho da
  // fixture); os antigos testes de `compare`/`proposal`/`aceite` e o teste
  // de corrida de navegação pendente foram removidos porque testavam
  // comportamento que não existe mais.
  test("Vendedor recebe a abertura sales e avança com spotlight", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).toHaveURL(/\/inicio/, { timeout: 15_000 });

    await abrirTutorial(page);
    await expect(page.locator(".tour-welcome .ravatar")).toHaveText("C");
    await expect(page.locator(".tour-welcome")).toContainText("O DIA A DIA DO VENDEDOR");
    await expect(page.locator(".tour-welcome h2")).toHaveText("Vou te mostrar o sistema inteiro");
    const browserErrors = collectBrowserErrors(page);
    await page.getByRole("button", { name: /Começar do início/ }).click();

    let dialog = await esperarPasso(page, "O menu é o ciclo da venda", "1 / 8");
    await dialog.getByRole("button", { name: "Próximo" }).click();
    dialog = await esperarPasso(page, "Atender agora — e o relógio de 3 minutos", "2 / 8");
    await expect(page.locator(".tour-spotlight")).toBeVisible();
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();
    expect(browserErrors).toEqual([]);
  });

  test("capítulo 3 (jornada em 7 etapas) não dispara autosave ou RPC e destaca Histórico", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    const mutations = await monitorSupabaseMutations(page);

    await posicionarTutorial(page, vendedor.userId, "sales", 2, 0);
    let dialog = await esperarPasso(page, "A trilha inteira, sempre à vista", "1 / 11");
    await expect(page).toHaveURL(/\/venda\/novo-lead$/);
    await expectSpotlightAround(page, page.locator(".stepper"));

    await dialog.getByRole("button", { name: "Próximo" }).click();
    dialog = await esperarPasso(
      page,
      "Registros & agendamentos — a memória do atendimento",
      "2 / 11",
    );
    const historico = page.getByRole("button", { name: "Histórico", exact: true });
    await expect(historico).toHaveAttribute("data-tour", "lead-historico");
    await expectSpotlightAround(page, historico);

    await dialog.getByRole("button", { name: "Próximo" }).click();
    dialog = await esperarPasso(page, "Etapa 1 — comece pelo CPF", "3 / 11");
    await expectSpotlightAround(
      page,
      page.locator('.wizard-grid input[placeholder="000.000.000-00"]'),
    );

    await dialog.getByRole("button", { name: "Próximo" }).click();
    dialog = await esperarPasso(page, "O CEP muda o preço", "4 / 11");
    await expectSpotlightAround(page, page.locator('.wizard-grid input[placeholder="00000-000"]'));

    await page.waitForTimeout(1_700);
    expect(mutations, "o capítulo 3 não pode persistir rascunho nem chamar RPC").toEqual([]);
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();
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
    dialog = await esperarPasso(page, "Personalização geral — Modelo Master", "6 / 6");
    await expect(page.locator('[data-tour="acessos-modelos-master"]')).toHaveClass(/on/);
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

// V12.3.10 — passeio completo do tutorial do vendedor: 10 capítulos / 5
// módulos do protótipo V12 (ver `salesTutorialChapters`). Diferente do teste
// "roteiro de vendas" acima (que valida trechos pontuais com fixtures
// específicas), este passeia por TODOS os capítulos na ordem, checando
// título + progresso + rota de cada passo, e faz um checklist de spotlight
// "soft" (não derruba o teste no primeiro alvo que falhar) para que a lista
// final de passos quebrados apareça inteira no relatório.
type PassoEsperado = {
  title: string;
  progress: string;
  route: RegExp;
  target?: string;
};

// Seletores já resolvidos por `defineTutorial`/`tutorial-targets.ts` (o que o
// engine efetivamente procura no DOM), não o texto bruto do protótipo.
const CAP1_HOME_ATENDER: PassoEsperado[] = [
  { title: "O menu é o ciclo da venda", progress: "1 / 8", route: /\/inicio$/ },
  {
    title: "Atender agora — e o relógio de 3 minutos",
    progress: "2 / 8",
    route: /\/inicio$/,
    target: '[data-tour="nav-atender"]',
  },
  {
    title: "Só existe uma ação nesta tela",
    progress: "3 / 8",
    route: /\/venda\/atender$/,
    target: ".atender-grid",
  },
  {
    title: "A busca acha por placa",
    progress: "4 / 8",
    route: /\/inicio$/,
    target: '[data-tour="shell-search"]',
  },
  {
    title: "Lead Manual — quem chegou por fora",
    progress: "5 / 8",
    route: /\/inicio$/,
    target: '[data-tour="nav-novo-lead"]',
  },
  {
    title: "Você, no pé do menu",
    progress: "6 / 8",
    route: /\/inicio$/,
    target: '[data-tour="shell-user"]',
  },
  {
    title: "Seu placar do mês",
    progress: "7 / 8",
    route: /\/inicio$/,
    target: ".hero-placar",
  },
  {
    title: "O que fazer agora",
    progress: "8 / 8",
    route: /\/inicio$/,
    target: '[data-tour="home-fila"]',
  },
];

const CAP2_AGENDA: PassoEsperado[] = [
  { title: "Tudo que espera por você, num lugar só", progress: "1 / 6", route: /\/venda\/agenda$/ },
  {
    title: "Anotar o que não nasce de um lead",
    progress: "2 / 6",
    route: /\/venda\/agenda$/,
    target: '[data-tour="agenda-novo-lembrete"]',
  },
  {
    title: "Atrasado, hoje, total",
    progress: "3 / 6",
    route: /\/venda\/agenda$/,
    target: '[data-tour="agenda-resumo"]',
  },
  {
    title: "Filtrar por tipo de pendência",
    progress: "4 / 6",
    route: /\/venda\/agenda$/,
    target: '[data-tour="agenda-filtros"]',
  },
  {
    title: "Clicar leva para a origem — e destaca",
    progress: "5 / 6",
    route: /\/venda\/agenda$/,
    target: '[data-tour="agenda-item"]',
  },
  {
    title: "Marcar como feito",
    progress: "6 / 6",
    route: /\/venda\/agenda$/,
    target: '[data-tour="agenda-concluir"]',
  },
];

const CAP4_CALCULO: PassoEsperado[] = [
  {
    title: "A barra de contexto",
    progress: "1 / 7",
    route: /\/venda\/novo-lead$/,
    target: ".calc-ctx",
  },
  {
    title: "A lista comparativa é a visão de venda",
    progress: "2 / 7",
    route: /\/venda\/novo-lead$/,
    target: ".calc-lista",
  },
  {
    title: "Ver as seguradoras que não couberam na tela",
    progress: "3 / 7",
    route: /\/venda\/novo-lead$/,
    target: ".cl-nav",
  },
  {
    title: "As cinco ferramentas de cada seguradora",
    progress: "4 / 7",
    route: /\/venda\/novo-lead$/,
    target: ".seg-acoes",
  },
  {
    title: "Lista ou cards",
    progress: "5 / 7",
    route: /\/venda\/novo-lead$/,
    target: ".calc-toolset",
  },
  {
    title: "Desconto: até onde você vai sozinho",
    progress: "6 / 7",
    route: /\/venda\/novo-lead$/,
    target: ".seg-acoes",
  },
  {
    title: "Imprimir e mandar para o cliente",
    progress: "7 / 7",
    route: /\/venda\/novo-lead$/,
    target: ".calc-bar-r",
  },
];

const CAP5_TRANSMISSAO: PassoEsperado[] = [
  {
    title: "Etapa 7 — os passos até a seguradora",
    progress: "1 / 7",
    route: /\/venda\/novo-lead$/,
    target: ".acc-sol",
  },
  {
    title: "Passo 1 — o que a cotação não pediu",
    progress: "2 / 7",
    route: /\/venda\/novo-lead$/,
    target: '[data-tour="transmissao-dados"]',
  },
  {
    title: "Passo 2 — a última conferida",
    progress: "3 / 7",
    route: /\/venda\/novo-lead$/,
    target: '[data-tour="transmissao-confirmacao"]',
  },
  {
    title: "Efetivar proposta",
    progress: "4 / 7",
    route: /\/venda\/novo-lead$/,
    target: '[data-tour="transmissao-efetivar"]',
  },
  {
    title: "Transmitida — o que você recebe de volta",
    progress: "5 / 7",
    route: /\/venda\/novo-lead$/,
    target: '[data-tour="transmitida-acoes"]',
  },
  {
    title: "Os documentos originais",
    progress: "6 / 7",
    route: /\/venda\/novo-lead$/,
    target: '[data-tour="transmitida-acoes"]',
  },
  {
    title: "Em cima, esta proposta; embaixo, o próximo passo",
    progress: "7 / 7",
    route: /\/venda\/novo-lead$/,
    target: ".atalhos",
  },
];

const CAP6_EMISSAO: PassoEsperado[] = [
  { title: "Duas listas, duas naturezas", progress: "1 / 3", route: /\/venda\/emissao$/ },
  {
    title: "A coluna Situação é o que importa",
    progress: "2 / 3",
    route: /\/venda\/emissao$/,
    target: '[data-tour="emissao-aguardando"]',
  },
  {
    title: "Documentos e consulta de status",
    progress: "3 / 3",
    route: /\/venda\/emissao$/,
    target: '[data-tour="emissao-aguardando"]',
  },
];

const CAP7_PIPELINE: PassoEsperado[] = [
  { title: "Não. E é essa a ideia", progress: "1 / 6", route: /\/venda\/pipeline$/ },
  {
    title: "As cinco colunas",
    progress: "2 / 6",
    route: /\/venda\/pipeline$/,
    target: ".kcol",
  },
  {
    title: "O card diz onde parou e há quanto tempo",
    progress: "3 / 6",
    route: /\/venda\/pipeline$/,
    target: ".kcard",
  },
  {
    title: "Filtrar por estágio, produto, canal e dias parados",
    progress: "4 / 6",
    route: /\/venda\/pipeline$/,
    target: ".filters-bar",
  },
  {
    title: "Kanban ou tabela",
    progress: "5 / 6",
    route: /\/venda\/pipeline$/,
    target: ".toggle",
  },
  {
    title: "Classificar a perda",
    progress: "6 / 6",
    route: /\/venda\/novo-lead$/,
    target: '[data-tour="lead-perda"]',
  },
];

const CAP8_FASES: PassoEsperado[] = [
  {
    title: "A mesma coisa do Pipeline, em modo lista",
    progress: "1 / 6",
    route: /\/venda\/em-cotacao$/,
  },
  {
    title: "Em cotação — continuar de onde parou",
    progress: "2 / 6",
    route: /\/venda\/em-cotacao$/,
    target: '[data-tour="em-cotacao-lista"]',
  },
  {
    title: "Em negociação tem duas listas",
    progress: "3 / 6",
    route: /\/venda\/em-negociacao$/,
    target: '[data-tour="em-negociacao-aguardando"]',
  },
  {
    title: "Em negociação — duas ações",
    progress: "4 / 6",
    route: /\/venda\/em-negociacao$/,
    target: '[data-tour="em-negociacao-fase-acoes"]',
  },
  {
    title: "O sistema te avisa quando o preço chega",
    progress: "5 / 6",
    route: /\/venda\/em-negociacao$/,
    target: '[data-tour="nav-em-negociacao"]',
  },
  {
    title: "Em finalização — consultar status",
    progress: "6 / 6",
    route: /\/venda\/em-finalizacao$/,
    target: '[data-tour="em-finalizacao-fase-acoes"]',
  },
];

const CAP9_EXTRATO: PassoEsperado[] = [
  {
    title: "Seis números que contam o mês",
    progress: "1 / 4",
    route: /\/venda\/extrato$/,
    target: ".kpi-grid",
  },
  {
    title: "Estorno é comissão que volta",
    progress: "2 / 4",
    route: /\/venda\/extrato$/,
    target: '[data-tour="extrato-estornos"]',
  },
  {
    title: "Venda por venda",
    progress: "3 / 4",
    route: /\/venda\/extrato$/,
    target: ".table-pipe.mtable",
  },
  {
    title: "Filtrar por período e status",
    progress: "4 / 4",
    route: /\/venda\/extrato$/,
    target: '[data-tour="extrato-filtros"]',
  },
];

const CAP10_MENSAGENS: PassoEsperado[] = [
  {
    title: "Textos aprovados, já preenchidos",
    progress: "1 / 3",
    route: /\/venda\/mensagens-prontas$/,
  },
  {
    title: "Organizadas pelo momento da conversa",
    progress: "2 / 3",
    route: /\/venda\/mensagens-prontas$/,
    target: ".msg-cat-bar",
  },
  {
    title: "Copiar ou abrir no WhatsApp",
    progress: "3 / 3",
    route: /\/venda\/mensagens-prontas$/,
    target: ".msg-card",
  },
];

async function trySpotlightAround(page: Page, selector: string): Promise<boolean> {
  try {
    const target = page.locator(selector).first();
    await expect(target).toBeVisible({ timeout: 4_000 });
    await expect(page.locator(".tour-spotlight")).toBeVisible({ timeout: 4_000 });
    await expect
      .poll(
        async () => {
          const [spotlightBox, targetBox] = await Promise.all([
            page.locator(".tour-spotlight").boundingBox(),
            target.boundingBox(),
          ]);
          if (!spotlightBox || !targetBox) return false;
          return (
            spotlightBox.x <= targetBox.x + 1 &&
            spotlightBox.y <= targetBox.y + 1 &&
            spotlightBox.x + spotlightBox.width >= targetBox.x + targetBox.width - 1 &&
            spotlightBox.y + spotlightBox.height >= targetBox.y + targetBox.height - 1
          );
        },
        { timeout: 4_000 },
      )
      .toBe(true);
    return true;
  } catch {
    return false;
  }
}

async function percorrerCapitulo(
  page: Page,
  dialog: Locator,
  passos: PassoEsperado[],
  falhas: string[],
  capituloLabel: string,
) {
  for (let i = 0; i < passos.length; i++) {
    const passo = passos[i];
    if (i > 0) {
      await dialog
        .getByRole("button", { name: /^Próximo$|^Próximo capítulo$|^Terminar tour$/ })
        .click();
    }
    await expect(page.locator(".tour-host")).toHaveAttribute("aria-busy", "false", {
      timeout: 10_000,
    });
    await expect(dialog.getByRole("heading", { name: passo.title })).toBeVisible();
    await expect(dialog.locator(".progress")).toHaveText(passo.progress);
    await expect(page).toHaveURL(passo.route);
    if (passo.target) {
      const ok = await trySpotlightAround(page, passo.target);
      if (!ok) falhas.push(`${capituloLabel} · "${passo.title}" (${passo.target})`);
    }
  }
}

test.describe("tour completo V12.3.10 (vendedor)", () => {
  let vendedor: VendedorComTutorial;

  test.beforeAll(async () => {
    vendedor = await criarVendedorComTutorial();
  });

  test.afterAll(async () => {
    await limparVendedorComTutorial(vendedor);
  });

  test("percorre os 10 capítulos, confere rotas/spotlight e não dispara escrita nenhuma", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).toHaveURL(/\/inicio/, { timeout: 15_000 });

    const escritas: string[] = [];
    page.on("request", (request) => {
      const method = request.method();
      if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;
      const url = request.url();
      if (url.includes("/realtime/v1/") || url.includes("/rest/v1/rpc/presence_set")) return;
      if (url.includes("/rest/v1/") || url.includes("/_serverFn/")) {
        escritas.push(`${method} ${url}`);
      }
    });

    await abrirTutorial(page);
    await expect(page.locator(".tour-welcome .ravatar")).toHaveText("C");
    await expect(page.locator(".tour-welcome")).toContainText("CoteCerto");
    await expect(page.locator(".tour-welcome")).toContainText("O DIA A DIA DO VENDEDOR");
    await expect(page.locator(".tour-welcome h2")).toHaveText("Vou te mostrar o sistema inteiro");
    await page.getByRole("button", { name: /Começar do início/ }).click();

    const falhas: string[] = [];
    let dialog = page.locator(".tour-tip");

    await percorrerCapitulo(page, dialog, CAP1_HOME_ATENDER, falhas, "Cap.1 O lead chegou");
    await dialog.getByRole("button", { name: "Próximo capítulo" }).click();
    await expect(
      page.locator(".tour-end").getByRole("heading", { name: "Capítulo 1 concluído" }),
    ).toBeVisible();
    await page.locator(".tour-end").getByRole("button", { name: "Próximo capítulo" }).click();

    dialog = page.locator(".tour-tip");
    await percorrerCapitulo(page, dialog, CAP2_AGENDA, falhas, "Cap.2 Minha agenda");
    await dialog.getByRole("button", { name: "Próximo capítulo" }).click();
    await expect(
      page.locator(".tour-end").getByRole("heading", { name: "Capítulo 2 concluído" }),
    ).toBeVisible();
    // Cap.3 ("A jornada em 7 etapas") depende do wizard real com um rascunho
    // em cada etapa — coberto separadamente pelo teste "previews do Novo
    // lead..." acima. Aqui só confirmamos que o capítulo abre e navega para
    // o Lead Manual, sem percorrer os 11 passos (evita duplicar fixture).
    await page.locator(".tour-end").getByRole("button", { name: "Próximo capítulo" }).click();
    dialog = page.locator(".tour-tip");
    await expect(
      dialog.getByRole("heading", { name: "A trilha inteira, sempre à vista" }),
    ).toBeVisible();
    await expect(dialog.locator(".progress")).toHaveText("1 / 11");
    await expect(page).toHaveURL(/\/venda\/novo-lead$/);
    const capitulo3Alvo = await trySpotlightAround(page, ".stepper");
    if (!capitulo3Alvo)
      falhas.push('Cap.3 A jornada em 7 etapas · "A trilha inteira, sempre à vista" (.stepper)');
    await dialog.getByRole("button", { name: "Sair", exact: true }).click();

    // Pula direto para o capítulo 4 (Cálculo) via posicionamento — mesmo
    // mecanismo usado no teste "roteiro de vendas" acima.
    await posicionarTutorial(page, vendedor.userId, "sales", 3, 0);
    dialog = page.locator(".tour-tip");
    await percorrerCapitulo(page, dialog, CAP4_CALCULO, falhas, "Cap.4 O cálculo");
    await dialog.getByRole("button", { name: "Próximo capítulo" }).click();
    await expect(
      page.locator(".tour-end").getByRole("heading", { name: "Capítulo 4 concluído" }),
    ).toBeVisible();
    await page.locator(".tour-end").getByRole("button", { name: "Próximo capítulo" }).click();

    dialog = page.locator(".tour-tip");
    await percorrerCapitulo(page, dialog, CAP5_TRANSMISSAO, falhas, "Cap.5 Transmissão");
    // O selo "Exemplo do tutorial" precisa estar visível nos três previews
    // estáticos da Etapa 7 (Dados/Confirmação/Transmitida).
    await expect(page.getByText("Exemplo do tutorial")).toBeVisible();
    await dialog.getByRole("button", { name: "Próximo capítulo" }).click();
    await expect(
      page.locator(".tour-end").getByRole("heading", { name: "Capítulo 5 concluído" }),
    ).toBeVisible();
    await page.locator(".tour-end").getByRole("button", { name: "Próximo capítulo" }).click();

    dialog = page.locator(".tour-tip");
    await percorrerCapitulo(page, dialog, CAP6_EMISSAO, falhas, "Cap.6 Emissão & histórico");
    await dialog.getByRole("button", { name: "Próximo capítulo" }).click();
    await expect(
      page.locator(".tour-end").getByRole("heading", { name: "Capítulo 6 concluído" }),
    ).toBeVisible();
    await page.locator(".tour-end").getByRole("button", { name: "Próximo capítulo" }).click();

    dialog = page.locator(".tour-tip");
    await percorrerCapitulo(page, dialog, CAP7_PIPELINE, falhas, "Cap.7 O Pipeline anda sozinho");
    await dialog.getByRole("button", { name: "Próximo capítulo" }).click();
    await expect(
      page.locator(".tour-end").getByRole("heading", { name: "Capítulo 7 concluído" }),
    ).toBeVisible();
    await page.locator(".tour-end").getByRole("button", { name: "Próximo capítulo" }).click();

    dialog = page.locator(".tour-tip");
    await percorrerCapitulo(page, dialog, CAP8_FASES, falhas, "Cap.8 Os atalhos por fase");
    await dialog.getByRole("button", { name: "Próximo capítulo" }).click();
    await expect(
      page.locator(".tour-end").getByRole("heading", { name: "Capítulo 8 concluído" }),
    ).toBeVisible();
    await page.locator(".tour-end").getByRole("button", { name: "Próximo capítulo" }).click();

    dialog = page.locator(".tour-tip");
    await percorrerCapitulo(page, dialog, CAP9_EXTRATO, falhas, "Cap.9 Extrato de vendas");
    await dialog.getByRole("button", { name: "Próximo capítulo" }).click();
    await expect(
      page.locator(".tour-end").getByRole("heading", { name: "Capítulo 9 concluído" }),
    ).toBeVisible();
    await page.locator(".tour-end").getByRole("button", { name: "Próximo capítulo" }).click();

    dialog = page.locator(".tour-tip");
    await percorrerCapitulo(page, dialog, CAP10_MENSAGENS, falhas, "Cap.10 Mensagens prontas");
    await dialog.getByRole("button", { name: "Terminar tour" }).click();
    await expect(
      page.locator(".tour-end").getByRole("heading", { name: "Tutorial concluído!" }),
    ).toBeVisible();
    await page.locator(".tour-end").getByRole("button", { name: "Encerrar por agora" }).click();

    expect.soft(falhas, "passos com spotlight que não encontrou o alvo").toEqual([]);
    expect(escritas, "o tour não pode escrever no Supabase nem chamar server function").toEqual([]);
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
      .getByRole("button", { name: /Primeiro dia no CoteCerto/ })
      .click();
    await esperarPasso(page, "O menu é o ciclo da venda", "1 / 8");
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
