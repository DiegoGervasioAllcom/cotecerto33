import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarPersona,
  limparPersona,
  semearConsultaPlacaE2E,
  limparConsultaPlacaE2E,
  semearConsultaPlacaMistaE2E,
  PLACA_E2E,
  PLACA_MISTA_E2E,
  type Persona,
} from "./provision";

/**
 * E2E da integração de placa no passo Veículo do wizard de cotação:
 * digitar a placa e sair do campo dispara `consultarPlaca`, que preenche
 * chassi/anos/combustível e — como esta placa tem duas versões FIPE —
 * pede a escolha da versão antes de resolver marca e modelo.
 *
 * Entramos pelo Lead Manual (gate + wizard) de propósito, em vez de
 * assumir um lead distribuído: `fullyParallel` roda este arquivo junto de
 * distribuicao-movida.spec.ts, cujo "Reprocessar pendentes" afirma
 * "1 de 1 lead(s)" sobre a Fila Global inteira. Um lead a mais criado
 * aqui derrubava aquele spec de forma intermitente.
 *
 * O cache de `consultas_placa` é semeado no beforeAll também de propósito:
 * sem isso cada rodada gastaria uma consulta paga no fornecedor. O parse
 * do XML real está coberto em tests/unit/placa-decodificador.test.ts.
 */
test.describe("integração de placa — passo Veículo", () => {
  let vendedor: Persona;
  let consultaId: string;

  test.beforeAll(async () => {
    vendedor = await criarPersona({ role: "vendedor" });
    consultaId = await semearConsultaPlacaE2E(vendedor.userId, vendedor.empresaId);
  });

  test.afterAll(async () => {
    await limparConsultaPlacaE2E(consultaId);
    await limparPersona(vendedor);
  });

  test("a placa preenche os dados do veículo e pede a versão FIPE", async ({ page }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

    // Gate do Lead Manual (V11): origem do lead antes do wizard.
    await page.goto("/venda/novo-lead");
    await page.locator('input[placeholder="Nome do cliente"]').fill("Cliente Placa E2E");
    await page.locator('input[placeholder="(00) 00000-0000"]').fill("11999990000");
    await page.locator('input[placeholder="AAA0A00"]').fill(PLACA_E2E);
    await page.locator("select").first().selectOption("Indicação");
    await page.getByRole("button", { name: /iniciar cota/i }).click();

    // Passo 3 do stepper: Veículo. Os passos são <div class="step"> clicáveis,
    // não <button>, então o alvo é o rótulo dentro do stepper.
    await expect(page.getByRole("heading", { name: "Dados do Segurado" })).toBeVisible({
      timeout: 15_000,
    });
    await page.locator(".stepper .step").filter({ hasText: "Veículo" }).first().click();
    await expect(page.getByRole("heading", { name: "Dados do Veículo" })).toBeVisible();

    const placa = page.locator('input[placeholder="AAA0A00"]');
    await placa.fill(PLACA_E2E);
    // O disparo é no blur, não no change.
    await placa.blur();

    // Campos que não dependem da FIPE entram direto.
    const chassi = page.locator('input[placeholder="17 caracteres"]');
    await expect(chassi).toHaveValue("9BGJC69Z0FB105973", { timeout: 15_000 });
    await expect(page.locator('input[placeholder="2024"]')).toHaveValue("2015");
    await expect(page.locator('input[placeholder="2023"]')).toHaveValue("2014");

    // Duas versões FIPE → nada é escolhido sozinho; a tela pede a versão.
    await expect(page.getByText(/Selecione a versão do veículo/)).toBeVisible();
    const opcaoMec = page.getByRole("button", { name: /Econo\.Flex 4p Mec\./ });
    const opcaoAut = page.getByRole("button", { name: /Econo\.Flex 4p Aut\./ });
    await expect(opcaoMec).toBeVisible();
    await expect(opcaoAut).toBeVisible();
    // O valor FIPE de cada versão aparece na própria opção.
    await expect(opcaoMec).toContainText("43.399");

    // Escolher a versão resolve marca e modelo nos selects da FIPE.
    await opcaoMec.click();
    await expect(page.getByText(/Veículo identificado/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Selecione a versão do veículo/)).toHaveCount(0);

    const marca = page.locator("select").filter({ hasText: "Chevrolet" }).first();
    await expect(marca).toHaveValue(/\d+/);

    // O fixture usa DsCombustivel="Gasolina" com um nome de modelo que contém
    // "Flex" ("... Econo.Flex 4p Mec.") — de propósito, para travar a ordem
    // certa de prioridade: o campo autoritativo da API vence o texto livre do
    // nome da versão, que só serve de fallback.
    const combustivel = page.getByLabel("Combustível");
    await expect(combustivel).toHaveValue("Gasolina");

    // O Valor FIPE fecha o ciclo: só preenche se o código de ano/combustível
    // for o que a FIPE devolve (flex é "-5"; montar "-1" à mão deixava vazio).
    await expect(page.locator('input[placeholder="Preenche via FIPE"]')).toHaveValue(
      /R\$\s*43\.399/,
      { timeout: 30_000 },
    );
  });

  test("escolher uma versão FIPE diferente atualiza o combustível para o dela", async ({
    page,
  }) => {
    const consultaMistaId = await semearConsultaPlacaMistaE2E(vendedor.userId, vendedor.empresaId);
    try {
      await loginAs(page, vendedor.email, vendedor.senha);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

      await page.goto("/venda/novo-lead");
      await page.locator('input[placeholder="Nome do cliente"]').fill("Cliente Placa Mista E2E");
      await page.locator('input[placeholder="(00) 00000-0000"]').fill("11999990001");
      await page.locator('input[placeholder="AAA0A00"]').fill(PLACA_MISTA_E2E);
      await page.locator("select").first().selectOption("Indicação");
      await page.getByRole("button", { name: /iniciar cota/i }).click();

      await expect(page.getByRole("heading", { name: "Dados do Segurado" })).toBeVisible({
        timeout: 15_000,
      });
      await page.locator(".stepper .step").filter({ hasText: "Veículo" }).first().click();
      await expect(page.getByRole("heading", { name: "Dados do Veículo" })).toBeVisible();

      const placa = page.locator('input[placeholder="AAA0A00"]');
      await placa.fill(PLACA_MISTA_E2E);
      await placa.blur();

      await expect(page.getByText(/Selecione a versão do veículo/)).toBeVisible({
        timeout: 15_000,
      });
      const combustivel = page.getByLabel("Combustível");

      // A Diesel é a SEGUNDA versão (fipe[1]) — antes da correção, o campo
      // Combustível ficava travado na primeira versão (Gasolina) mesmo
      // depois de o vendedor escolher a Diesel.
      await page.getByRole("button", { name: /Diesel/ }).click();
      await expect(page.getByText(/Veículo identificado/)).toBeVisible({ timeout: 20_000 });
      await expect(combustivel).toHaveValue("Diesel");
    } finally {
      await limparConsultaPlacaE2E(consultaMistaId);
    }
  });
});
