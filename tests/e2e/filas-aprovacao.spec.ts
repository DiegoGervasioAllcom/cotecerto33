import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarPersona,
  limparPersona,
  limparConvite,
  pedidoDoConvitePorCodigo,
  documentoUnico,
  type Persona,
} from "./provision";

/**
 * V11 · F10 — E2E do roteamento das filas de aprovação (Frente 2).
 *
 * O que este spec protege é a garantia central de F1/F2: quem é dona da fila
 * é função de banco (RLS), não filtro de tela. Um convite interno tem de cair
 * no bloco da Matriz com o cargo certo; um convite de vendedor de Franquia
 * Full tem de desaparecer da fila da Matriz por completo — nos dois blocos —
 * e só existir na fila da própria Full, que também é quem aprova.
 *
 * A lógica de aprovar_acesso/fn_pode_aprovar_pedido já tem 20 testes de banco
 * (tests/db/filas-aprovacao-v11.test.ts); aqui o que se prova é a jornada pelo
 * navegador — emitir, cadastrar pelo link, aparecer (ou não) na tela certa.
 */

const MATRIZ_EMAIL = "desenvolvimento@suppercerto.com.br";
const MATRIZ_SENHA = "Supper@123!";

async function abrirComoConvidado(page: Page, url: string): Promise<Page> {
  const contexto = await page.context().browser()!.newContext();
  const nova = await contexto.newPage();
  await nova.goto(url);
  return nova;
}

/** Preenche e envia o formulário de cadastro do convidado (mesmo shape do C11). */
async function cadastrarPeloConvite(convidado: Page): Promise<void> {
  await convidado.locator('.auth-input input[placeholder="000.000.000-00"]').fill(documentoUnico());
  await convidado
    .locator('.auth-input input[type="email"]')
    .fill(`convidado.e2e.${Date.now()}.${Math.floor(Math.random() * 1e5)}@teste.local`);
  await convidado.locator('.auth-input input[type="password"]').fill("Supper@123!");
  await convidado.getByRole("button", { name: /Enviar cadastro/ }).click();
  await expect(convidado.getByRole("heading", { name: "Cadastro enviado" })).toBeVisible({
    timeout: 20_000,
  });
}

/** Extrai o código humano (SC-XXXXXX) do rótulo da mensagem — como em C11. */
async function codigoDoConvite(modal: import("@playwright/test").Locator): Promise<string> {
  const rotulo = (await modal.locator("label", { hasText: "Mensagem pronta" }).innerText()) ?? "";
  const codigo = rotulo.match(/SC-[0-9A-Z]{6}/)?.[0];
  expect(codigo, "o código SC- tem de aparecer na tela").toBeTruthy();
  return codigo!;
}

test.describe("Frente 2 · F10 — roteamento das filas por trilha do convite", () => {
  let full: Persona;
  let codigoInterno: string | undefined;
  let codigoFull: string | undefined;

  test.beforeAll(async () => {
    full = await criarPersona({ role: "franqueado", modalidade: "full" });
  });

  test.afterAll(async () => {
    if (codigoInterno) {
      const registro = await pedidoDoConvitePorCodigo(codigoInterno);
      if (registro?.convite.id) await limparConvite(registro.convite.id);
    }
    if (codigoFull) {
      const registro = await pedidoDoConvitePorCodigo(codigoFull);
      if (registro?.convite.id) await limparConvite(registro.convite.id);
    }
    await limparPersona(full);
  });

  test("interno cai no bloco da Matriz com o cargo certo; vendedor de Full some da Matriz e só existe na fila da própria Full", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // ---- 1) Convite interno: a Matriz emite, o cadastro entra no bloco INTERNO ----
    await loginAs(page, MATRIZ_EMAIL, MATRIZ_SENHA);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto("/operacao/acessos");
    await expect(page.getByRole("heading", { name: "Acessos e permissões" }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /Convidar · time interno/ }).click();
    const modalInterno = page.getByRole("dialog", { name: /time interno da Matriz/ });
    await expect(modalInterno).toBeVisible();

    const nomeInterno = `Coord E2E ${Date.now()}`;
    await modalInterno.locator("#cv-nome").fill(nomeInterno);
    await modalInterno
      .locator("#cv-perfil")
      .selectOption({ label: "Matriz · Coordenador Comercial" });
    await modalInterno.getByRole("button", { name: "Gerar mensagem" }).click();
    const mensagemInterno = modalInterno.getByTestId("convite-mensagem");
    await expect(mensagemInterno).toBeVisible({ timeout: 15_000 });
    const linkInterno = (await mensagemInterno.inputValue()).match(/https?:\/\/\S+/)?.[0];
    expect(linkInterno, "a mensagem tem de trazer o link do convite").toBeTruthy();
    codigoInterno = await codigoDoConvite(modalInterno);
    await page.locator(".modal-f").getByRole("button", { name: "Fechar" }).click();

    const convidadoInterno = await abrirComoConvidado(page, linkInterno!);
    await expect(
      convidadoInterno.getByRole("heading", { name: "Complete o seu cadastro" }),
    ).toBeVisible({ timeout: 15_000 });
    await cadastrarPeloConvite(convidadoInterno);
    await convidadoInterno.context().close();

    // O bloco Interno é o padrão da tela ao carregar — não precisa clicar em nada
    // para provar que caiu ali, e não no Externo.
    await page.goto("/operacao/acessos");
    await expect(page.getByText("MATRIZ · TIME INTERNO (POR ESCOPO)")).toBeVisible({
      timeout: 15_000,
    });
    const linhaInterno = page.locator("tr", { hasText: nomeInterno });
    await expect(linhaInterno).toBeVisible({ timeout: 20_000 });
    await expect(linhaInterno.getByText("Matriz | Coordenador Comercial")).toBeVisible();

    // ---- 2) Convite de vendedor de Franquia Full: a própria Full emite ----
    const fullPage = await page.context().browser()!.newPage();
    await loginAs(fullPage, full.email, full.senha);
    await expect(fullPage).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await fullPage.goto("/operacao/xacessos");
    await expect(
      fullPage.getByRole("heading", { name: "Acessos e permissões" }).first(),
    ).toBeVisible({ timeout: 15_000 });

    await fullPage.getByRole("button", { name: "Convidar · Convite Supper" }).click();
    const modalFull = fullPage.getByRole("dialog", { name: /meu time/ });
    await expect(modalFull).toBeVisible();

    const nomeFull = `Vendedor Full E2E ${Date.now()}`;
    await modalFull.locator("#cv-nome").fill(nomeFull);
    await modalFull.getByRole("button", { name: "Gerar mensagem" }).click();
    const mensagemFull = modalFull.getByTestId("convite-mensagem");
    await expect(mensagemFull).toBeVisible({ timeout: 15_000 });
    const linkFull = (await mensagemFull.inputValue()).match(/https?:\/\/\S+/)?.[0];
    expect(linkFull, "a mensagem tem de trazer o link do convite").toBeTruthy();
    codigoFull = await codigoDoConvite(modalFull);
    await fullPage.locator(".modal-f").getByRole("button", { name: "Fechar" }).click();

    const convidadoFull = await abrirComoConvidado(fullPage, linkFull!);
    await expect(
      convidadoFull.getByRole("heading", { name: "Complete o seu cadastro" }),
    ).toBeVisible({ timeout: 15_000 });
    await cadastrarPeloConvite(convidadoFull);
    await convidadoFull.context().close();
    await expect
      .poll(async () => (await pedidoDoConvitePorCodigo(codigoFull!))?.pedido?.status, {
        timeout: 15_000,
      })
      .toBe("pendente");

    // Não aparece na fila da Matriz em NENHUM dos dois blocos — a RLS de F2
    // já exclui o pendente da Full antes mesmo de chegar à tela.
    await page.goto("/operacao/acessos");
    await expect(page.getByText(nomeFull)).toHaveCount(0);
    await page
      .locator(".acc-group", { hasText: "EXTERNOS · REDE" })
      .getByRole("button", { name: /Pendentes de aprovação/ })
      .click();
    await expect(page.getByText(nomeFull)).toHaveCount(0);

    // Só existe na fila da própria Full — que também é quem aprova.
    await fullPage.goto("/operacao/xacessos");
    await fullPage.getByRole("button", { name: /Pendentes de aprovação/ }).click();
    const linhaFull = fullPage.locator("tr", { hasText: nomeFull });
    await expect(linhaFull).toBeVisible({ timeout: 20_000 });
    await expect(linhaFull.getByText("Vendedor | Full")).toBeVisible();

    await linhaFull.getByRole("button", { name: "Analisar" }).click();
    const modalAnalisar = fullPage.locator(".modal-host");
    await expect(modalAnalisar.getByText(/Definido no convite: Vendedor \| Full/)).toBeVisible({
      timeout: 15_000,
    });
    // Único vínculo possível é a própria franquia — nenhuma outra Full aparece.
    await expect(modalAnalisar.locator("select option")).toHaveCount(2); // "— Selecione —" + a própria
    await modalAnalisar.locator("select").selectOption(full.empresaId);
    await modalAnalisar.getByRole("button", { name: "Liberar acesso" }).click();

    // O objetivo deste spec é provar aprovação e roteamento. O dispatch externo
    // pode continuar pendente sem Resend no CI, então confirmamos diretamente a
    // transição persistida antes de recarregar a fila.
    await expect
      .poll(async () => (await pedidoDoConvitePorCodigo(codigoFull!))?.pedido?.status, {
        timeout: 15_000,
      })
      .toBe("aprovada");
    if ((await fullPage.locator(".modal-host").count()) > 0) {
      await modalAnalisar.locator(".modal-h .x").click();
    }
    await fullPage.reload();
    await expect(fullPage.locator(".modal-host")).toHaveCount(0);
    await fullPage.getByRole("button", { name: /Pendentes de aprovação/ }).click();
    await expect(fullPage.getByText("Nenhum cadastro pendente")).toBeVisible({ timeout: 15_000 });

    await fullPage.close();
  });
});
