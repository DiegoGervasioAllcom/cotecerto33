import type { Page } from "@playwright/test";

/**
 * Faz login na tela /auth usando e-mail e senha, e aguarda a navegação
 * pós-login (o app redireciona automaticamente para a tela inicial do perfil).
 */
export async function loginAs(
  page: Page,
  email: string,
  senha: string,
  options?: { expectStayOnAuth?: boolean },
) {
  // Docker Desktop pode recusar uma conexão isolada logo após o reset/start
  // do Supabase. Repetimos apenas o login enquanto a própria tela /auth
  // permanece aberta; nunca mascaramos falha depois da autenticação.
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    await page.goto("/auth");
    // Os <label> do formulário não têm `for`/`id` associado ao input (não são
    // wrappers), então getByLabel não funciona aqui. Os campos são únicos na
    // página por `type`, o que é estável o suficiente.
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(senha);
    await page.getByRole("button", { name: /entrar/i }).click();
    if (options?.expectStayOnAuth) return;
    try {
      await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 5_000 });
      return;
    } catch {
      if (tentativa === 3) throw new Error(`login não saiu de /auth após ${tentativa} tentativas`);
      await page.waitForTimeout(300);
    }
  }
}

/**
 * Preenche o sub-passo "Dados complementares" da Etapa 7 (Transmissão) e
 * avança até confirmar a transmissão. Lida com os dois ramos da Confirmação
 * (`StepTransmissao.tsx`/`ehCartaoCredito`) sem o chamador precisar saber de
 * antemão qual é o caso:
 * - forma de pagamento sem cartão → a Confirmação já mostra "Confirmar e
 *   transmitir" direto;
 * - forma de pagamento com cartão (`/cart/i`, ex.: "Cartão de crédito") → a
 *   Confirmação mostra "Informar o pagamento", que leva ao sub-passo de
 *   Pagamento (`TransmissaoPagamento.tsx`), onde "Efetivar proposta" é quem
 *   de fato transmite.
 */
export async function confirmarDadosComplementaresTransmissao(page: Page) {
  await page.getByLabel("RG", { exact: true }).fill("123456789");
  await page.getByLabel("Data de emissão", { exact: true }).fill("13/05/2020");
  await page.getByLabel("Órgão emissor", { exact: true }).fill("SSP");
  await page.getByLabel("CEP", { exact: true }).fill("04567-090");
  await page.getByLabel("Número", { exact: true }).fill("123");
  await page.getByLabel("Renavam", { exact: true }).fill("12345678901");
  await page.getByLabel("Cor", { exact: true }).fill("Branco");
  await page
    .getByLabel("Dia de vencimento das demais parcelas", { exact: true })
    .selectOption("10");
  await page.getByRole("button", { name: "Efetivar" }).click();
  await page.getByRole("heading", { name: "Confirmação" }).waitFor();

  const botaoConfirmarOuPagamento = page.getByRole("button", {
    name: /Confirmar e transmitir|Informar o pagamento/,
  });
  await botaoConfirmarOuPagamento.waitFor();
  if (await page.getByRole("button", { name: "Informar o pagamento" }).isVisible()) {
    await page.getByRole("button", { name: "Informar o pagamento" }).click();
    await page.getByRole("heading", { name: "Pagamento" }).waitFor();
    await page.getByRole("button", { name: "Efetivar proposta" }).click();
  } else {
    await page.getByRole("button", { name: "Confirmar e transmitir" }).click();
  }
}
