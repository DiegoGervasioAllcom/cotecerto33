// Fluxo completo do wizard mobile /m/cotar até o cálculo (Auto e Moto), com o robô
// MOCKADO (porta 3999) — NUNCA o robô/portal reais (o portal Quiver é produção).
// Só roda com opt-in: E2E_ROBO_MOCK=1 (ou CI), que faz o playwright.config forçar
// SELF_QUIVER_API_URL=http://127.0.0.1:3999 num servidor novo.
// CPF/placa vêm do cache semeado (sem API paga); ViaCEP e FIPE são interceptados.
import { createServer, type Server } from "node:http";
import { devices, expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  CPF_MOBILE_E2E,
  criarPersona,
  limparConsultaCpfE2E,
  limparConsultaPlacaE2E,
  limparCotacoesDoVendedorE2E,
  limparPersona,
  listarCotacoesDoVendedorE2E,
  PLACA_E2E,
  PLACA_MOTO_E2E,
  QUIVER_WEBHOOK_HEADERS,
  semearConsultaCpfE2E,
  semearConsultaPlacaE2E,
  semearConsultaPlacaMotoE2E,
  seguradorasSelE2E,
  type Persona,
} from "./provision";

test.use({ ...devices["Pixel 7"] });

const PORTA_ROBO = 3999;

function urlRoboLocal(): boolean {
  try {
    const { hostname, port } = new URL(process.env.SELF_QUIVER_API_URL ?? "");
    return ["localhost", "127.0.0.1"].includes(hostname) && port === String(PORTA_ROBO);
  } catch {
    return false;
  }
}

type CorpoRobo = {
  seguro?: { seguradorasDisponiveis?: string[] };
  [k: string]: unknown;
};

const CARDS = [
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

/** ViaCEP e FIPE determinísticos (sem rede externa). */
async function mockarExternos(page: Page) {
  await page.route("https://viacep.com.br/**", (r) =>
    r.fulfill({
      json: {
        cep: "01310-100",
        logradouro: "Avenida Paulista",
        bairro: "Bela Vista",
        localidade: "São Paulo",
        uf: "SP",
      },
    }),
  );
  await page.route("https://parallelum.com.br/fipe/api/v1/**", (r) => {
    const url = r.request().url();
    const moto = url.includes("/motos/");
    if (url.endsWith("/marcas"))
      return r.fulfill({
        json: moto
          ? [{ codigo: "101", nome: "Honda" }]
          : [{ codigo: "23", nome: "GM - Chevrolet" }],
      });
    if (url.endsWith("/modelos"))
      return r.fulfill({
        json: {
          modelos: moto
            ? [{ codigo: 5000, nome: "CG 160 FAN Flex" }]
            : [
                { codigo: 4001, nome: "COBALT LTZ 1.8 8V Econo.Flex 4p Mec." },
                { codigo: 4002, nome: "COBALT LTZ 1.8 8V Econo.Flex 4p Aut." },
              ],
        },
      });
    if (url.endsWith("/anos"))
      return r.fulfill({ json: [{ codigo: moto ? "2022-1" : "2015-1", nome: "x" }] });
    return r.fulfill({ json: { Valor: moto ? "R$ 15.000,00" : "R$ 43.399,00" } });
  });
}

async function passoSegurado(page: Page) {
  await page.goto("/m/cotar");
  await expect(page.getByText(/passo 1 de 5/i)).toBeVisible();
  // Negativo: sem preencher nada, Continuar não avança.
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/preencha:/i)).toBeVisible();
  await expect(page.getByText(/passo 1 de 5/i)).toBeVisible();

  await page.getByPlaceholder("000.000.000-00").fill(CPF_MOBILE_E2E);
  await expect(page.getByText(/cadastro encontrado: maria mobile e2e/i)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByLabel("Nome completo")).toHaveValue("Maria Mobile E2E");
  // O sexo veio do cadastro do CPF.
  await expect(page.getByRole("radio", { name: "Feminino", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByLabel("Estado civil").selectOption("Solteiro(a)");
  await page.getByPlaceholder("(11) 90000-0000").fill("11912345678");
  await page.getByPlaceholder("00000-000").fill("01310100");
  await expect(page.getByText(/avenida paulista/i)).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
}

async function passosUsoAteRevisar(page: Page) {
  await expect(page.getByText(/passo 3 de 5/i)).toBeVisible({ timeout: 15_000 });
  await page.getByPlaceholder("1.000 km").fill("1000");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/passo 4 de 5/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Anual (1 ano a partir de hoje)")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/passo 5 de 5/i)).toBeVisible({ timeout: 15_000 });
}

test.describe.serial("mobile — fluxo completo /m/cotar até o cálculo", () => {
  let vendedor: Persona;
  let robo: Server;
  let idCpf: string;
  let idPlacaAuto: string;
  let idPlacaMoto: string;
  const corpos: CorpoRobo[] = [];

  test.beforeAll(async () => {
    test.skip(
      !(process.env.CI || process.env.E2E_ROBO_MOCK === "1"),
      "opt-in obrigatório: rode com E2E_ROBO_MOCK=1 (ou CI) — evita enviar ao robô real",
    );
    test.skip(!urlRoboLocal(), `SELF_QUIVER_API_URL precisa ser local na porta ${PORTA_ROBO}`);
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
      robo.once("error", () => resolve(false));
      robo.listen(PORTA_ROBO, "127.0.0.1", () => resolve(true));
    });
    test.skip(!ok, `porta ${PORTA_ROBO} ocupada — teste pulado por segurança`);
    vendedor = await criarPersona({ role: "vendedor" });
    idCpf = await semearConsultaCpfE2E(vendedor.userId, vendedor.empresaId);
    idPlacaAuto = await semearConsultaPlacaE2E(vendedor.userId, vendedor.empresaId);
    idPlacaMoto = await semearConsultaPlacaMotoE2E(vendedor.userId, vendedor.empresaId);
  });

  test.afterAll(async () => {
    if (robo) await new Promise<void>((r) => robo.close(() => r()));
    if (!vendedor) return;
    await limparCotacoesDoVendedorE2E(vendedor.userId);
    await limparConsultaCpfE2E(idCpf);
    await limparConsultaPlacaE2E(idPlacaAuto);
    await limparConsultaPlacaE2E(idPlacaMoto);
    await limparPersona(vendedor);
  });

  async function fluxo(page: Page, tipo: "Auto" | "Moto") {
    const placa = tipo === "Auto" ? PLACA_E2E : PLACA_MOTO_E2E;
    await mockarExternos(page);
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await passoSegurado(page);

    // Passo 2: Veículo
    await expect(page.getByText(/passo 2 de 5/i)).toBeVisible({ timeout: 15_000 });
    if (tipo === "Moto") {
      // Trocar o ramo recarrega as marcas (tabela de motos); espera antes de consultar a placa.
      const marcasMoto = page.waitForResponse(/fipe\/api\/v1\/motos\/marcas$/);
      await page.getByRole("radio", { name: "Moto", exact: true }).click();
      await marcasMoto;
    }
    await page.getByPlaceholder("ABC1D23").fill(placa);
    if (tipo === "Auto") {
      await page.getByRole("button", { name: /Econo\.Flex 4p Mec\./ }).click();
    }
    await expect(page.getByText(/veículo identificado/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Continuar" }).click();

    await passosUsoAteRevisar(page);
    await expect(page.getByText(placa)).toBeVisible();

    const antes = corpos.length;
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page).toHaveURL(/\/m\/cotacoes\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const id = page.url().match(/\/m\/cotacoes\/([0-9a-f-]{36})/)?.[1] ?? "";

    // O robô mock recebeu UM envio, com as seguradoras padrão do ramo.
    await expect.poll(() => corpos.length, { timeout: 15_000 }).toBe(antes + 1);
    const sel = corpos[antes].seguro?.seguradorasDisponiveis ?? [];
    expect(sel.length).toBeGreaterThan(0);

    // Progresso/aguardando visível; sem prêmios nem WhatsApp ainda.
    await expect(page.getByText("Maria Mobile E2E")).toBeVisible();
    await expect(page.getByText(/ainda calculando|aguardando o início/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: /enviar por whatsapp/i })).toHaveCount(0);

    // Banco: UMA cotação do vendedor para este fluxo, sem duplicata de rascunho.
    const cots = (await listarCotacoesDoVendedorE2E(vendedor.userId)).filter(
      (c) => c.veiculo?.placa === placa,
    );
    expect(cots).toHaveLength(1);
    expect(cots[0].id).toBe(id);
    expect(cots[0].status).toBe("enviada_quiver");
    expect(cots[0].segurado?.nome).toBe("Maria Mobile E2E");
    expect(cots[0].segurado?.cpf_cnpj?.replace(/\D/g, "")).toBe(CPF_MOBILE_E2E);
    // Defaults do ramo (banco guarda o nome; o robô recebe ids canônicos minúsculos).
    const noBanco = await seguradorasSelE2E(id);
    expect(sel).toHaveLength(noBanco.length); // o robô usa ids canônicos (ex.: "hdi seguros")
    expect(sel).toEqual(expect.arrayContaining(["mapfre", "suhai"]));
    if (tipo === "Auto") expect(noBanco).toEqual(["Mapfre", "Aliro", "Yelum", "HDI", "Suhai"]);

    // Retorno do robô (webhook simulado) → prêmios por seguradora + WhatsApp sem comissão.
    const res = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: { cotacaoId: id, temPremios: true, cards: CARDS },
    });
    expect(res.ok()).toBeTruthy();
    await expect(page.getByText("Mapfre")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Porto")).toBeVisible();
    const zap = page.getByRole("link", { name: /enviar por whatsapp/i });
    await expect(zap).toBeVisible();
    const href = (await zap.getAttribute("href")) ?? "";
    expect(href).toMatch(/^https:\/\/wa\.me\/5511912345678\?text=/);
    expect(decodeURIComponent(href)).not.toMatch(/comiss/i);

    const depois = (await listarCotacoesDoVendedorE2E(vendedor.userId)).filter(
      (c) => c.veiculo?.placa === placa,
    );
    expect(depois).toHaveLength(1);
    expect(depois[0].status).toBe("calculada");
  }

  test("Auto: 5 passos, Calcular, progresso, prêmios e WhatsApp sem comissão", async ({ page }) => {
    await fluxo(page, "Auto");
  });

  test("Moto: 5 passos, Calcular, progresso, prêmios e WhatsApp sem comissão", async ({ page }) => {
    await fluxo(page, "Moto");
  });
});
