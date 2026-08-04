import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarPersona,
  limparPersona,
  lerSlaOverrideEmpresa,
  lerSlaSingletonMatriz,
  type Persona,
} from "./provision";

/**
 * V11.5.2b — Central da Franquia (só leads): a Full ganhou acesso a
 * `/comando/leads` e `/comando/distribuicao` (V11.5.2a já tinha colocado os
 * itens no menu — `personas.spec.ts` cobre a navegação/menu). Este spec
 * cobre o que o menu não cobre: a TELA em si não redireciona pra `/inicio`,
 * a Full usa uma visão reduzida (SLA/canais próprios, nunca o singleton da
 * Matriz) em Distribuição, e o isolamento do SLA por empresa (V11.5.3) é
 * respeitado na prática — sem regressão pra Individual/Matriz.
 */

const MATRIZ_EMAIL = "desenvolvimento@suppercerto.com.br";
const MATRIZ_SENHA = "Supper@123!";

test.describe("Central da Franquia — Full em /comando/leads e /comando/distribuicao", () => {
  let franquiaFull: Persona;

  test.beforeAll(async () => {
    franquiaFull = await criarPersona({ role: "franqueado", modalidade: "full" });
  });

  test.afterAll(async () => {
    await limparPersona(franquiaFull);
  });

  test("Full abre Leads sem cair em /inicio", async ({ page }) => {
    await loginAs(page, franquiaFull.email, franquiaFull.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/comando/leads");

    await expect(page).not.toHaveURL(/\/inicio/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Central de Leads" })).toBeVisible();
    // Ações restritas a matriz/master no banco (redistribuir/puxar de
    // volta/bloquear/distribuir automático) não aparecem pra Full — sempre
    // dariam "forbidden" na RPC.
    await expect(page.getByRole("button", { name: "Distribuir automático" })).toHaveCount(0);
  });

  test("Full abre Distribuição sem cair em /inicio e vê a visão reduzida (SLA/canais), não o singleton da Matriz", async ({
    page,
  }) => {
    await loginAs(page, franquiaFull.email, franquiaFull.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/comando/distribuicao");

    await expect(page).not.toHaveURL(/\/inicio/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Distribuição · SLA · Canais" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "SLA próprio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Canais próprios de captação" })).toBeVisible();
    // A tela da Matriz (singleton `distribuicao_config`) não aparece pra Full.
    await expect(page.getByText("Distribuição automática")).toHaveCount(0);
    await expect(page.getByText("Regra do automático")).toHaveCount(0);
  });

  test("Full salva o próprio SLA e o singleton da Matriz permanece intocado", async ({ page }) => {
    const singletonAntes = await lerSlaSingletonMatriz();

    await loginAs(page, franquiaFull.email, franquiaFull.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/comando/distribuicao");
    await expect(page.getByRole("heading", { name: "SLA próprio" })).toBeVisible();

    const campoSla = page.getByLabel("Minutos para o vendedor atender o lead");
    await campoSla.fill("45");
    await page.getByRole("button", { name: "Salvar SLA" }).click();

    await expect(page.getByText("SLA da sua franquia salvo.")).toBeVisible({ timeout: 10_000 });

    const overrideDepois = await lerSlaOverrideEmpresa(franquiaFull.empresaId);
    expect(overrideDepois).toBe(45 * 60);

    const singletonDepois = await lerSlaSingletonMatriz();
    expect(singletonDepois).toBe(singletonAntes);
  });

  test("Full adiciona um canal próprio e ele entra na lista com tipo manual", async ({ page }) => {
    await loginAs(page, franquiaFull.email, franquiaFull.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/comando/distribuicao");

    const nomeCanal = `Canal E2E ${Date.now()}`;
    await page.getByPlaceholder("Novo canal (ex.: WhatsApp da loja)").fill(nomeCanal);
    await page.getByRole("button", { name: "Adicionar" }).click();

    await expect(page.getByText(nomeCanal)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Central da Franquia — sem regressão pra Individual e Matriz", () => {
  let franquiaIndividual: Persona;

  test.beforeAll(async () => {
    franquiaIndividual = await criarPersona({ role: "franqueado", modalidade: "individual" });
  });

  test.afterAll(async () => {
    await limparPersona(franquiaIndividual);
  });

  test("franquia Individual continua sendo redirecionada pra /inicio em Leads e Distribuição", async ({
    page,
  }) => {
    await loginAs(page, franquiaIndividual.email, franquiaIndividual.senha);

    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

    await page.goto("/comando/leads");
    await expect(page).toHaveURL(/\/inicio/, { timeout: 15_000 });

    await page.goto("/comando/distribuicao");
    await expect(page).toHaveURL(/\/inicio/, { timeout: 15_000 });
  });

  test("Matriz continua vendo a tela cheia de Distribuição (sem regressão da V11.5.2b)", async ({
    page,
  }) => {
    await loginAs(page, MATRIZ_EMAIL, MATRIZ_SENHA);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/comando/distribuicao");

    await expect(page).not.toHaveURL(/\/inicio/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Distribuição de leads" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Distribuição automática" })).toBeVisible();
    // A visão reduzida da Full não aparece pra Matriz.
    await expect(page.getByRole("heading", { name: "SLA próprio" })).toHaveCount(0);
  });
});
