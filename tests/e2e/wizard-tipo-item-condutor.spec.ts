import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarPersona,
  limparPersona,
  limparCotacaoManualE2E,
  lerRamoCotacaoE2E,
  lerCondutorMesmoE2E,
  type Persona,
} from "./provision";

/**
 * E2E da V12.3.8 — tipo de item por ícone (`TipoItemPicker`) + switch de
 * principal condutor (`StepPerfil`): nenhum E2E existente chegava no passo 2
 * (Seguro) nem no passo 4 (Perfil) do wizard, e são as duas telas tocadas por
 * esta task.
 *
 * Entramos pelo gate "Lead Manual — origem" (sem `?id=`) de propósito, como
 * `placa-integracao.spec.ts` — é o único caminho que cria uma cotação nova
 * sem depender de distribuição de lead. `TipoItemPicker` é o mesmo
 * componente nos dois lugares (gate `variant="linha"` e passo Seguro
 * `variant="wizard"`), então o teste (b) também cobre o comportamento do
 * componente por trás do gate.
 */
test.describe("wizard — tipo de item por ícone + principal condutor (V12.3.8)", () => {
  let vendedor: Persona;

  test.beforeAll(async () => {
    vendedor = await criarPersona({ role: "vendedor" });
  });

  test.afterAll(async () => {
    await limparPersona(vendedor);
  });

  /** Preenche o gate "Lead Manual — origem" (Nome/Telefone/Placa/Canal) e clica em "Iniciar cotação". */
  async function preencherGate(page: Page, nome: string) {
    await page.goto("/venda/novo-lead");
    await expect(page.getByText(/não veio da Central/i)).toBeVisible();
    await page.locator('input[placeholder="Nome do cliente"]').fill(nome);
    await page.locator('input[placeholder="(00) 00000-0000"]').fill("11999990000");
    await page.locator('input[placeholder="AAA0A00"]').fill("ABC1D23");
    await page.locator("select").first().selectOption("Indicação");
  }

  /** Clica em "Iniciar cotação", captura o id criado pelo 1º autosave (RPC `salvar_cotacao_rascunho`) e espera o wizard abrir. */
  async function iniciarEcapturarCotacaoId(page: Page): Promise<string> {
    const autosave = page.waitForResponse(
      (r) => r.url().includes("/rpc/salvar_cotacao_rascunho") && r.ok(),
      { timeout: 10_000 },
    );
    await page.getByRole("button", { name: /iniciar cota/i }).click();
    await expect(page.getByRole("heading", { name: "Dados do Segurado" })).toBeVisible({
      timeout: 15_000,
    });
    const resp = await autosave;
    const cotacaoId = (await resp.json()) as string;
    expect(cotacaoId).toBeTruthy();
    return cotacaoId;
  }

  // Filtra pelo `.lbl` (só o rótulo, sem o número do passo) com match exato —
  // "Segurado" contém "Seguro" como substring, então um `hasText` direto no
  // `.step` (que concatena número + rótulo) cairia sempre no passo errado.
  function irParaPasso(page: Page, label: string) {
    return page
      .locator(".stepper .step")
      .filter({ has: page.locator(".lbl", { hasText: new RegExp(`^${label}$`) }) })
      .first()
      .click();
  }

  /** Força o autosave (clique manual) e espera a resposta ok da RPC. */
  async function salvarRascunho(page: Page) {
    const autosave = page.waitForResponse(
      (r) => r.url().includes("/rpc/salvar_cotacao_rascunho") && r.ok(),
      { timeout: 10_000 },
    );
    await page.getByRole("button", { name: /salvar rascunho/i }).click();
    await autosave;
  }

  test("passo Seguro: clicar num tipo 'em breve' abre o modal e não troca o item — segue Automóvel", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

    await preencherGate(page, "Cliente Tipo Item E2E");
    const cotacaoId = await iniciarEcapturarCotacaoId(page);

    try {
      await irParaPasso(page, "Seguro");
      await expect(page.getByRole("heading", { name: "Dados do Seguro" })).toBeVisible();

      const picker = page.locator(".tipo-item");
      await expect(picker.locator(".ti-btn.on")).toHaveAttribute("title", "Auto");

      // Moto é um dos "em breve" — clicar abre o modal informativo, não troca o item.
      await picker.getByTitle("Moto · em breve").click();
      await expect(
        page.getByRole("heading", { name: "Jornada de Moto em construção" }),
      ).toBeVisible();
      await expect(page.getByText(/a cotação atual segue como Auto/i)).toBeVisible();
      await page.getByRole("button", { name: "Entendi" }).click();
      await expect(
        page.getByRole("heading", { name: "Jornada de Moto em construção" }),
      ).toBeHidden();

      // Automóvel continua marcado depois de fechar o modal.
      await expect(picker.locator(".ti-btn.on")).toHaveAttribute("title", "Auto");

      await salvarRascunho(page);
      const ramo = await lerRamoCotacaoE2E(cotacaoId);
      expect(ramo.cotacoes, "cotacoes.ramo").toBe("Automóvel");
      expect(ramo.cotacaoSeguro, "cotacao_seguro.ramo").toBe("Automóvel");
    } finally {
      await limparCotacaoManualE2E(cotacaoId);
    }
  });

  test("Lead Manual: escolher um produto 'em breve' não troca o item — Automóvel segue disponível para iniciar", async ({
    page,
  }) => {
    // `TipoItemPicker.clicar()` nunca chama `onChange` para um produto sem
    // jornada (só abre o modal informativo) — então, hoje, não existe
    // caminho por clique que deixe `ramo` diferente de 'Automóvel' dentro do
    // gate, e o bloqueio de `LeadManualGate.confirmar()` para produto sem
    // jornada é código defensivo inalcançável pela UI atual. Documentamos
    // isso aqui em vez de simular um bloqueio que a interface não produz.
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

    await preencherGate(page, "Cliente Lead Manual E2E");

    const gatePicker = page.locator(".nl-tipos");
    await expect(gatePicker.locator(".ti-btn.on")).toHaveAttribute("title", "Auto");

    await gatePicker.getByTitle("Vida · em breve").click();
    await expect(
      page.getByRole("heading", { name: "Jornada de Vida em construção" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Entendi" }).click();

    // Sem bloqueio: ramo segue Automóvel e "Iniciar cotação" continua livre.
    await expect(gatePicker.locator(".ti-btn.on")).toHaveAttribute("title", "Auto");
    await expect(page.getByText(/em construção.*selecione Auto para iniciar/i)).toBeHidden();

    const cotacaoId = await iniciarEcapturarCotacaoId(page);
    try {
      const ramo = await lerRamoCotacaoE2E(cotacaoId);
      expect(ramo.cotacoes, "cotacoes.ramo").toBe("Automóvel");
    } finally {
      await limparCotacaoManualE2E(cotacaoId);
    }
  });

  test("passo Perfil: desligar 'principal condutor' mostra os campos do condutor; salvar e reabrir preserva o estado", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

    await preencherGate(page, "Cliente Perfil Condutor E2E");
    const cotacaoId = await iniciarEcapturarCotacaoId(page);

    try {
      await irParaPasso(page, "Perfil");
      await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible();

      const switchCondutor = page.locator('[data-tour="perfil-condutor"]');
      // Default do form (`condutorMesmo: "sim"`): switch ligado, campos escondidos.
      await expect(switchCondutor).toHaveClass(/on/);
      await expect(page.getByText("CPF do condutor")).toBeHidden();

      await switchCondutor.click();
      await expect(switchCondutor).not.toHaveClass(/on/);
      await expect(page.getByText("CPF do condutor")).toBeVisible();
      await expect(page.getByText("Nome do condutor")).toBeVisible();

      await salvarRascunho(page);
      expect(await lerCondutorMesmoE2E(cotacaoId), "condutor_mesmo após desligar").toBe(false);

      // Reabre a mesma cotação direto no passo Perfil — estado vem do banco.
      await page.goto(`/venda/novo-lead?id=${cotacaoId}&step=3`);
      await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible({
        timeout: 15_000,
      });
      const switchReaberto = page.locator('[data-tour="perfil-condutor"]');
      await expect(switchReaberto).not.toHaveClass(/on/);
      await expect(page.getByText("CPF do condutor")).toBeVisible();

      // Liga de novo: campos do condutor voltam a ficar escondidos.
      await switchReaberto.click();
      await expect(switchReaberto).toHaveClass(/on/);
      await expect(page.getByText("CPF do condutor")).toBeHidden();

      await salvarRascunho(page);
      expect(await lerCondutorMesmoE2E(cotacaoId), "condutor_mesmo após religar").toBe(true);
    } finally {
      await limparCotacaoManualE2E(cotacaoId);
    }
  });
});
