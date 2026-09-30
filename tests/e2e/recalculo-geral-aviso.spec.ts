import { createServer, type Server } from "node:http";
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarCotacaoQuiverFixture,
  definirSeguradorasSelE2E,
  limparCotacaoQuiverFixture,
  marcarCalculoVistoE2E,
  preencherCamposCalculoE2E,
  seguradorasSelE2E,
  QUIVER_WEBHOOK_HEADERS,
  type CotacaoQuiverFixture,
} from "./provision";

/**
 * E2E do aviso do "Recalcular" da barra depois de "Recalcular só esta seguradora"
 * (a seleção fica reduzida): cancelar / só ela / voltar às N de antes.
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

test.describe("Aviso do recálculo geral após recálculo único", () => {
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

  async function recalcularSoPorto(page: Page) {
    await page.getByTitle("Recalcular só esta seguradora").nth(1).click();
    await page.locator(".modal-f").getByRole("button", { name: "Recalcular", exact: true }).click();
    await expect.poll(() => corpos.length, { timeout: 15_000 }).toBe(1);
    expect(corpos[0].seguro?.seguradorasDisponiveis).toEqual(["porto"]);
    await expect
      .poll(() => seguradorasSelE2E(fixture?.cotacaoId ?? ""), { timeout: 10_000 })
      .toEqual(["Porto"]);
    const r = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: { cotacaoId: fixture?.cotacaoId, temPremios: true, cards: [cards()[1]] },
    });
    expect(r.ok()).toBeTruthy();
    await expect(page.locator(".calc-table thead .seg-item.on .seg-nome")).toHaveText(["Porto"], {
      timeout: 15_000,
    });
  }

  const barra = (page: Page) => page.getByRole("button", { name: "Recalcular", exact: true });
  const texto = /O último recálculo foi só da Porto, então só ela está no cálculo agora\./;

  test("aviso abre; Cancelar não envia nada", async ({ page }) => {
    await abrir(page);
    await recalcularSoPorto(page);
    await barra(page).click();
    await expect(page.getByText(texto)).toBeVisible();
    await page.locator(".modal-f").getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText(texto)).toHaveCount(0);
    expect(corpos).toHaveLength(1);
  });

  test("Voltar às 2 seguradoras restaura a seleção e recalcula com as duas", async ({ page }) => {
    await abrir(page);
    await recalcularSoPorto(page);
    await barra(page).click();
    await expect(page.getByText(texto)).toBeVisible();
    await page
      .getByRole("button", { name: "Voltar às 2 seguradoras de antes e recalcular" })
      .click();
    await expect.poll(() => corpos.length, { timeout: 15_000 }).toBe(2);
    expect([...(corpos[1].seguro?.seguradorasDisponiveis ?? [])].sort()).toEqual([
      "mapfre",
      "porto",
    ]);
    await expect
      .poll(async () => (await seguradorasSelE2E(fixture?.cotacaoId ?? "")).sort())
      .toEqual(["Mapfre", "Porto"]);
    await expect(page.getByText(texto)).toHaveCount(0);
  });

  test("Recalcular só a Porto envia só ela; depois não avisa mais", async ({ page }) => {
    await abrir(page);
    await recalcularSoPorto(page);
    await barra(page).click();
    await page.getByRole("button", { name: "Recalcular só Porto" }).click();
    await expect.poll(() => corpos.length, { timeout: 15_000 }).toBe(2);
    expect(corpos[1].seguro?.seguradorasDisponiveis).toEqual(["porto"]);
    expect(await seguradorasSelE2E(fixture?.cotacaoId ?? "")).toEqual(["Porto"]);
    const r = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: { cotacaoId: fixture?.cotacaoId, temPremios: true, cards: [cards()[1]] },
    });
    expect(r.ok()).toBeTruthy();
    await expect(barra(page)).toBeEnabled({ timeout: 15_000 });
    await barra(page).click();
    await expect.poll(() => corpos.length, { timeout: 15_000 }).toBe(3);
    await expect(page.getByText(texto)).toHaveCount(0);
  });

  test("sem recálculo único prévio, Recalcular não pergunta", async ({ page }) => {
    await abrir(page);
    await barra(page).click();
    await expect.poll(() => corpos.length, { timeout: 15_000 }).toBe(1);
    await expect(page.getByText(/O último recálculo foi só da/)).toHaveCount(0);
    expect([...(corpos[0].seguro?.seguradorasDisponiveis ?? [])].sort()).toEqual([
      "mapfre",
      "porto",
    ]);
  });
});
