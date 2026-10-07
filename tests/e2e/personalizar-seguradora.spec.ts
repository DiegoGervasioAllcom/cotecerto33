import { createServer, type Server } from "node:http";
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarCotacaoQuiverFixture,
  definirSeguradorasSelE2E,
  limparCotacaoQuiverFixture,
  marcarCalculoVistoE2E,
  preencherCamposCalculoE2E,
  QUIVER_WEBHOOK_HEADERS,
  type CotacaoQuiverFixture,
} from "./provision";

/**
 * E2E de "Personalizar coberturas" (V12.3.7): engrenagem → modal (só Coberturas
 * funcional) → "Aplicar e recalcular" → o robô recebe UM `cobertura` ajustado.
 *
 * TRAVA: o servidor da app faz o POST /cotacao; se apontasse para o robô real,
 * criaria cotação REAL no portal. Por isso o spec só roda com opt-in
 * (CI ou E2E_ROBO_MOCK=1), com SELF_QUIVER_API_URL local (o playwright.config
 * força http://127.0.0.1:3999 e sobe um servidor novo) e mock na porta 3999.
 */

const PORTA_ROBO = 3999;

function urlRoboLocal(): boolean {
  try {
    const { hostname, port } = new URL(process.env.SELF_QUIVER_API_URL ?? "");
    return ["localhost", "127.0.0.1"].includes(hostname) && port === String(PORTA_ROBO);
  } catch {
    return false;
  }
}

function cards() {
  return [
    {
      index: 0,
      seguradora: "Mapfre",
      produto: "Auto Completo",
      nome: "Plano Standard",
      opcoes: [{ tipo: "Compreensiva", franquia: "R$ 2.000,00", avista: "R$ 2.500,00" }],
      coberturasBasicas: { Casco: "100% FIPE" },
    },
    {
      index: 1,
      seguradora: "Porto",
      produto: "Auto Flex",
      nome: "Plano Flexível",
      opcoes: [{ tipo: "Compreensiva Plus", franquia: "R$ 4.000,00", avista: "R$ 4.200,00" }],
      coberturasBasicas: { Casco: "110% FIPE" },
    },
  ];
}

type CorpoRobo = {
  seguro?: { seguradorasDisponiveis?: string[] };
  cobertura?: Record<string, unknown>;
};

test.describe("Personalizar coberturas por seguradora (V12.3.7)", () => {
  let fixture: CotacaoQuiverFixture | undefined;
  let robo: Server | undefined;
  const corpos: CorpoRobo[] = [];

  test.beforeEach(async () => {
    test.skip(
      !(process.env.CI || process.env.E2E_ROBO_MOCK === "1"),
      "opt-in obrigatório: rode com E2E_ROBO_MOCK=1 (ou CI) — evita enviar ao robô real",
    );
    test.skip(
      !urlRoboLocal(),
      `SELF_QUIVER_API_URL precisa ser local na porta ${PORTA_ROBO} — pulado por segurança`,
    );
    corpos.length = 0;
    robo = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        if (req.method === "POST" && req.url?.startsWith("/cotacao")) {
          corpos.push(JSON.parse(raw) as CorpoRobo);
          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        res.writeHead(404).end();
      });
    });
    const ok = await new Promise<boolean>((resolve) => {
      robo?.once("error", () => resolve(false));
      robo?.listen(PORTA_ROBO, "127.0.0.1", () => resolve(true));
    });
    test.skip(!ok, `porta ${PORTA_ROBO} ocupada — teste pulado por segurança`);
  });

  test.afterEach(async () => {
    await new Promise<void>((r) => (robo ? robo.close(() => r()) : r()));
    if (fixture) await limparCotacaoQuiverFixture(fixture);
    fixture = undefined;
  });

  async function abrir(page: Page) {
    fixture = await criarCotacaoQuiverFixture();
    await definirSeguradorasSelE2E(fixture.cotacaoId, ["Mapfre", "Porto"]);
    await marcarCalculoVistoE2E(fixture.cotacaoId);
    await preencherCamposCalculoE2E(fixture.cotacaoId);
    const res = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: { cotacaoId: fixture.cotacaoId, temPremios: true, cards: cards() },
    });
    expect(res.ok()).toBeTruthy();
    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
    await expect(page.getByText(/compare, personalize e escolha a seguradora/i)).toBeVisible({
      timeout: 10_000,
    });
  }

  test("personaliza a Porto, recalcula só ela e o robô recebe os valores ajustados", async ({
    page,
  }) => {
    await abrir(page);
    const acoesPorto = page.locator(".seg-acoes").nth(1);
    await acoesPorto.getByTitle("Opções: análise do envio").click();
    await page.getByText("Personalizar coberturas").click();

    await expect(page.getByRole("heading", { name: "Personalizar Porto" })).toBeVisible();
    // "Coberturas" e "+ Comissões" funcionais; Assistências e Descontos "(em breve)".
    for (const nome of [/Assistências \(em breve\)/, /Descontos \(em breve\)/])
      await expect(page.getByRole("button", { name: nome })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Coberturas$/ })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Comissões$/ })).toBeEnabled();
    // Porto: o portal não deixa editar a comissão — a aba avisa e não oferece o campo.
    await page.getByRole("button", { name: /Comissões$/ }).click();
    await expect(page.getByText(/Definida pela seguradora/)).toBeVisible();
    await page.getByRole("button", { name: /Coberturas$/ }).click();
    await expect(page.getByText(/vale só para Porto/)).toBeVisible();

    await page.getByLabel("1ª opção de franquia").selectOption("Reduzida 25%");
    await page.getByLabel("Vidros, faróis e retrovisores").selectOption("Superior");
    await page.getByRole("button", { name: /Aplicar e recalcular Porto/ }).click();

    await expect(page.getByRole("heading", { name: "Recalcular — Porto" })).toBeVisible();
    await expect(
      page.getByText(/com as coberturas ajustadas: franquia Reduzida 25%, vidros Superior/),
    ).toBeVisible();
    await page.locator(".modal-f").getByRole("button", { name: "Recalcular", exact: true }).click();

    await expect.poll(() => corpos.length, { timeout: 15_000 }).toBe(1);
    expect(corpos[0].seguro?.seguradorasDisponiveis).toEqual(["porto"]);
    expect(corpos[0].cobertura).toMatchObject({
      franquiaPrimeiraOpcao: "Reduzida 25%",
      vidrosFarosRetrovisores: "Superior",
    });

    // Retorno do robô: só a Porto → selo "personalizada" no comparativo.
    const r2 = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: { cotacaoId: fixture?.cotacaoId, temPremios: true, cards: [cards()[1]] },
    });
    expect(r2.ok()).toBeTruthy();
    await expect(page.locator(".calc-table thead .seg-item.on .seg-nome")).toHaveText(["Porto"], {
      timeout: 15_000,
    });
    await expect(page.getByTestId("selo-personalizada")).toBeVisible();

    // Recálculo geral (toolbar) marca o ajuste como não aplicado: selo some.
    const geral = page.getByRole("button", { name: "Recalcular", exact: true });
    await expect(geral).toBeEnabled();
    await geral.click();
    // O último recálculo foi só da Porto: a barra avisa antes de repetir só ela.
    await page.getByRole("button", { name: "Recalcular só Porto" }).click();
    await expect.poll(() => corpos.length, { timeout: 15_000 }).toBe(2);
    expect(corpos[1].cobertura?.franquiaPrimeiraOpcao).not.toBe("Reduzida 25%");
    await expect(page.getByTestId("selo-personalizada")).toHaveCount(0);
  });

  test("Cancelar o modal não salva nem envia nada", async ({ page }) => {
    await abrir(page);
    await page.locator(".seg-acoes").first().getByTitle("Opções: análise do envio").click();
    await page.getByText("Personalizar coberturas").click();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("heading", { name: /Personalizar/ })).toHaveCount(0);
    expect(corpos).toHaveLength(0);
  });
});
