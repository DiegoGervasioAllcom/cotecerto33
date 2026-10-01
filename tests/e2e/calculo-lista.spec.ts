import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarCotacaoQuiverFixture,
  definirSeguradorasSelE2E,
  limparCotacaoQuiverFixture,
  QUIVER_WEBHOOK_HEADERS,
  type CotacaoQuiverFixture,
} from "./provision";

/**
 * E2E da lista comparativa do passo Cálculo como visão padrão (V12.3.5 ·
 * `CalculoLista.tsx`/`calc-lista` no protótipo V12): confirma que a tela abre
 * na lista (não nos cartões), que a faixa de contexto mostra o número real
 * da cotação, que a ordenação/faixa de preço reordenam e filtram as colunas
 * de verdade, que a coluna "Sem retorno" só aparece quando existe seguradora
 * selecionada sem card de volta, e que "Contratar" pela lista chega no
 * mini-wizard da Transmissão — igual ao botão do card (`webhook-transmissao.spec.ts`).
 *
 * Mesma decisão de escopo de `quiver-webhook.spec.ts`: cotação calculada via
 * webhook simulado (`POST /api/webhooks/quiver`), sem depender do robô real.
 */

const SEGURADORA_ALFA = "Seguradora Alfa";
const SEGURADORA_BETA = "Seguradora Beta";
const SEGURADORA_SEM_RETORNO = "Seguradora Sem Retorno E2E";

function cardsPayload() {
  return [
    {
      index: 0,
      seguradora: SEGURADORA_ALFA,
      produto: "Auto Completo",
      nome: "Plano Premium",
      opcoes: [
        {
          tipo: "Compreensiva",
          franquia: "Reduzida · R$ 2.450,00",
          avista: "R$ 2.345,67",
          parcelas: "10x de R$ 251,90",
        },
      ],
      coberturasBasicas: { Casco: "100% FIPE" },
      premiosPorFormaPagamento: [
        {
          formaPagamento: "Cartão de crédito",
          opcoes: [
            {
              tipo: "Compreensiva",
              franquia: "Reduzida · R$ 2.450,00",
              avista: "R$ 2.345,67",
              parcelas: "10x de R$ 251,90",
            },
          ],
        },
      ],
    },
    {
      index: 1,
      seguradora: SEGURADORA_BETA,
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
      premiosPorFormaPagamento: [
        {
          formaPagamento: "Boleto",
          opcoes: [
            {
              tipo: "Compreensiva Plus",
              franquia: "Majorada · R$ 4.000,00",
              avista: "R$ 4.200,00",
              parcelas: "12x de R$ 385,00",
            },
          ],
        },
      ],
    },
  ];
}

test.describe("Cálculo — lista comparativa como visão padrão (V12.3.5)", () => {
  let fixture: CotacaoQuiverFixture;

  test.afterEach(async () => {
    if (fixture) await limparCotacaoQuiverFixture(fixture);
  });

  async function abrirCalculoComListaCarregada(page: Page) {
    fixture = await criarCotacaoQuiverFixture();
    await definirSeguradorasSelE2E(fixture.cotacaoId, [
      SEGURADORA_ALFA,
      SEGURADORA_BETA,
      SEGURADORA_SEM_RETORNO,
    ]);

    const res = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: { cotacaoId: fixture.cotacaoId, temPremios: true, cards: cardsPayload() },
    });
    expect(res.ok()).toBeTruthy();

    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
    await expect(page.getByText(/compare, personalize e escolha a seguradora/i)).toBeVisible({
      timeout: 10_000,
    });
  }

  /** Nomes das seguradoras (só colunas de oferta, `.seg-item.on` — a
   * "sem retorno" não conta como oferta) na ordem das colunas da lista. */
  function ordemColunas(page: Page) {
    return page.locator(".calc-table thead .seg-item.on .seg-nome").allTextContents();
  }

  test("abre na lista comparativa, com número real, cliente, padrão e validade no contexto", async ({
    page,
  }) => {
    await abrirCalculoComListaCarregada(page);

    await expect(page.locator('[data-tour="calc-lista"]')).toBeVisible();
    await expect(page.locator(".calc-card")).toHaveCount(0);

    // Alternância marcada em "lista" por padrão.
    const btnLista = page.getByTitle("Ver em lista comparativa");
    await expect(btnLista).toHaveClass(/on/);
    await expect(page.getByTitle("Ver em cartões")).not.toHaveClass(/on/);

    const ctx = page.locator('[data-tour="calc-ctx"]');
    await expect(ctx).toBeVisible();
    await expect(ctx).toContainText(/COT-\d{4}-\d{5}/);
    const validade = new Date();
    validade.setDate(validade.getDate() + 5);
    const z = (n: number) => (n < 10 ? "0" : "") + n;
    const validadeEsperada = `${z(validade.getDate())}/${z(validade.getMonth() + 1)}/${validade.getFullYear()}`;
    await expect(ctx).toContainText(validadeEsperada);
  });

  test("alterna para cartões e volta para a lista pelo mesmo toolset", async ({ page }) => {
    await abrirCalculoComListaCarregada(page);

    await page.getByTitle("Ver em cartões").click();
    await expect(page.locator(".calc-grid")).toBeVisible();
    await expect(page.locator(".calc-lista")).toHaveCount(0);
    await expect(page.getByTitle("Ver em cartões")).toHaveClass(/on/);

    await page.getByTitle("Ver em lista comparativa").click();
    await expect(page.locator('[data-tour="calc-lista"]')).toBeVisible();
    await expect(page.locator(".calc-grid")).toHaveCount(0);
  });

  test("ordenação menor/maior preço muda a ordem das colunas de oferta", async ({ page }) => {
    await abrirCalculoComListaCarregada(page);

    // Padrão "menor preço": Alfa (R$ 2.345,67) antes de Beta (R$ 4.200,00).
    await expect.poll(() => ordemColunas(page)).toEqual([SEGURADORA_ALFA, SEGURADORA_BETA]);

    await page.getByLabel("Ordenação").selectOption("maior");
    await expect.poll(() => ordemColunas(page)).toEqual([SEGURADORA_BETA, SEGURADORA_ALFA]);

    await page.getByLabel("Ordenação").selectOption("menor");
    await expect.poll(() => ordemColunas(page)).toEqual([SEGURADORA_ALFA, SEGURADORA_BETA]);
  });

  test("faixa de preço esconde a oferta fora da faixa, mas nunca a coluna sem retorno", async ({
    page,
  }) => {
    await abrirCalculoComListaCarregada(page);

    // "R$ 4.000 a R$ 5.000" só bate com a Beta (R$ 4.200,00) — a Alfa
    // (R$ 2.345,67) some, mas a "Sem retorno" continua (nunca é escondida
    // por faixa, o card não tem prêmio pra comparar).
    await page.getByLabel("Faixa de preço").selectOption("4000a5000");
    await expect.poll(() => ordemColunas(page)).toEqual([SEGURADORA_BETA]);
    await expect(page.getByText(SEGURADORA_SEM_RETORNO).first()).toBeVisible();
    await expect(page.getByText(SEGURADORA_ALFA)).toHaveCount(0);

    await page.getByLabel("Faixa de preço").selectOption("");
    await expect.poll(() => ordemColunas(page)).toEqual([SEGURADORA_ALFA, SEGURADORA_BETA]);
  });

  test("seguradora selecionada sem retorno aparece com a coluna e a mensagem 'Sem retorno'", async ({
    page,
  }) => {
    await abrirCalculoComListaCarregada(page);

    const colunaSemRetorno = page
      .locator(".calc-table thead th")
      .filter({ hasText: SEGURADORA_SEM_RETORNO });
    await expect(colunaSemRetorno).toBeVisible();
    await expect(colunaSemRetorno.locator("small")).toHaveText("sem retorno");

    const linhaAcoes = page.locator(".calc-table tbody tr").last();
    const celulaSemRetorno = linhaAcoes.locator("td").filter({ hasText: "Sem retorno" });
    await expect(celulaSemRetorno).toBeVisible();
  });

  test("faixas diferentes viram um bloco por faixa, com rótulo de parcelas", async ({ page }) => {
    await abrirCalculoComListaCarregada(page);

    const blocos = page.getByTestId("cl-faixa-bloco");
    await expect(blocos).toHaveText([/Compreensiva$/, /Compreensiva Plus/]);
    const linha = page.locator(".calc-table tr.cl-preco");
    await expect(linha.locator("td.cl-lbl")).toHaveText("10 parcelas");
    await expect(linha.locator("td.cl-cell").filter({ hasText: "10x de R$ 251,90" })).toHaveCount(
      1,
    );
    await expect(
      page.locator(".calc-table tr.cl-parc td.cl-lbl").filter({ hasText: "12 parcelas" }),
    ).toHaveCount(1);
  });

  test("Contratar pela lista (célula de parcela no hover) chega ao sub-passo de Transmissão", async ({
    page,
  }) => {
    await abrirCalculoComListaCarregada(page);

    const celulaParcela = page
      .locator(".calc-table tr.cl-preco td.cl-cell")
      .filter({ hasText: "10x de R$ 251,90" });
    await celulaParcela.hover();
    await celulaParcela.locator(".cl-buy").click();

    await expect(page.getByRole("heading", { name: "Dados complementares" })).toBeVisible();
  });

  test("em viewport estreita, o cl-nav mostra quantas seguradoras ficaram fora e as setas rolam", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 420, height: 800 });
    await abrirCalculoComListaCarregada(page);

    const nav = page.locator('[data-tour="cl-nav"]');
    const contador = nav.locator(".cl-cont");
    const setaDireita = nav.getByTitle("Ver as seguradoras à direita");
    const setaEsquerda = nav.getByTitle("Ver as seguradoras à esquerda");

    // As 3 colunas (2 ofertas + sem retorno) não cabem em 420px — alguma
    // fica de fora e a seta esquerda começa desabilitada (início da rolagem).
    await expect(contador).toContainText(/à direita/);
    await expect(setaEsquerda).toBeDisabled();
    await expect(setaDireita).toBeEnabled();

    await setaDireita.click();
    await expect(setaEsquerda).toBeEnabled();
  });
});
