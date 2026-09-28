// Follow-up da V12.3.4: decisão do usuário registrada em
// `src/lib/nav-badges.ts`/`em-cotacao.tsx`/`em-finalizacao.tsx` — os números
// do menu "Em cotação", "Em negociação" (soma de aguardando + finalizada) e
// "Em finalização", e as telas correspondentes, mostram só as cotações do
// VENDEDOR LOGADO (`.eq("responsavel_id", uid)`), mesmo a RLS liberando a
// empresa inteira. Este spec confirma isso ponta a ponta: dois vendedores da
// mesma empresa, cada um com dados nas três fases, e nenhum vê o do outro —
// e que o número do badge de cada item do menu é igual ao total da própria
// tela (não ao total da empresa).
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarCotacaoComStatusExtra,
  criarCotacaoEnviadaQuiverExtra,
  criarCotacaoQuiverFixture,
  criarPersona,
  criarTentativaTransmissaoEnviada,
  limparCotacaoComStatusExtra,
  limparCotacaoEnviadaQuiverExtra,
  limparCotacaoQuiverFixture,
  limparPersonaSemEmpresa,
  type CotacaoQuiverFixture,
  type CotacaoStatusExtra,
} from "./provision";

/**
 * Monta as três fases para um vendedor que já existe (empresa + userId):
 * - Em cotação: uma cotação `rascunho`.
 * - Em negociação: uma `enviada_quiver` (Aguardando cotação, via
 *   `criarCotacaoEnviadaQuiverExtra`, já usado por `em-negociacao.spec.ts`) +
 *   uma `calculada` (Cotação finalizada) com `calculo_visto_em` já preenchido
 *   — para não acionar o aviso global "COTAÇÃO FINALIZADA" (`useCotacoesNovas`)
 *   enquanto o teste navega por outras telas.
 * - Em finalização: uma tentativa de transmissão `enviada`, pendurada numa
 *   cotação `aceita` (status "neutro", fora das três telas de fase, para não
 *   contaminar a contagem de Em negociação).
 */
async function montarFasesVendedor(
  empresaId: string,
  userId: string,
  rotulo: string,
): Promise<{
  rascunho: CotacaoStatusExtra;
  aguardando: { leadId: string; cotacaoId: string };
  finalizada: CotacaoStatusExtra;
  finalizacao: CotacaoStatusExtra;
}> {
  const rascunho = await criarCotacaoComStatusExtra(
    empresaId,
    userId,
    "rascunho",
    undefined,
    `Segurado Rascunho ${rotulo}`,
  );
  const aguardando = await criarCotacaoEnviadaQuiverExtra(empresaId, userId);
  const finalizada = await criarCotacaoComStatusExtra(
    empresaId,
    userId,
    "calculada",
    { calculo_visto_em: new Date().toISOString() },
    `Segurado Finalizada ${rotulo}`,
  );
  const finalizacao = await criarCotacaoComStatusExtra(
    empresaId,
    userId,
    "aceita",
    undefined,
    `Segurado Finalização ${rotulo}`,
  );
  await criarTentativaTransmissaoEnviada({
    cotacaoId: finalizacao.cotacaoId,
    seguradora: `Seguradora ${rotulo}`,
    formaPagamento: "Boleto",
  });

  return { rascunho, aguardando, finalizada, finalizacao };
}

async function limparFasesVendedor(fases: Awaited<ReturnType<typeof montarFasesVendedor>>) {
  await limparCotacaoComStatusExtra(fases.finalizacao);
  await limparCotacaoComStatusExtra(fases.finalizada);
  await limparCotacaoEnviadaQuiverExtra(fases.aguardando);
  await limparCotacaoComStatusExtra(fases.rascunho);
}

test.describe("Fases da venda mostram só as cotações do vendedor logado (follow-up V12.3.4)", () => {
  test("Em cotação: lista e o badge do menu contam só as cotações do dono, nunca as do colega", async ({
    page,
  }) => {
    const fixture: CotacaoQuiverFixture = await criarCotacaoQuiverFixture();
    let colega: Awaited<ReturnType<typeof criarPersona>> | undefined;
    let fasesDono: Awaited<ReturnType<typeof montarFasesVendedor>> | undefined;
    let fasesColega: Awaited<ReturnType<typeof montarFasesVendedor>> | undefined;
    try {
      fasesDono = await montarFasesVendedor(fixture.empresaId, fixture.userId, "Dono");
      colega = await criarPersona({ role: "vendedor", empresaId: fixture.empresaId });
      fasesColega = await montarFasesVendedor(fixture.empresaId, colega.userId, "Colega");

      await loginAs(page, fixture.email, fixture.senha);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
      await page.goto("/venda/em-cotacao");

      const lista = page.locator('[data-tour="em-cotacao-lista"]');
      const linhas = lista.locator("tbody tr");
      await expect(linhas).toHaveCount(1);
      await expect(lista.getByText("Segurado Rascunho Dono")).toBeVisible();
      await expect(lista.getByText("Segurado Rascunho Colega")).toHaveCount(0);

      const badge = page.locator('a[href="/venda/em-cotacao"] .badge');
      await expect(badge).toHaveText("1");
    } finally {
      if (fasesColega) await limparFasesVendedor(fasesColega);
      if (colega) await limparPersonaSemEmpresa(colega);
      if (fasesDono) await limparFasesVendedor(fasesDono);
      await limparCotacaoQuiverFixture(fixture);
    }
  });

  test("Em negociação: as duas listas (aguardando + finalizada) e o badge somado contam só as do dono", async ({
    page,
  }) => {
    const fixture: CotacaoQuiverFixture = await criarCotacaoQuiverFixture();
    let colega: Awaited<ReturnType<typeof criarPersona>> | undefined;
    let fasesDono: Awaited<ReturnType<typeof montarFasesVendedor>> | undefined;
    let fasesColega: Awaited<ReturnType<typeof montarFasesVendedor>> | undefined;
    try {
      fasesDono = await montarFasesVendedor(fixture.empresaId, fixture.userId, "Dono");
      colega = await criarPersona({ role: "vendedor", empresaId: fixture.empresaId });
      fasesColega = await montarFasesVendedor(fixture.empresaId, colega.userId, "Colega");

      await loginAs(page, fixture.email, fixture.senha);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
      // A cotação `enviada_quiver` do dono já existe desde `criarCotacaoQuiverFixture`
      // (a própria fixture), além da `aguardando` extra de `montarFasesVendedor` —
      // por isso a lista "Aguardando cotação" do dono tem 2 linhas, não 1.
      await page.goto("/venda/em-negociacao");

      const cardAguardando = page.locator('[data-tour="em-negociacao-aguardando"]');
      const cardFinalizada = page.locator('[data-tour="em-negociacao-finalizada"]');
      await expect(cardAguardando.locator("tbody tr")).toHaveCount(2);
      await expect(cardFinalizada.locator("tbody tr")).toHaveCount(1);
      await expect(cardFinalizada.getByText("Segurado Finalizada Dono")).toBeVisible();
      await expect(cardFinalizada.getByText("Segurado Finalizada Colega")).toHaveCount(0);

      // Total da tela (dono): 2 aguardando + 1 finalizada = 3 — igual ao badge somado.
      const badge = page.locator('[data-tour="nav-em-negociacao"] .badge');
      await expect(badge).toHaveText("3");
    } finally {
      if (fasesColega) await limparFasesVendedor(fasesColega);
      if (colega) await limparPersonaSemEmpresa(colega);
      if (fasesDono) await limparFasesVendedor(fasesDono);
      await limparCotacaoQuiverFixture(fixture);
    }
  });

  test("Em finalização: a lista de tentativas em aberto e o badge do menu contam só as do dono", async ({
    page,
  }) => {
    const fixture: CotacaoQuiverFixture = await criarCotacaoQuiverFixture();
    let colega: Awaited<ReturnType<typeof criarPersona>> | undefined;
    let fasesDono: Awaited<ReturnType<typeof montarFasesVendedor>> | undefined;
    let fasesColega: Awaited<ReturnType<typeof montarFasesVendedor>> | undefined;
    try {
      fasesDono = await montarFasesVendedor(fixture.empresaId, fixture.userId, "Dono");
      colega = await criarPersona({ role: "vendedor", empresaId: fixture.empresaId });
      fasesColega = await montarFasesVendedor(fixture.empresaId, colega.userId, "Colega");

      await loginAs(page, fixture.email, fixture.senha);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
      await page.goto("/venda/em-finalizacao");

      const lista = page.locator('[data-tour="em-finalizacao-lista"]');
      const linhas = lista.locator("tbody tr");
      await expect(linhas).toHaveCount(1);
      // Identificador aqui é o SEGURADO (coluna de `cotacao_segurado`, embed
      // 1:1 de `cotacoes` — `cotacao_id` é PK). Bug corrigido: `dedupTentativas`
      // (`em-finalizacao.tsx`) indexava `c?.segurado?.[0]?.nome` como se o
      // embed fosse array; o PostgREST devolve objeto, então a coluna SEGURADO
      // sempre mostrava "—". Agora que está corrigido, esta é a asserção mais
      // forte (nome do cliente, não só a seguradora — coluna plana que sempre
      // funcionou e não provava o embed).
      await expect(lista.getByText("Segurado Finalização Dono")).toBeVisible();
      await expect(lista.getByText("Segurado Finalização Colega")).toHaveCount(0);

      const badge = page.locator('a[href="/venda/em-finalizacao"] .badge');
      await expect(badge).toHaveText("1");
    } finally {
      if (fasesColega) await limparFasesVendedor(fasesColega);
      if (colega) await limparPersonaSemEmpresa(colega);
      if (fasesDono) await limparFasesVendedor(fasesDono);
      await limparCotacaoQuiverFixture(fixture);
    }
  });
});
