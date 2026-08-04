import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarPersona,
  limparPersona,
  lerReguaPerformanceFull,
  lerComplementosFull,
  restaurarReguaPerformanceFull,
  type Persona,
} from "./provision";

/**
 * V11.5b.4/5.5 — `xacessos.tsx` (Acessos da equipe) ganha 2 seções novas SÓ
 * para a Franquia Full ("Personalização geral" com sub-abas Modelo CLT ·
 * comissionamento/Histórico, e "Performance"), com toggle no mesmo padrão de
 * `perso-geral.tsx`. Nenhuma das 2 gates novas (`fn_salvar_regua_performance_full`,
 * `fn_salvar_complementos_full`) pede senha — gate por identidade no banco
 * (franqueado dono da empresa + modalidade Full).
 *
 * `regua_performance_config` (bloco 'full') é UMA LINHA COMPARTILHADA entre
 * todas as Fulls (V11.5b.2) — o teste registra o valor original e restaura no
 * `afterAll`, para não vazar estado para outros specs/execuções em paralelo.
 */

const MATRIZ_EMAIL = "desenvolvimento@suppercerto.com.br";
const MATRIZ_SENHA = "Supper@123!";

test.describe("Franquia Full — Personalização geral e Performance em /operacao/xacessos", () => {
  let full: Persona;
  let reguaOriginal: Awaited<ReturnType<typeof lerReguaPerformanceFull>>;

  test.beforeAll(async () => {
    full = await criarPersona({ role: "franqueado", modalidade: "full" });
    reguaOriginal = await lerReguaPerformanceFull();
  });

  test.afterAll(async () => {
    if (reguaOriginal) {
      await restaurarReguaPerformanceFull(reguaOriginal);
    }
    await limparPersona(full);
  });

  test("Full vê o toggle de 3 seções e abre 'Personalização geral' (Modelo CLT informativo + Complementos editável)", async ({
    page,
  }) => {
    await loginAs(page, full.email, full.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/operacao/xacessos");
    await expect(page.getByRole("heading", { name: "Acessos da equipe" }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Toggle das 3 seções — só a Full vê ("Meu time" continua sendo o
    // default, sem quebrar a tela que Master também usa).
    await expect(page.getByRole("button", { name: "Meu time" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Personalização geral" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Performance" })).toBeVisible();

    await page.getByRole("button", { name: "Personalização geral" }).click();
    await expect(page.getByRole("button", { name: "Modelo CLT · comissionamento" })).toBeVisible();

    // Modelo CLT: card informativo, sem botão de salvar (é da Matriz).
    await expect(page.getByRole("heading", { name: "Modelo CLT (informativo)" })).toBeVisible();
    await expect(page.getByText("somente leitura")).toBeVisible();
    await expect(page.getByRole("button", { name: /Salvar.*Modelo CLT/ })).toHaveCount(0);

    // Complementos do time: editável, sem nenhum modal de senha.
    await expect(page.getByRole("heading", { name: "Complementos do time" })).toBeVisible();
    await page.getByLabel("Comissão de venda do vendedor (%)").fill("42");
    await page.getByLabel("Comissão na renovação (%)").fill("18");
    await page.getByLabel("Bônus de campanha").fill("+5% acima da meta");
    await page.getByLabel("Meta padrão da equipe").fill("12 vendas/mês");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Complementos do time salvos.")).toBeVisible({ timeout: 10_000 });
    // Nenhum modal de senha de diretor (`SenhaDiretorModal`) apareceu em
    // momento algum — a Full nunca é diretora.
    await expect(page.getByRole("heading", { name: "Confirmação de diretor" })).toHaveCount(0);

    const salvo = await lerComplementosFull(full.empresaId);
    expect(salvo?.comissao_venda_pct).toBe(42);
    expect(salvo?.comissao_renovacao_pct).toBe(18);
    expect(salvo?.bonus_campanha).toBe("+5% acima da meta");
    expect(salvo?.meta_padrao_equipe).toBe("12 vendas/mês");

    // Histórico da própria franquia mostra a alteração que acabou de fazer.
    await page.getByRole("button", { name: "Histórico" }).click();
    await expect(page.getByRole("heading", { name: "Histórico da sua franquia" })).toBeVisible();
    await expect(page.getByText("Complementos do time alterados")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Full abre 'Performance' e salva a própria régua sem nenhum modal de senha, sem 'Notificar o supervisor'", async ({
    page,
  }) => {
    await loginAs(page, full.email, full.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/operacao/xacessos");
    await expect(page.getByRole("heading", { name: "Acessos da equipe" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Performance" }).click();
    await expect(
      page.getByRole("heading", { name: "Régua de performance do seu time" }),
    ).toBeVisible();

    // Nem o toggle de notificar supervisor, nem qualquer senha de diretor.
    await expect(page.getByText("Notificar supervisor")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Confirmação de diretor" })).toHaveCount(0);

    await page.getByLabel("Janela (dias corridos)").fill("45");
    await page.getByLabel("Conversão mínima · Atenção (%)").fill("25");
    await page.getByLabel("Conversão mínima · Travado (%)").fill("10");
    await page.getByRole("button", { name: "Salvar política" }).click();

    await expect(page.getByText("Régua de performance do seu time atualizada.")).toBeVisible({
      timeout: 10_000,
    });

    const salvo = await lerReguaPerformanceFull();
    expect(salvo?.janela_dias).toBe(45);
    expect(Number(salvo?.conv_atencao_pct)).toBe(25);
    expect(Number(salvo?.conv_travado_pct)).toBe(10);
  });
});

test.describe("Franquia Individual e Matriz — sem confusão com as seções da Full", () => {
  let individual: Persona;

  test.beforeAll(async () => {
    individual = await criarPersona({ role: "franqueado", modalidade: "individual" });
  });

  test.afterAll(async () => {
    await limparPersona(individual);
  });

  test("franquia Individual não vê o toggle 'Personalização geral'/'Performance' em xacessos", async ({
    page,
  }) => {
    await loginAs(page, individual.email, individual.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/operacao/xacessos");

    // Individual não tem `FULL_GRUPO_GROUP` no menu — navega direto por URL
    // para provar que, mesmo assim, a tela não abre a visão de grupo da Full.
    await expect(page).not.toHaveURL(/\/inicio/, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Personalização geral" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Meu time" })).toHaveCount(0);
  });

  test("Matriz continua na própria tela de Personalização (macessos), sem as abas da Full", async ({
    page,
  }) => {
    await loginAs(page, MATRIZ_EMAIL, MATRIZ_SENHA);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/operacao/acessos");

    await expect(page.getByRole("heading", { name: "Acessos e permissões" }).first()).toBeVisible({
      timeout: 15_000,
    });
    // A tela da Full (`xacessos`/"Acessos da equipe") é outra rota — a
    // Matriz não vê o card "Complementos do time" nem "Régua de performance
    // do seu time" (textos exclusivos das 2 novas seções da Full).
    await expect(page.getByRole("heading", { name: "Complementos do time" })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Régua de performance do seu time" }),
    ).toHaveCount(0);
  });
});
