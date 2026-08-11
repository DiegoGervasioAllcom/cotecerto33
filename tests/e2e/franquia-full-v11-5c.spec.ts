import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  adicionarRoleE2E,
  criarPersona,
  desligarUsuarioE2E,
  limparPersona,
  limparPersonaSemEmpresa,
  profilePorEmail,
  type Persona,
} from "./provision";

const ROTAS_FULL = [
  "/comando/visao-geral",
  "/comando/leads",
  "/comando/distribuicao",
  "/operacao/aprovacoes",
  "/operacao/vendedores",
  "/operacao/supervisao",
  "/operacao/pipeline-geral",
  "/operacao/vendas",
  "/operacao/comissoes",
  "/operacao/premiacoes",
  "/operacao/estornos",
  "/operacao/renovacoes",
  "/operacao/relatorios",
  "/operacao/xacessos",
] as const;

test.describe.serial("V11.5c — Franquia Full completa", () => {
  let full: Persona;
  let vendedor: Persona;

  test.beforeAll(async () => {
    full = await criarPersona({ role: "franqueado", modalidade: "full" });
    vendedor = await criarPersona({
      role: "vendedor",
      empresaId: full.empresaId,
      superiorId: full.userId,
    });
  });

  test.afterAll(async () => {
    await limparPersonaSemEmpresa(vendedor);
    await limparPersona(full);
  });

  test("Full válida abre as 14 rotas sem cair no login ou cockpit Individual", async ({ page }) => {
    await loginAs(page, full.email, full.senha);
    await expect(page).toHaveURL(/\/comando\/visao-geral/, { timeout: 15_000 });

    for (const rota of ROTAS_FULL) {
      await page.goto(rota);
      await expect(page).toHaveURL(new RegExp(`${rota.replaceAll("/", "\\/")}(?:[?#]|$)`), {
        timeout: 15_000,
      });
      await expect(page.locator("body")).not.toContainText("Página não encontrada");
    }
  });

  test("dashboard é da unidade e filtros não listam o próprio franqueado como vendedor", async ({
    page,
  }) => {
    await loginAs(page, full.email, full.senha);
    await page.goto("/comando/visao-geral");
    await expect(page.getByRole("heading", { name: "Visão geral da franquia" })).toBeVisible();
    await expect(page.locator(".page-head .sub")).toContainText("1 vendedor ativo");
    await expect(page.getByText(/franquias supervisionadas/i)).toHaveCount(0);
    await expect(page.getByText(/sobre a equipe/i)).toHaveCount(0);

    for (const rota of ["/operacao/pipeline-geral", "/operacao/relatorios"] as const) {
      await test.step(`filtros em ${rota}`, async () => {
        await page.goto(rota);
        const rotuloFiltro =
          rota === "/operacao/pipeline-geral" ? /^Vendedor$/ : /^Todos os vendedores$/;
        const filtroVendedor = page
          .locator("select")
          .filter({ has: page.locator("option", { hasText: rotuloFiltro }) });
        await expect(filtroVendedor.locator("option", { hasText: vendedor.nome })).toHaveCount(1);
        const opcoes = (await filtroVendedor.locator("option").allTextContents()).join(" ");
        expect(opcoes).not.toContain(full.nome);
        expect(opcoes).toContain(vendedor.nome);
      });
    }
  });

  test("Full vê nos filtros só vendedor ativo subordinado, nunca Full, desligado ou gestor com role vendedor", async ({
    page,
  }) => {
    const vendedorDesligado = await criarPersona({
      role: "vendedor",
      empresaId: full.empresaId,
      superiorId: full.userId,
    });
    const vendedorComRoleGestora = await criarPersona({
      role: "vendedor",
      empresaId: full.empresaId,
      superiorId: full.userId,
    });
    await desligarUsuarioE2E(vendedorDesligado.userId);
    await adicionarRoleE2E(vendedorComRoleGestora.userId, "supervisor");

    try {
      await loginAs(page, full.email, full.senha);

      for (const rota of ["/operacao/pipeline-geral", "/operacao/relatorios"] as const) {
        await test.step(`filtro em ${rota}`, async () => {
          await page.goto(rota);
          const rotuloFiltro =
            rota === "/operacao/pipeline-geral" ? /^Vendedor$/ : /^Todos os vendedores$/;
          const filtroVendedor = page
            .locator(".filters-bar select")
            .filter({ has: page.locator("option", { hasText: rotuloFiltro }) });

          await expect(filtroVendedor).toHaveCount(1);
          const opcoes = await filtroVendedor.locator("option").allTextContents();
          expect(opcoes).toEqual(
            rota === "/operacao/pipeline-geral"
              ? ["Vendedor", vendedor.nome]
              : ["Todos os vendedores", vendedor.nome],
          );
          expect(opcoes).not.toContain(full.nome);
          expect(opcoes).not.toContain(vendedorDesligado.nome);
          expect(opcoes).not.toContain(vendedorComRoleGestora.nome);
        });
      }
    } finally {
      await limparPersonaSemEmpresa(vendedorComRoleGestora);
      await limparPersonaSemEmpresa(vendedorDesligado);
    }
  });

  test("Acessos segue as 5 abas e mostra supervisão, ações e selo após configurar", async ({
    page,
  }) => {
    await loginAs(page, full.email, full.senha);
    await page.goto("/operacao/xacessos");
    await expect(page.getByRole("heading", { name: "Acessos e permissões" }).first()).toBeVisible({
      timeout: 15_000,
    });
    for (const aba of [
      "Meu time",
      "Pendentes de aprovação",
      "Desligamentos",
      "Personalização geral",
      "Performance",
    ]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${aba}`) })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Cadastro direto" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Convidar · Convite Supper/ })).toBeVisible();

    const linha = page.getByRole("row").filter({ hasText: vendedor.email });
    await expect(linha).toContainText(full.nome);
    await expect(linha.getByRole("button", { name: "Ver" })).toBeVisible();
    await expect(linha.getByRole("button", { name: "Configurar" })).toBeVisible();
    await expect(linha.getByRole("button", { name: "Excluir" })).toBeVisible();

    await linha.getByRole("button", { name: "Configurar" }).click();
    const modal = page.locator(".modal");
    await modal.locator("input").nth(0).fill("Equipe QA Full");
    await modal.locator("input").nth(1).fill("8");
    await modal.locator("input").nth(2).fill("41");
    await modal.locator("input").nth(3).fill("19");
    await modal.getByRole("button", { name: "Salvar configuração" }).click();

    const linhaAtualizada = page.getByRole("row").filter({ hasText: vendedor.email });
    await expect(linhaAtualizada).toContainText("Equipe QA Full", { timeout: 10_000 });
    await expect(linhaAtualizada).toContainText("41%");
    await expect(linhaAtualizada).toContainText("personalizado");
  });

  test("fluxo cadastro direto → configurar → desligar mantém o vendedor na própria Full", async ({
    page,
  }, testInfo) => {
    const email = `cadastro-full-e2e-${Date.now()}@teste.local`;
    const nomeCadastro = `Vendedora Fluxo Full ${Date.now()}`;
    await loginAs(page, full.email, full.senha);
    await page.goto("/operacao/xacessos");
    await page.getByRole("button", { name: "Cadastro direto" }).click();
    let modal = page.locator(".modal");
    await expect(modal.getByRole("button", { name: "1 · Cadastro" })).toHaveClass(/on/);
    await expect(modal.getByRole("button", { name: "2 · Configuração" })).toBeDisabled();
    await modal.locator("input:not([type])").nth(0).fill(nomeCadastro);
    await modal.getByPlaceholder("000.000.000-00").fill("12345678901");
    await modal.getByPlaceholder("(11) 90000-0000").fill("11999990000");
    await modal.locator('input[type="email"]').fill(email);
    await modal.getByRole("button", { name: "Continuar para configuração" }).click();

    await expect(modal.getByRole("button", { name: "2 · Configuração" })).toHaveClass(/on/);
    await modal.locator('input[type="number"]').nth(0).fill("4");
    await modal.locator('input[type="number"]').nth(1).fill("30");
    await modal.locator('input[type="number"]').nth(2).fill("10");
    const inicioCadastro = Date.now();
    const respostasCadastro: Array<{ url: string; status: number; ms: number }> = [];
    const capturarResposta = (response: import("@playwright/test").Response) => {
      if (response.request().method() === "POST") {
        respostasCadastro.push({
          url: response.url(),
          status: response.status(),
          ms: Date.now() - inicioCadastro,
        });
      }
    };
    page.on("response", capturarResposta);
    await modal.getByRole("button", { name: "Concluir cadastro" }).click();

    const linha = page.getByRole("row").filter({ hasText: nomeCadastro });
    try {
      await expect(linha).toBeVisible({ timeout: 15_000 });
      if (process.env.E2E_EXPECT_EMAIL_CONFIG_MISSING === "1") {
        await expect(page.locator(".banner.warn")).toContainText(
          "Configuração de e-mail ausente no servidor",
        );
      }
    } catch (error) {
      const criadoNoBanco = await profilePorEmail(email);
      await testInfo.attach("diagnostico-cadastro-direto.json", {
        contentType: "application/json",
        body: Buffer.from(
          JSON.stringify(
            {
              elapsed_ms: Date.now() - inicioCadastro,
              modal_visivel: await modal.isVisible(),
              botao: await modal
                .getByRole("button", { name: /Cadastrando|Concluir cadastro/ })
                .textContent()
                .catch(() => null),
              alerta: await modal
                .locator(".banner.alert")
                .textContent()
                .catch(() => null),
              aba_time_ativa: await page
                .getByRole("button", { name: /^Meu time/ })
                .getAttribute("class"),
              busca: await page
                .getByPlaceholder("Buscar vendedor…")
                .inputValue()
                .catch(() => null),
              respostas_post: respostasCadastro,
              criado_no_banco: criadoNoBanco,
            },
            null,
            2,
          ),
        ),
      });
      throw error;
    } finally {
      page.off("response", capturarResposta);
    }
    const criado = await profilePorEmail(email);
    expect(criado).toMatchObject({
      empresa_id: full.empresaId,
      superior_id: full.userId,
      status: "aprovada",
      leads_dia: 4,
      cpf: "12345678901",
      telefone: "11999990000",
    });

    await linha.getByRole("button", { name: "Configurar" }).click();
    modal = page.locator(".modal");
    await modal.locator("input").nth(0).fill("Equipe Atualizada");
    await modal.getByRole("button", { name: "Salvar configuração" }).click();
    await expect(page.getByRole("row").filter({ hasText: nomeCadastro })).toContainText(
      "Equipe Atualizada",
      { timeout: 10_000 },
    );

    await page
      .getByRole("row")
      .filter({ hasText: nomeCadastro })
      .getByRole("button", { name: "Excluir" })
      .click();
    modal = page.locator(".modal");
    await modal.locator("textarea").fill("Desligamento pelo fluxo completo de QA");
    await modal.getByRole("button", { name: "Confirmar desligamento" }).click();
    await page.getByRole("button", { name: /^Desligamentos/ }).click();
    await expect(page.getByRole("row").filter({ hasText: nomeCadastro })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Visão geral deixa de contar vendedor desligado sem incluir a própria Full", async ({
    page,
  }) => {
    await desligarUsuarioE2E(vendedor.userId);
    await loginAs(page, full.email, full.senha);
    await page.goto("/comando/visao-geral");

    await expect(page.getByRole("heading", { name: "Visão geral da franquia" })).toBeVisible();
    await expect(page.locator(".page-head .sub")).toContainText("0 vendedores ativos");
  });
});
