// Início — fila do dia unificada (V12.3.1). O cartão "O que fazer agora"
// (`data-tour="home-fila"`, `FilaDoDiaCard`) substitui os antigos "Sua
// missão de hoje" e "O que fazer agora (com retorno)": uma fila só, juntando
// retorno agendado + negócio em risco + lembrete pessoal, ordenada por
// urgência (atrasado > hoje > resto). Mesmas 3 fontes/mesmo hook de
// `venda/agenda.tsx` (`useAgendaItens`, extraído em `@/lib/use-agenda-itens`).
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarPersona,
  criarVendedorComFilaDia,
  limparPersona,
  limparVendedorComFilaDia,
  type Persona,
  type VendedorComFilaDia,
} from "./provision";

test.describe("início — fila do dia unificada", () => {
  let vendedor: VendedorComFilaDia;
  let franquiaIndividual: Persona;

  test.beforeAll(async () => {
    [vendedor, franquiaIndividual] = await Promise.all([
      criarVendedorComFilaDia(),
      criarPersona({ role: "franqueado", modalidade: "individual" }),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([limparVendedorComFilaDia(vendedor), limparPersona(franquiaIndividual)]);
  });

  test("vendedor vê o cartão 'O que fazer agora' com a fila em ordem de urgência", async ({
    page,
  }) => {
    await loginAs(page, vendedor.email, vendedor.senha);
    await expect(page).toHaveURL(/\/inicio/, { timeout: 15_000 });

    const card = page.locator('[data-tour="home-fila"]');
    await expect(card).toBeVisible();
    await expect(
      card.getByRole("heading", { name: "O que fazer agora", exact: true }),
    ).toBeVisible();

    // Negativo: os blocos antigos saíram de vez, não só ficaram escondidos.
    await expect(page.getByRole("heading", { name: "Sua missão de hoje" })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "O que fazer agora (com retorno)" }),
    ).toHaveCount(0);
    await expect(page.locator(".mission-row")).toHaveCount(0);
    await expect(page.locator(".actions-list")).toHaveCount(0);

    // Positivo: um item atrasado (retorno de ontem) aparece antes de um de
    // hoje (retorno de hoje) — mesma regra de `ordenarAgenda`.
    const linhas = card.locator(".action-row");
    await expect(linhas.filter({ hasText: "Retorno atrasado E2E" })).toBeVisible();
    await expect(linhas.filter({ hasText: "Retorno hoje E2E" })).toBeVisible();
    const titulos = await linhas.allTextContents();
    const posAtrasado = titulos.findIndex((t) => t.includes("Retorno atrasado E2E"));
    const posHoje = titulos.findIndex((t) => t.includes("Retorno hoje E2E"));
    expect(posAtrasado).toBeGreaterThanOrEqual(0);
    expect(posHoje).toBeGreaterThanOrEqual(0);
    expect(posAtrasado).toBeLessThan(posHoje);

    // O visto verde (marcar como feito) risca o lembrete da própria linha —
    // some do cartão sem precisar recarregar a página.
    const linhaLembrete = linhas.filter({ hasText: "Lembrete atrasado E2E" });
    await expect(linhaLembrete).toBeVisible();
    await linhaLembrete.getByRole("button", { name: "Marcar como feito" }).click();
    await expect(linhas.filter({ hasText: "Lembrete atrasado E2E" })).toHaveCount(0, {
      timeout: 10_000,
    });

    // Negativo: o item de risco (negócio parado) não tem "marcar como
    // feito" — é aviso do sistema, não compromisso do vendedor.
    const linhaRisco = linhas.filter({ hasText: "Cliente Em Risco E2E" });
    await expect(linhaRisco).toBeVisible();
    await expect(linhaRisco.getByRole("button", { name: "Marcar como feito" })).toHaveCount(0);

    // Link "Ver minha agenda" leva pra /venda/agenda.
    await card.getByRole("link", { name: /Ver minha agenda/ }).click();
    await expect(page).toHaveURL(/\/venda\/agenda/);
  });

  test("franquia Individual também vê o cartão 'O que fazer agora' (cockpit de vendedor)", async ({
    page,
  }) => {
    await loginAs(page, franquiaIndividual.email, franquiaIndividual.senha);
    await expect(page).toHaveURL(/\/inicio/, { timeout: 15_000 });

    const card = page.locator('[data-tour="home-fila"]');
    await expect(card).toBeVisible();
    await expect(
      card.getByRole("heading", { name: "O que fazer agora", exact: true }),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "Sua missão de hoje" })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "O que fazer agora (com retorno)" }),
    ).toHaveCount(0);
  });
});
