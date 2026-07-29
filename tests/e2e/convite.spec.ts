import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarConviteInterno,
  pedidoDoConvitePorCodigo,
  limparConvite,
  documentoUnico,
  type ConviteFixture,
} from "./provision";

/**
 * V11 · C11 — Convite Supper de ponta a ponta (item 1 do Handoff).
 *
 * O caminho que este spec protege é o que muda a porta de entrada do sistema:
 * a Matriz emite pela tela, o convidado abre pelo link, o cadastro sai com perfil
 * e vínculo travados, e o pedido chega na fila JÁ CLASSIFICADO — ligado ao convite.
 *
 * Sem isso a Frente 2 não tem como rotear a fila sozinha, então uma regressão aqui
 * é uma regressão na classificação, não só na tela.
 */

const MATRIZ_EMAIL = "desenvolvimento@suppercerto.com.br";
const MATRIZ_SENHA = "Supper@123!";

/** Abre o formulário do convite numa aba anônima — o convidado não tem login. */
async function abrirComoConvidado(page: Page, url: string): Promise<Page> {
  const contexto = await page.context().browser()!.newContext();
  const nova = await contexto.newPage();
  await nova.goto(url);
  return nova;
}

/**
 * Login e ida à tela de Acessos.
 *
 * `loginAs` não espera a navegação pós-login, e um `goto` imediato cai no guard
 * de rota e volta para /auth — foi o que quebrou este spec na primeira execução.
 * Espera-se sair de /auth antes de navegar.
 */
async function irParaAcessosComoMatriz(page: Page) {
  await loginAs(page, MATRIZ_EMAIL, MATRIZ_SENHA);
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
  await page.goto("/operacao/acessos");
  await expect(page.getByRole("heading", { name: "Acessos e permissões" }).first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("Convite Supper — emitir, abrir e cadastrar", () => {
  test("Matriz emite pela tela, o link abre travado e o pedido nasce classificado", async ({
    page,
  }) => {
    await irParaAcessosComoMatriz(page);

    // 1) Emitir pelo botão Convidar do escopo interno.
    await page.getByRole("button", { name: /Convidar · time interno/ }).click();
    const modal = page.getByRole("dialog", { name: /time interno da Matriz/ });
    await expect(modal).toBeVisible();

    const nomeConvidado = `Joana E2E ${Date.now()}`;
    await modal.locator("#cv-nome").fill(nomeConvidado);
    // Os 7 cargos do protótipo vêm da tabela `cargos`.
    await modal.locator("#cv-perfil").selectOption({ label: "Matriz · Supervisor Operacional" });
    await modal.getByRole("button", { name: "Gerar mensagem" }).click();

    const mensagem = modal.getByTestId("convite-mensagem");
    await expect(mensagem).toBeVisible({ timeout: 15_000 });
    const texto = await mensagem.inputValue();

    // A mensagem é a do protótipo: nominal, com o aviso de uso único e 7 dias.
    expect(texto).toContain(nomeConvidado);
    expect(texto).toContain("nominal e de uso único");
    expect(texto).toContain("Matriz | Supervisor Operacional");

    const link = texto.match(/https?:\/\/\S+/)?.[0];
    expect(link, "a mensagem tem de trazer o link do convite").toBeTruthy();

    // O código humano fica no rótulo da mensagem — usamos para conferir no banco.
    const rotulo = (await modal.locator("label", { hasText: "Mensagem pronta" }).innerText()) ?? "";
    const codigo = rotulo.match(/SC-[0-9A-Z]{6}/)?.[0];
    expect(codigo, "o código SC- tem de aparecer na tela").toBeTruthy();

    // 2) O convidado abre o link, sem login.
    const convidado = await abrirComoConvidado(page, link!);
    await expect(convidado.getByRole("heading", { name: "Complete o seu cadastro" })).toBeVisible({
      timeout: 15_000,
    });

    // Perfil e vínculo em texto fixo — não são campos editáveis.
    await expect(convidado.getByTestId("convite-perfil")).toHaveText(
      "Matriz | Supervisor Operacional",
    );
    await expect(convidado.getByTestId("convite-vinculo")).toHaveText("Matriz");
    await expect(convidado.locator("select#cv-perfil")).toHaveCount(0);

    // Trilha interna abre em pessoa física, e o nome já vem do convite.
    await expect(convidado.getByText("CPF", { exact: false }).first()).toBeVisible();
    const inputs = convidado.locator(".auth-input input");
    await expect(inputs.first()).toHaveValue(nomeConvidado);

    // 3) Preencher e enviar.
    const emailConvidado = `joana.e2e.${Date.now()}@teste.local`;
    await convidado
      .locator('.auth-input input[placeholder="000.000.000-00"]')
      .fill(documentoUnico());
    await convidado.locator('.auth-input input[type="email"]').fill(emailConvidado);
    await convidado.locator('.auth-input input[type="password"]').fill("Supper@123!");
    await convidado.getByRole("button", { name: /Enviar cadastro/ }).click();

    await expect(convidado.getByRole("heading", { name: "Cadastro enviado" })).toBeVisible({
      timeout: 20_000,
    });

    // 4) O pedido chegou na fila da Matriz, e o convite fechou.
    await page.goto("/operacao/acessos");
    await expect(page.getByRole("heading", { name: "Acessos e permissões" }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(nomeConvidado).first()).toBeVisible({ timeout: 20_000 });

    // 5) O pedido nasceu CLASSIFICADO: aponta para o convite, e o convite fechou.
    const registro = await pedidoDoConvitePorCodigo(codigo!);
    expect(registro?.convite.usado_em, "o convite deveria estar fechado").toBeTruthy();
    expect(registro?.pedido?.convite_id, "o pedido tem de apontar para o convite").toBe(
      registro?.convite.id,
    );
    // Trilha interna vira pessoa física, derivado do convite e não da tela.
    expect(registro?.pedido?.tipo).toBe("pf");
    expect(registro?.pedido?.status).toBe("pendente");
    expect(registro?.convite.cargo_id).toBe("sup_operacional");

    // 6) Reusar o mesmo link não passa — uso único.
    const reuso = await abrirComoConvidado(page, link!);
    await expect(reuso.getByRole("heading", { name: "Convite já utilizado" })).toBeVisible({
      timeout: 15_000,
    });

    await convidado.context().close();
    await reuso.context().close();
  });
});

test.describe("Convite Supper — links que não servem mais", () => {
  let expirado: ConviteFixture;
  let usado: ConviteFixture;

  test.beforeAll(async () => {
    expirado = await criarConviteInterno({
      nome: "Convidado Expirado",
      expiraEm: new Date(Date.now() - 60_000),
    });
    usado = await criarConviteInterno({ nome: "Convidado Repetido", usado: true });
  });

  test.afterAll(async () => {
    await Promise.all([limparConvite(expirado.id), limparConvite(usado.id)]);
  });

  test("convite expirado explica o que aconteceu e como pedir outro", async ({ page }) => {
    await page.goto(`/convite/${expirado.token}`);
    await expect(page.getByRole("heading", { name: "Convite expirado" })).toBeVisible({
      timeout: 15_000,
    });
    // O critério de aceite do Handoff pede o caminho de pedir um novo.
    await expect(page.getByText(/Como pedir um novo/)).toBeVisible();
    // E deixa claro que nada foi criado.
    await expect(page.getByText(/Nada foi criado/)).toBeVisible();
  });

  test("convite já usado não abre o formulário", async ({ page }) => {
    await page.goto(`/convite/${usado.token}`);
    await expect(page.getByRole("heading", { name: "Convite já utilizado" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(".auth-input input")).toHaveCount(0);
  });

  test("token inexistente não vaza se o convite existe ou não", async ({ page }) => {
    await page.goto(`/convite/${"z".repeat(43)}`);
    await expect(page.getByRole("heading", { name: "Convite não encontrado" })).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("Convite Supper — escopo na tela", () => {
  test("a Matriz vê os dois escopos, e o interno lista os 7 cargos", async ({ page }) => {
    await irParaAcessosComoMatriz(page);

    await expect(page.getByRole("button", { name: /Convidar · time interno/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Convidar · rede externa/ })).toBeVisible();

    await page.getByRole("button", { name: /Convidar · time interno/ }).click();
    const opcoes = page.locator("#cv-perfil option");
    // 7 cargos preset + Vendedor Matriz + o placeholder "Selecione…".
    await expect(opcoes).toHaveCount(9, { timeout: 15_000 });
    await expect(page.locator("#cv-perfil")).toContainText("Vendedor Matriz (Modelo CLT)");

    // A rede externa da Matriz convida só Master e Individual direta.
    // "Fechar" existe duas vezes no modal (o × do topo e o do rodapé).
    await page.locator(".modal-f").getByRole("button", { name: "Fechar" }).click();
    await page.getByRole("button", { name: /Convidar · rede externa/ }).click();
    const externas = page.locator("#cv-perfil option");
    await expect(externas).toHaveCount(3, { timeout: 15_000 });
    await expect(page.locator("#cv-perfil")).not.toContainText("Franquia Full");
  });
});
