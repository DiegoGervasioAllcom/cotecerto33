import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { criarPersona, limparPersona, type Persona } from "./provision";

/**
 * V11.I.4 — Marketing (perfil `interno`) ganhou acesso a `/comando/leads` e
 * `/comando/distribuicao` (RLS já escopava pra operação própria da Matriz
 * desde V11.I.2; faltava o guard client-side `useRequireMatrizOuFranquiaFull`
 * deixar o role passar — antes disso ele batia direto em `/inicio`).
 */
test.describe("Central da Franquia — interno (Marketing) em /comando/leads e /comando/distribuicao", () => {
  let marketing: Persona;

  test.beforeAll(async () => {
    marketing = await criarPersona({ role: "interno", cargo: "marketing" });
  });

  test.afterAll(async () => {
    await limparPersona(marketing);
  });

  test("Marketing abre Leads sem cair em /inicio", async ({ page }) => {
    await loginAs(page, marketing.email, marketing.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

    await page.goto("/comando/leads");
    await expect(page).not.toHaveURL(/\/inicio/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Central de Leads" })).toBeVisible();
  });

  test("Marketing abre Distribuição em modo leitura (sem os controles de configuração)", async ({
    page,
  }) => {
    await loginAs(page, marketing.email, marketing.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

    await page.goto("/comando/distribuicao");
    await expect(page).not.toHaveURL(/\/inicio/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Distribuição de leads" })).toBeVisible();
    await expect(page.getByText("Acesso de leitura")).toBeVisible();
    // Não é a visão reduzida da Full (essa é exclusiva de franqueado Full).
    await expect(page.getByRole("heading", { name: "SLA próprio" })).toHaveCount(0);
  });
});
