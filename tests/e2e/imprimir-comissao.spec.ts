import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarCotacaoQuiverFixture,
  definirPercComissaoEmpresaE2E,
  limparCotacaoQuiverFixture,
  listarImpressoesE2E,
  marcarCalculoVistoE2E,
  QUIVER_WEBHOOK_HEADERS,
  type CotacaoQuiverFixture,
} from "./provision";

/**
 * E2E da Impressão — fatia B (V12.1.37): "Imprimir comissão" com o % real da
 * empresa, documento interno, trava de envio externo e registro imutável em
 * `cotacao_impressoes`.
 */
test.describe("Imprimir cotação — comissão e registro (fatia B)", () => {
  let fixture: CotacaoQuiverFixture;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000);
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
    await marcarCalculoVistoE2E(fixture.cotacaoId);
    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    page.on("popup", (p) => void p.close().catch(() => undefined));
  });

  test.afterEach(async () => {
    if (fixture) {
      // As linhas de `cotacao_impressoes` são imutáveis e ficam (sem FK para a cotação);
      // só a cotação e o resto da fixture são apagados.
      await limparCotacaoQuiverFixture(fixture);
    }
  });

  async function abrirConfig(page: Page) {
    await page.goto(`/venda/cotacoes/${fixture.cotacaoId}`);
    await page.getByRole("button", { name: "Imprimir comparativo" }).click();
    await page.getByText("Configurar impressão", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Configurar impressão" })).toBeVisible();
  }

  test("com % cadastrado: habilita, bloqueia envio externo e registra com_comissao + pct", async ({
    page,
  }) => {
    await definirPercComissaoEmpresaE2E(fixture.empresaId, 12.5);
    await abrirConfig(page);

    const comissao = page.getByText(/^Imprimir comissão/);
    await expect(comissao).not.toHaveAttribute("aria-disabled", "true");
    await comissao.click();
    await page.getByRole("button", { name: "Confirmar" }).click();

    const doc = page.locator(".pv-doc");
    await expect(doc).toContainText("Comissão da corretora");
    await expect(doc).toContainText("12,50%");
    await expect(doc).toContainText("USO INTERNO — NÃO ENVIAR AO CLIENTE");
    await expect(page.getByText(/Documento interno com comissão/).first()).toBeVisible();
    for (const nome of [/^E-mail/, /^SMS/, /^WhatsApp/, /^Gerar link/]) {
      await expect(page.getByRole("button", { name: nome })).toBeDisabled();
    }

    await page.getByRole("button", { name: "Baixar PDF" }).click();
    await expect
      .poll(async () => (await listarImpressoesE2E(fixture.cotacaoId)).length, { timeout: 10_000 })
      .toBe(1);
    const [linha] = await listarImpressoesE2E(fixture.cotacaoId);
    expect(linha.com_comissao).toBe(true);
    expect(Number(linha.pct_exibido)).toBe(12.5);
    expect(linha.acao).toBe("baixar");
  });

  test("sem % cadastrado: checkbox desabilitado com aviso", async ({ page }) => {
    await definirPercComissaoEmpresaE2E(fixture.empresaId, null);
    await abrirConfig(page);
    const comissao = page.getByText(/^Imprimir comissão/);
    await expect(comissao).toHaveAttribute("aria-disabled", "true");
    await expect(comissao).toContainText("% de comissão não cadastrado");
  });

  test("sem comissão: baixar registra com_comissao = false e PDF do cliente sem comissão", async ({
    page,
  }) => {
    await definirPercComissaoEmpresaE2E(fixture.empresaId, 12.5);
    await abrirConfig(page);
    await page.getByRole("button", { name: "Confirmar" }).click();
    const doc = page.locator(".pv-doc");
    await expect(doc).not.toContainText("Comissão da corretora");
    await expect(doc).not.toContainText("Controle interno");

    await page.getByRole("button", { name: "Baixar PDF" }).click();
    await expect
      .poll(async () => (await listarImpressoesE2E(fixture.cotacaoId)).length, { timeout: 10_000 })
      .toBe(1);
    const [linha] = await listarImpressoesE2E(fixture.cotacaoId);
    expect(linha.com_comissao).toBe(false);
    expect(linha.pct_exibido).toBeNull();
  });

  test("fail-closed: com comissão e registro falhando, o documento NÃO é gerado e o erro aparece", async ({
    page,
  }) => {
    await definirPercComissaoEmpresaE2E(fixture.empresaId, 12.5);
    await page.route("**/rest/v1/rpc/rpc_registrar_impressao", (r) =>
      r.fulfill({ status: 500, contentType: "application/json", body: '{"message":"falha"}' }),
    );
    let popups = 0;
    page.on("popup", () => popups++);
    await abrirConfig(page);
    await page.getByText(/^Imprimir comissão/).click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await page.getByRole("button", { name: "Baixar PDF" }).click();
    await expect(page.getByTestId("impressao-mensagem")).toContainText(
      "O documento com comissão não foi gerado",
    );
    await page.waitForTimeout(800);
    expect(popups).toBe(0);
    expect(await listarImpressoesE2E(fixture.cotacaoId)).toHaveLength(0);
  });

  test("sem comissão e registro falhando: o download segue e aparece o aviso", async ({ page }) => {
    await page.route("**/rest/v1/rpc/rpc_registrar_impressao", (r) =>
      r.fulfill({ status: 500, contentType: "application/json", body: '{"message":"falha"}' }),
    );
    const popup = page.waitForEvent("popup");
    await abrirConfig(page);
    await page.getByRole("button", { name: "Confirmar" }).click();
    await page.getByRole("button", { name: "Baixar PDF" }).click();
    await popup;
    await expect(page.getByTestId("impressao-mensagem")).toContainText(
      "não foi possível registrar esta impressão",
    );
  });
});
