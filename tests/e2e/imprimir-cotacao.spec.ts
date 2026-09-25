import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarCotacaoQuiverFixture,
  limparCotacaoQuiverFixture,
  marcarCalculoVistoE2E,
  QUIVER_WEBHOOK_HEADERS,
  type CotacaoQuiverFixture,
} from "./provision";

/**
 * E2E do modal "Imprimir cotação" (Frente 3 V12 · 7a — `ImprimirCotacaoModal`,
 * `src/lib/print.ts::buildCotacaoDoc`). Reusa o mesmo fixture/webhook do
 * Passo 6 (`quiver-webhook.spec.ts`) só para ter uma cotação `calculada` com
 * duas seguradoras — o alvo aqui é o modal em si (porta → config/expressa →
 * preview), não o cálculo.
 */
test.describe("Imprimir cotação — modal comum aos 3 pontos de entrada", () => {
  let fixture: CotacaoQuiverFixture;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(45_000);
    fixture = await criarCotacaoQuiverFixture();
    const res = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: {
        cotacaoId: fixture.cotacaoId,
        temPremios: true,
        cards: [
          {
            index: 10,
            seguradora: "Seguradora Alfa",
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
          },
          {
            index: 20,
            seguradora: "Seguradora Beta",
            produto: "Auto Essencial",
            nome: "Plano Econômico",
            opcoes: [
              {
                tipo: "Compreensiva",
                franquia: "Normal · R$ 3.100,00",
                avista: "R$ 1.987,65",
                parcelas: "12x de R$ 195,48",
              },
            ],
            coberturasBasicas: { Casco: "90% FIPE" },
          },
        ],
      },
    });
    expect(res.ok()).toBeTruthy();
    // O aviso lateral "COTAÇÃO FINALIZADA" (`cotacao-finalizada-aviso.tsx`)
    // não é o alvo deste spec e fica atrás do modal — marca vista de
    // antemão pra ele nunca aparecer e interceptar cliques.
    await marcarCalculoVistoE2E(fixture.cotacaoId);

    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
  });

  test.afterEach(async () => {
    if (fixture) await limparCotacaoQuiverFixture(fixture);
  });

  test("Passo Cálculo: botão de imprimir tem o data-tour e abre o mesmo modal", async ({
    page,
  }) => {
    await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
    await expect(page.getByText(/compare, personalize e escolha a seguradora/i)).toBeVisible({
      timeout: 10_000,
    });

    const botaoImprimir = page.locator('[data-tour="calc-imprimir"]');
    await expect(botaoImprimir).toBeVisible();
    await expect(botaoImprimir).toHaveText(/Imprimir/);

    await botaoImprimir.click();
    await expect(page.getByRole("heading", { name: "Imprimir cotação" })).toBeVisible();
    await expect(page.getByText("Configurar impressão", { exact: true })).toBeVisible();
    await expect(page.getByText("Impressão expressa", { exact: true })).toBeVisible();
  });

  test("sem seguradora selecionada, o zod bloqueia a confirmação (mensagem de erro, sem preview)", async ({
    page,
  }) => {
    await page.goto(`/venda/cotacoes/${fixture.cotacaoId}`);
    await page.getByRole("button", { name: "Imprimir comparativo" }).click();
    await page.getByText("Configurar impressão", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Configurar impressão" })).toBeVisible();

    // As duas seguradoras vêm pré-selecionadas (configPadrao) — "Nenhuma"
    // esvazia a seleção.
    await expect(page.getByText("2 de 2", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Nenhuma" }).click();
    await expect(page.getByText("0 de 2", { exact: false })).toBeVisible();
    await expect(page.getByText("Escolha ao menos uma seguradora")).toBeVisible();

    const confirmar = page.getByRole("button", { name: "Confirmar" });
    await expect(confirmar).toBeDisabled();
    // Nenhum request de impressão deve sair — não há popup nem preview.
    await expect(page.getByRole("heading", { name: "Impressão da cotação" })).not.toBeVisible();
  });

  test("modelo Marca da seguradora com as 2 seguradoras: sai um documento com a 1ª e aviso das demais no mesmo PDF", async ({
    page,
  }) => {
    await page.goto(`/venda/cotacoes/${fixture.cotacaoId}`);
    await page.getByRole("button", { name: "Imprimir comparativo" }).click();
    await page.getByText("Configurar impressão", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Configurar impressão" })).toBeVisible();

    // Modelo "Marca da seguradora" — mantém as 2 seguradoras marcadas
    // (comportamento real do componente hoje: `buildCotacaoDoc` não separa
    // em N documentos, gera 1 documento com a marca da 1ª seguradora
    // selecionada e um aviso de que as demais seguem no mesmo PDF).
    await page.getByText("Marca da seguradora", { exact: true }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();

    await expect(page.getByRole("heading", { name: "Impressão da cotação" })).toBeVisible();
    const doc = page.locator(".pv-doc");
    // `ordenarResultados` põe a mais barata primeiro (Beta, R$ 1.987,65 <
    // Alfa, R$ 2.345,67) — o modelo "cia" usa a 1ª seguradora selecionada
    // nessa ordem, não a ordem de clique no card.
    await expect(doc.locator(".doc-logo-cia span").first()).toHaveText("Seguradora Beta");
    await expect(doc.getByText(/um documento por cia/i)).toBeVisible();
    await expect(doc.getByText(/os outros 1 seguem no mesmo PDF/i)).toBeVisible();
    await expect(doc).toContainText("Seguradora Alfa");
  });

  test("envio (e-mail/SMS/WhatsApp/gerar link) e Imprimir comissão ficam desabilitados e não disparam request", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (!url.includes("/venda/") && !url.startsWith("http://localhost")) return;
      if (req.method() !== "GET") requests.push(`${req.method()} ${url}`);
    });

    await page.goto(`/venda/cotacoes/${fixture.cotacaoId}`);
    await page.getByRole("button", { name: "Imprimir comparativo" }).click();
    await page.getByText("Configurar impressão", { exact: true }).click();

    // O texto do <label> concatena o rótulo com o <small> do aviso
    // ("Imprimir comissãoDisponível em breve") — não dá pra casar exato.
    const imprimirComissao = page.getByText(/^Imprimir comissão/);
    await expect(imprimirComissao).toBeVisible();
    await expect(imprimirComissao).toHaveAttribute("aria-disabled", "true");

    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByRole("heading", { name: "Impressão da cotação" })).toBeVisible();

    // Cada botão de envio tem um <small> de subtítulo dentro do nome
    // acessível ("E-mail com o PDF anexado") — casa só o começo do rótulo.
    for (const nome of [/^E-mail/, /^SMS/, /^WhatsApp/]) {
      const botao = page.getByRole("button", { name: nome });
      await expect(botao).toBeDisabled();
    }
    const gerarLink = page.getByRole("button", { name: /^Gerar link/ });
    await expect(gerarLink).toBeDisabled();

    // Só "Baixar PDF" está habilitado nesta fatia.
    await expect(page.getByRole("button", { name: "Baixar PDF" })).toBeEnabled();

    // Nenhuma requisição de rede (POST/PUT/DELETE) foi disparada pelos
    // controles desabilitados — nem envio, nem impressão de comissão.
    expect(requests).toEqual([]);
  });
});
