import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarCotacaoQuiverFixture,
  criarSolicitacaoDescontoDeOutroUsuarioE2E,
  criarSolicitacaoDescontoPropriaE2E,
  definirSeguradorasSelE2E,
  limparCotacaoQuiverFixture,
  limparSolicitacaoDescontoDeOutroUsuarioE2E,
  marcarCalculoVistoE2E,
  seguradorasSelE2E,
  statusSolicitacaoDescontoE2E,
  QUIVER_WEBHOOK_HEADERS,
  type CotacaoQuiverFixture,
} from "./provision";

/**
 * E2E das ações por seguradora do passo Cálculo (`.seg-acoes` · V12.3.6):
 * Mensagens e Prêmio (VIP) sempre desabilitados, engrenagem abrindo a
 * "Ferramenta de análise" com dados reais (payload atual × retorno já na
 * tela) e o bloqueio de "Recalcular esta seguradora" quando um pedido de
 * desconto pendente de OUTRA seguradora não pode ser cancelado (RPC
 * `cancelar_desconto` só deixa o próprio solicitante cancelar).
 *
 * Usa seguradoras REAIS do seed (Mapfre/Porto) — diferente de
 * `quiver-webhook.spec.ts`/`calculo-lista.spec.ts`, que usam nomes fictícios
 * só para testar a renderização do comparativo — porque o cenário de
 * bloqueio precisa resolver `seguradora_id` de verdade
 * (`desconto_solicitacoes.seguradora_id`).
 *
 * O caminho feliz de "Recalcular" também é testado aqui, mas sem tocar o
 * robô real (o mesmo motivo de sempre: `SELF_QUIVER_API_URL` é um
 * Playwright-worker externo, lento e flaky por timing de portal — "Robô
 * Quiver flaky em teste local"). `recalcularSeguradora`
 * (`useSimulacaoCalculo.ts`) chama a server function `enviarCotacaoQuiver`
 * (`quiver.functions.ts`), que roda no SERVIDOR (não no browser) e faz um
 * `fetch` real pro robô — diferente de `transmitirPropostaQuiver`, aqui não
 * há uma `cotacao_transmissoes` para inserir "a resposta certa" na mesa e
 * pular a chamada. Em vez disso, interceptamos a CHAMADA DO BROWSER ao
 * endpoint da server function (`/_serverFn/<id>`, mesma técnica de
 * `page.route` de `webhook-transmissao.spec.ts`/`venda.spec.ts`) — o `id` é
 * um JSON `{file, export}` em base64url (formato do compilador do TanStack
 * Start em modo dev; ver `createServerFn`/`generateFunctionId`), decodificado
 * em `interceptarEnviarCotacaoQuiver` para achar exatamente a chamada de
 * `enviarCotacaoQuiver` sem colidir com `obterPayloadQuiverAtual` (mesmo
 * shape de payload `{cotacaoId, caller_token}`). A resposta simulada é
 * `{ok:true}` (o retorno real da função em sucesso) — depois disso, o
 * `POST /api/webhooks/quiver` real (mesmo endpoint usado no resto da suíte)
 * simula o resultado assíncrono do robô, e o polling do front (Supabase
 * real, sem mock) detecta a mudança sozinho.
 */

/** Intercepta só a chamada de `enviarCotacaoQuiver` (decodificando o `id` da
 * server function na URL) e responde com sucesso sem tocar o robô real. */
async function interceptarEnviarCotacaoQuiver(page: Page) {
  await page.route("**/_serverFn/**", async (route) => {
    const url = route.request().url();
    const seg = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
    let isEnviarCotacaoQuiver = false;
    try {
      const decodificado = JSON.parse(
        Buffer.from(decodeURIComponent(seg), "base64url").toString("utf8"),
      ) as { export?: string };
      isEnviarCotacaoQuiver = (decodificado.export ?? "").startsWith("enviarCotacaoQuiver");
    } catch {
      /* não é um id de server function decodificável — deixa passar */
    }
    if (isEnviarCotacaoQuiver) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { ok: true } }),
      });
      return;
    }
    await route.continue();
  });
}

function cardsPayload() {
  return [
    {
      index: 0,
      seguradora: "Mapfre",
      produto: "Auto Completo",
      nome: "Plano Standard",
      opcoes: [
        {
          tipo: "Compreensiva",
          franquia: "Reduzida · R$ 2.000,00",
          avista: "R$ 2.500,00",
          parcelas: "10x de R$ 260,00",
        },
      ],
      coberturasBasicas: { Casco: "100% FIPE" },
    },
    {
      index: 1,
      seguradora: "Porto",
      produto: "Auto Flex",
      nome: "Plano Flexível",
      opcoes: [
        {
          tipo: "Compreensiva Plus",
          franquia: "Majorada · R$ 4.000,00",
          avista: "R$ 4.200,00",
          parcelas: "12x de R$ 385,00",
        },
      ],
      coberturasBasicas: { Casco: "110% FIPE" },
    },
  ];
}

/** Variante com uma terceira seguradora real (Azul) — usada só pelo
 * caminho feliz do recálculo, que precisa de "as outras 2" para a mensagem
 * de confirmação e de uma seguradora sobrando pra checar que ela SOME da
 * lista (sem virar "Sem retorno") depois do recálculo restrito. O prêmio à
 * vista da Azul (`R$ 4.900,00`) é de propósito MAIOR que o da Porto
 * (`R$ 4.200,00`) — a ordenação padrão da lista é por menor preço
 * (`ordenarPorEscolha`/"menor"), então isso mantém a ordem visual igual à
 * de inserção (Mapfre, Porto, Azul) e permite escolher a Porto por índice
 * fixo (`.seg-acoes` `.nth(1)`) sem depender de texto ambíguo. */
function cardsPayload3() {
  return [
    ...cardsPayload(),
    {
      index: 2,
      seguradora: "Azul",
      produto: "Azul Auto",
      nome: "Plano Azul",
      opcoes: [
        {
          tipo: "Compreensiva",
          franquia: "Normal · R$ 3.000,00",
          avista: "R$ 4.900,00",
          parcelas: "10x de R$ 490,00",
        },
      ],
      coberturasBasicas: { Casco: "100% FIPE" },
    },
  ];
}

test.describe("Cálculo — ações por seguradora (.seg-acoes, V12.3.6)", () => {
  let fixture: CotacaoQuiverFixture;

  test.afterEach(async () => {
    if (fixture) await limparCotacaoQuiverFixture(fixture);
  });

  // `antesDeAbrir` roda depois do webhook e ANTES do `page.goto` — precisa
  // existir nesse momento porque o wizard busca seguradoras/prêmios/
  // solicitações uma vez ao montar (`useDescontoAdicionalDados`), sem
  // refazer sozinho quando algo é criado por fora depois (ex.: o pedido de
  // desconto de outro usuário do teste de bloqueio do recálculo).
  async function abrirCalculoComListaCarregada(
    page: Page,
    antesDeAbrir?: (cotacaoId: string) => Promise<void>,
  ) {
    fixture = await criarCotacaoQuiverFixture();
    await definirSeguradorasSelE2E(fixture.cotacaoId, ["Mapfre", "Porto"]);
    // Sem o aviso "COTAÇÃO FINALIZADA" (`cotacao-finalizada-aviso.tsx`) — não
    // é o que este spec testa, e ele intercepta cliques em botões do modal.
    await marcarCalculoVistoE2E(fixture.cotacaoId);

    const res = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: { cotacaoId: fixture.cotacaoId, temPremios: true, cards: cardsPayload() },
    });
    expect(res.ok()).toBeTruthy();

    if (antesDeAbrir) await antesDeAbrir(fixture.cotacaoId);

    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
    await expect(page.getByText(/compare, personalize e escolha a seguradora/i)).toBeVisible({
      timeout: 10_000,
    });
  }

  test("Mensagens e Prêmio (VIP) ficam sempre desabilitados, com o aviso correto", async ({
    page,
  }) => {
    await abrirCalculoComListaCarregada(page);

    const acoesMapfre = page.locator(".seg-acoes").first();
    const btnMensagens = acoesMapfre.getByTitle("Sem retorno da seguradora ainda");
    const btnVip = acoesMapfre.getByTitle("Cliente VIP — em breve");
    await expect(btnMensagens).toBeDisabled();
    await expect(btnVip).toBeDisabled();
  });

  test("engrenagem abre o menu e a Ferramenta de análise com dados reais", async ({ page }) => {
    await abrirCalculoComListaCarregada(page);

    const acoesMapfre = page.locator(".seg-acoes").first();
    await acoesMapfre.getByTitle("Opções: análise do envio").click();
    await expect(page.getByRole("heading", { name: "Opções — Mapfre" })).toBeVisible();
    await page.getByText("Análise do envio").click();

    await expect(
      page.getByRole("heading", { name: /Ferramenta de análise — Mapfre/ }),
    ).toBeVisible();
    // Coluna direita ("Retorno da seguradora") vem do card já na tela — real,
    // não inventado pelo modal.
    await expect(page.getByText("100% FIPE")).toBeVisible();
    await expect(page.getByText(/não necessariamente o que foi enviado/i)).toBeVisible();
    await page.getByRole("button", { name: "Fechar" }).click();
    await expect(page.getByRole("heading", { name: /Ferramenta de análise/ })).toHaveCount(0);
  });

  test("Recalcular pede confirmação (modal do app) com o número real de outras seguradoras", async ({
    page,
  }) => {
    await abrirCalculoComListaCarregada(page);

    const acoesMapfre = page.locator(".seg-acoes").first();
    await acoesMapfre.getByTitle("Recalcular só esta seguradora").click();

    await expect(page.getByRole("heading", { name: "Recalcular — Mapfre" })).toBeVisible();
    await expect(
      page.getByText(
        "Recalcular só a Mapfre descarta as ofertas das outras 1 seguradora desta cotação. Continuar?",
      ),
    ).toBeVisible();

    // Cancela sem recalcular — mesmo modal, botão "Cancelar".
    await page.locator(".modal-f").getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("heading", { name: /Recalcular —/ })).toHaveCount(0);
  });

  test("bloqueia o recálculo quando não consegue cancelar o pedido de desconto de outra seguradora", async ({
    page,
  }) => {
    let outroSolicitante: { solicitanteId: string; solicitacaoId: string } | null = null;
    await abrirCalculoComListaCarregada(page, async (cotacaoId) => {
      outroSolicitante = await criarSolicitacaoDescontoDeOutroUsuarioE2E(
        cotacaoId,
        "Porto",
        fixture.userId,
      );
    });

    try {
      // Recalcular a Mapfre descartaria a Porto — mas o pedido pendente da
      // Porto é de outro usuário, então `cancelar_desconto` recusa.
      const acoesMapfre = page.locator(".seg-acoes").first();
      await acoesMapfre.getByTitle("Recalcular só esta seguradora").click();
      await page
        .locator(".modal-f")
        .getByRole("button", { name: "Recalcular", exact: true })
        .click();

      await expect(page.getByText(/Não foi possível recalcular/i)).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText(/apenas o solicitante pode cancelar/i)).toBeVisible();
      // Nada foi enviado de novo — a lista continua com as duas seguradoras.
      await expect(page.locator(".calc-table thead .seg-item.on .seg-nome")).toHaveCount(2);
    } finally {
      if (outroSolicitante) await limparSolicitacaoDescontoDeOutroUsuarioE2E(outroSolicitante);
    }
  });

  test("caminho feliz: recalcular cancela o próprio pedido de outra seguradora e a lista fecha em só quem foi recalculado", async ({
    page,
  }) => {
    fixture = await criarCotacaoQuiverFixture();
    await definirSeguradorasSelE2E(fixture.cotacaoId, ["Mapfre", "Porto", "Azul"]);
    await marcarCalculoVistoE2E(fixture.cotacaoId);

    // Pedido de desconto PENDENTE do próprio vendedor numa das seguradoras
    // que vão sumir (Mapfre) — "Recalcular a Porto" precisa conseguir
    // cancelá-lo sozinho (mesmo solicitante) antes de reenviar.
    const propria = await criarSolicitacaoDescontoPropriaE2E(
      fixture.cotacaoId,
      "Mapfre",
      fixture.userId,
    );

    const resWebhook1 = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: { cotacaoId: fixture.cotacaoId, temPremios: true, cards: cardsPayload3() },
    });
    expect(resWebhook1.ok()).toBeTruthy();

    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
    await expect(page.getByText(/compare, personalize e escolha a seguradora/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(".calc-table thead .seg-item.on .seg-nome")).toHaveCount(3);

    await interceptarEnviarCotacaoQuiver(page);

    // Recalcular a Porto (índice 1 na tabela: Mapfre, Porto, Azul).
    const acoesPorto = page.locator(".seg-acoes").nth(1);
    await acoesPorto.getByTitle("Recalcular só esta seguradora").click();
    await expect(page.getByRole("heading", { name: "Recalcular — Porto" })).toBeVisible();
    await expect(
      page.getByText(
        "Recalcular só a Porto descarta as ofertas das outras 2 seguradoras desta cotação. Continuar?",
      ),
    ).toBeVisible();
    await page.locator(".modal-f").getByRole("button", { name: "Recalcular", exact: true }).click();

    // O pedido de desconto próprio da Mapfre foi cancelado — sem esperar o
    // webhook, isso já acontece na chamada de `cancelar_desconto` disparada
    // pelo clique (RPC real, banco real).
    await expect
      .poll(() => statusSolicitacaoDescontoE2E(propria.solicitacaoId), { timeout: 10_000 })
      .toBe("cancelado");
    // `persistirAntes` grava `seguradoras_sel=['Porto']` ANTES de chamar a
    // (interceptada) `enviarCotacaoQuiver` — RPC real também.
    await expect
      .poll(() => seguradorasSelE2E(fixture.cotacaoId), { timeout: 10_000 })
      .toEqual(["Porto"]);

    // Sem erro de bloqueio — o painel de "Não foi possível recalcular" nunca aparece.
    await expect(page.getByText(/Não foi possível recalcular/i)).toHaveCount(0);

    // Simula o retorno assíncrono do robô: só a Porto (narrowing real do
    // webhook, mesmo endpoint usado no resto da suíte).
    const resWebhook2 = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: {
        cotacaoId: fixture.cotacaoId,
        temPremios: true,
        cards: [cardsPayload3()[1]], // só a Porto
      },
    });
    expect(resWebhook2.ok()).toBeTruthy();

    // O polling (Supabase real, a cada 4s) detecta a mudança sozinho.
    await expect(page.locator(".calc-table thead .seg-item.on .seg-nome")).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(page.locator(".calc-table thead .seg-item.on .seg-nome")).toHaveText(["Porto"]);
    // Nem Mapfre nem Azul sobram como "Sem retorno" — `f.seguradorasSel` já
    // foi restrito a `['Porto']` no próprio clique (setF local), não fica
    // esperando o round-trip do banco.
    await expect(page.getByText("Sem retorno", { exact: true })).toHaveCount(0);
  });

  test("NEGATIVO: cancelar a confirmação do recálculo não altera nada", async ({ page }) => {
    await abrirCalculoComListaCarregada(page);

    let chamouServidor = false;
    await page.route("**/_serverFn/**", async (route) => {
      chamouServidor = true;
      await route.continue();
    });

    const acoesMapfre = page.locator(".seg-acoes").first();
    await acoesMapfre.getByTitle("Recalcular só esta seguradora").click();
    await expect(page.getByRole("heading", { name: "Recalcular — Mapfre" })).toBeVisible();
    await page.locator(".modal-f").getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("heading", { name: /Recalcular —/ })).toHaveCount(0);

    // Dá um tempo pro clique processar — se algo fosse disparado, já teria
    // sido interceptado pela rota acima.
    await page.waitForTimeout(1000);
    expect(chamouServidor).toBe(false);
    await expect(page.getByText(/Não foi possível recalcular/i)).toHaveCount(0);
    await expect(page.locator(".calc-table thead .seg-item.on .seg-nome")).toHaveCount(2);
    await expect.poll(() => seguradorasSelE2E(fixture.cotacaoId)).toEqual(["Mapfre", "Porto"]);
  });
});
