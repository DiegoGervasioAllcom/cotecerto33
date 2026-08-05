import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarPersona,
  limparPersona,
  limparPersonaSemEmpresa,
  documentoUnico,
  empresaPendentePorNome,
  limparCadastroManual,
  matrizProfileId,
  statusDesligamento,
  type Persona,
} from "./provision";

/**
 * V11 · C15 — E2E do ciclo de vida de cadastros (Frente 3).
 *
 * Greenfield: nenhum destes três fluxos tinha E2E antes. A lógica de negócio
 * de cada RPC já tem testes de banco dedicados (trava-exclusao-rede.test.ts,
 * desligamento-solicitacoes.test.ts) — o que este spec prova é a jornada pelo
 * navegador, não a regra em si.
 */

const MATRIZ_EMAIL = "desenvolvimento@suppercerto.com.br";
const MATRIZ_SENHA = "Supper@123!";

test("C14/C15 · /auth/cadastro está de fato fora do ar", async ({ page }) => {
  await page.goto("/auth/cadastro");
  await expect(page.getByText("Página não encontrada")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Criar franquia" })).toHaveCount(0);
});

test.describe("C15 · Cadastro manual · exceção", () => {
  let empresaId: string | undefined;

  test.afterEach(async () => {
    if (empresaId) await limparCadastroManual(empresaId);
    empresaId = undefined;
  });

  test("vira pendente correto (sem convite, com autoria) e abre a classificação", async ({
    page,
  }) => {
    await loginAs(page, MATRIZ_EMAIL, MATRIZ_SENHA);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/operacao/acessos");
    await expect(page.getByRole("heading", { name: "Acessos e permissões" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page
      .locator(".acc-group", { hasText: "MATRIZ · TIME INTERNO" })
      .getByRole("button", { name: "Cadastro manual · exceção" })
      .click();

    const modalManual = page.locator(".modal-host", { hasText: "Cadastro manual — exceção" });
    await expect(modalManual).toBeVisible();

    const nome = `Colaborador Manual E2E ${Date.now()}`;
    const documento = documentoUnico();
    const email = `manual.e2e.${Date.now()}@teste.local`;
    await modalManual.locator("#mc-nome").fill(nome);
    await modalManual.locator("#mc-doc").fill(documento);
    await modalManual.locator("#mc-email").fill(email);
    await modalManual.getByRole("button", { name: "Continuar para classificação" }).click();

    // A criação já encadeia a abertura da classificação — sem clique extra.
    const modalClassificar = page.locator(".modal-host", {
      hasText: `Classificar acesso — ${nome}`,
    });
    await expect(modalClassificar).toBeVisible({ timeout: 15_000 });
    // Sem convite: não há "Definido no convite" travando o tipo.
    await expect(modalClassificar.getByText("Definido no convite:")).toHaveCount(0);
    await modalClassificar.locator(".modal-h .x").click();

    const matrizId = await matrizProfileId();
    await expect
      .poll(async () => empresaPendentePorNome(nome), { timeout: 15_000 })
      .toMatchObject({
        status: "pendente",
        convite_id: null,
        criado_por: matrizId,
        tipo: "pf",
        documento,
      });

    const pendente = await empresaPendentePorNome(nome);
    empresaId = pendente!.id;
  });
});

test.describe("C15 · Trava de exclusão (C6)", () => {
  let master: Persona;
  let franquia: Persona;
  let vendedor: Persona;

  test.beforeAll(async () => {
    master = await criarPersona({ role: "master" });
    franquia = await criarPersona({
      role: "franqueado",
      modalidade: "individual",
      superiorId: master.userId,
    });
    vendedor = await criarPersona({
      role: "vendedor",
      empresaId: franquia.empresaId,
      superiorId: franquia.userId,
    });
  });

  test.afterAll(async () => {
    await limparPersonaSemEmpresa(vendedor);
    await limparPersona(franquia);
    await limparPersona(master);
  });

  test("Master com franquia ativa não pode ser excluído; franquia com vendedor ativo também não", async ({
    page,
  }) => {
    await loginAs(page, MATRIZ_EMAIL, MATRIZ_SENHA);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/operacao/acessos");
    await page
      .locator(".acc-group", { hasText: "EXTERNOS · REDE" })
      .getByRole("button", { name: "Cadastros Rede" })
      .click();

    // Master com franquia vinculada. A tabela de Cadastros Rede mostra o
    // nome (não o e-mail), e a linha da franquia legitimamente mostra "Master
    // {nome}" na coluna Info — `hasText` bate nas duas linhas. O nome da
    // PRÓPRIA linha vem só dentro de <strong>, o do "dono" na Info não —
    // escopar por esse elemento resolve a ambiguidade.
    const linhaMaster = page
      .locator("tr")
      .filter({ has: page.locator("strong", { hasText: master.nome }) });
    await expect(linhaMaster).toBeVisible({ timeout: 20_000 });

    // `excluir()` chama `window.prompt` e depois `window.alert` de forma
    // síncrona — esperar o evento "dialog" depois do click() trava o
    // Playwright (o click só "termina" quando o diálogo some, e nada
    // dispara esse "some" enquanto ninguém reage). O jeito robusto é um
    // handler persistente que já resolve cada diálogo assim que ele abre.
    const mensagens: string[] = [];
    page.on("dialog", (dialog) => {
      if (dialog.type() === "prompt") void dialog.accept("Motivo E2E — trava de exclusão");
      else {
        mensagens.push(dialog.message());
        void dialog.accept();
      }
    });

    await linhaMaster.getByRole("button", { name: "Excluir" }).click();
    await expect.poll(() => mensagens.length, { timeout: 15_000 }).toBeGreaterThan(0);
    expect(mensagens[0]).toContain("franquia(s) ativa(s)");

    // Franquia com vendedor ativo na base.
    const linhaFranquia = page
      .locator("tr")
      .filter({ has: page.locator("strong", { hasText: franquia.nome }) });
    await expect(linhaFranquia).toBeVisible({ timeout: 20_000 });
    await linhaFranquia.getByRole("button", { name: "Excluir" }).click();
    await expect.poll(() => mensagens.length, { timeout: 15_000 }).toBeGreaterThan(1);
    expect(mensagens[1]).toContain("vendedor(es) ativo(s)");

    // Nenhuma das travas mudou o sinal — os dois continuam ativos.
    const master2 = await statusDesligamento(master.userId);
    const franquia2 = await statusDesligamento(franquia.userId);
    expect(master2?.desligado_em).toBeNull();
    expect(franquia2?.desligado_em).toBeNull();
  });
});

test.describe("C15 · Solicitar → aprovar desligamento (C7/C8/C9)", () => {
  let master: Persona;
  let vendedor: Persona;

  test.beforeAll(async () => {
    master = await criarPersona({ role: "master" });
    vendedor = await criarPersona({
      role: "vendedor",
      superiorId: master.userId,
    });
  });

  test.afterAll(async () => {
    await limparPersona(vendedor);
    await limparPersona(master);
  });

  test("motivo vazio é bloqueado; motivo preenchido cria pedido; Matriz aprova e desliga de fato", async ({
    page,
  }) => {
    await loginAs(page, master.email, master.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/operacao/xacessos");
    await expect(page.getByRole("heading", { name: "Acessos da equipe" }).first()).toBeVisible({
      timeout: 15_000,
    });

    const linhaVendedor = page.locator("tr", { hasText: vendedor.email });
    await expect(linhaVendedor).toBeVisible({ timeout: 20_000 });
    await linhaVendedor.getByRole("button", { name: "Solicitar desligamento" }).click();

    const modalSolicitar = page.locator(".modal-host", { hasText: "Solicitar desligamento" });
    await expect(modalSolicitar).toBeVisible();

    // Motivo vazio é bloqueado — nem chega a chamar a RPC.
    await modalSolicitar.getByRole("button", { name: "Enviar para a Matriz" }).click();
    await expect(modalSolicitar.getByText("Motivo é obrigatório.")).toBeVisible();

    const motivo = `Baixa performance — motivo E2E ${Date.now()}.`;
    await modalSolicitar.locator("#sd-motivo").fill(motivo);
    await modalSolicitar.getByRole("button", { name: "Enviar para a Matriz" }).click();
    await expect(modalSolicitar).toHaveCount(0, { timeout: 15_000 });

    // Matriz aprova.
    const matrizPage = await page.context().browser()!.newPage();
    await loginAs(matrizPage, MATRIZ_EMAIL, MATRIZ_SENHA);
    await expect(matrizPage).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await matrizPage.goto("/operacao/acessos");
    await matrizPage
      .locator(".acc-group", { hasText: "EXTERNOS · REDE" })
      .getByRole("button", { name: "Desligamentos" })
      .click();

    // A linha da tabela de solicitações mostra o nome do alvo (não o e-mail),
    // então localiza pelo motivo digitado — único a este teste (timestamp).
    const linhaPedido = matrizPage.locator("tr", { hasText: motivo });
    await expect(linhaPedido).toBeVisible({ timeout: 15_000 });
    await linhaPedido.getByRole("button", { name: "Aprovar" }).click();

    await expect
      .poll(async () => (await statusDesligamento(vendedor.userId))?.desligado_em, {
        timeout: 15_000,
      })
      .not.toBeNull();

    await matrizPage.close();
  });
});
