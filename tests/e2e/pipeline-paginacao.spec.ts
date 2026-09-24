// Pipeline V12 (T10): paginação server-side do Kanban (`use-pipeline-pagination.ts`
// + `pipeline-query.ts`, T4/T5) — cada coluna carrega 5 leads inicialmente e
// "carrega mais" de 4 em 4, via botão "Mostrar mais" ou via `IntersectionObserver`
// (scroll). Spec dedicado (em vez de crescer `pipeline-lead-recebido.spec.ts`,
// que já tem ~290 linhas e cobre um assunto diferente — lead externo recebido):
// aqui o foco é o comportamento da paginação em si, não a origem do lead.
//
// O item "filtro Status (ativos/perdidos) continua funcionando com o novo hook"
// do plano desta task NÃO é duplicado aqui — já existe e passa em
// `pipeline-lead-recebido.spec.ts` ("filtro Status ativos/perdidos: ..."), que
// exercita exatamente esse comportamento contra `usePipelinePagination`. Repetir
// o mesmo fixture+asserts aqui só duplicaria setup sem cobrir nada novo (regra
// do AGENTS.md: fixtures/setup reutilizáveis, não duplicados por arquivo).
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarVendedorComLeadEmCotacao,
  criarVendedorComVariosLeads,
  limparVendedorComLeadEmCotacao,
  limparVendedorComVariosLeads,
  type VendedorComLeadEmCotacao,
  type VendedorComVariosLeads,
} from "./provision";

test.describe("pipeline — paginação server-side do Kanban", () => {
  let vendedor9Leads: VendedorComVariosLeads;
  let vendedorEstagios: VendedorComLeadEmCotacao;

  test.beforeAll(async () => {
    [vendedor9Leads, vendedorEstagios] = await Promise.all([
      // 9 leads no bucket "novo": carga inicial (5) + 1 página de "carregar
      // mais" (4) esgota exatamente o total — cenário de fronteira usado nos
      // testes de botão/scroll abaixo.
      criarVendedorComVariosLeads(9),
      criarVendedorComLeadEmCotacao(),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([
      limparVendedorComVariosLeads(vendedor9Leads),
      limparVendedorComLeadEmCotacao(vendedorEstagios),
    ]);
  });

  test("coluna Lead novo carrega 5 de início; botão Mostrar mais busca o restante", async ({
    page,
  }) => {
    // 3 waits sequenciais dependentes de rede (carga inicial + 2 cliques) —
    // sob execução concorrente (`--repeat-each`/vários workers), o timeout
    // padrão de 30s por teste pode ser insuficiente mesmo com cada `expect`
    // individual generoso (mesmo padrão de `filas-aprovacao.spec.ts`).
    test.setTimeout(60_000);
    await loginAs(page, vendedor9Leads.email, vendedor9Leads.senha);
    await page.goto("/venda/pipeline");

    const coluna = page.locator('.kcol[data-stage="novo"]');
    const cards = coluna.locator(".kcard");
    const botaoMostrarMais = coluna.getByRole("button", { name: "Mostrar mais" });

    // Ver comentário do timeout maior em pipeline-lead-recebido.spec.ts: a
    // carga inicial do Kanban paginado dispara várias requisições paralelas
    // (uma por coluna + resumo + opções de filtro), então sob execução
    // concorrente do Playwright pode passar dos 5000ms padrão.
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });

    // Negativo: carga inicial é 5, não os 9 leads criados.
    await expect(cards).toHaveCount(5);
    await expect(botaoMostrarMais).toBeVisible();

    await botaoMostrarMais.click();
    await expect(cards).toHaveCount(9, { timeout: 10_000 });

    // O motor de paginação (`use-pipeline-pagination.ts`) decide `hasMore`
    // por "a página voltou cheia?" (`leads.length >= limit`), não por saber
    // de antemão quantos leads existem no total — com 9 leads (5 + 4 exatos),
    // a 2ª página vem com os 4 que faltavam, exatamente do tamanho do
    // limite, então o botão AINDA aparece (mesmo contrato de
    // `tests/unit/use-pipeline-pagination.test.ts`, teste "carregarMais busca
    // +4 e concatena ao final, mantendo hasMore quando a página vem cheia").
    // Só some depois de uma 2ª tentativa que volta vazia — não é bug, é a
    // única forma de saber "acabou" sem trazer todos de uma vez.
    await expect(botaoMostrarMais).toBeVisible();

    await botaoMostrarMais.click();
    // `toHaveCount(0)` já faz polling até a resposta (vazia) do 2º clique
    // chegar — sem `waitForTimeout` fixo, que seria flaky sob carga.
    await expect(botaoMostrarMais).toHaveCount(0, { timeout: 10_000 });
    // Sem duplicar/perder cards na tentativa que voltou vazia.
    await expect(cards).toHaveCount(9);
  });

  test("scroll até o fim da coluna carrega mais leads sem clicar no botão", async ({ page }) => {
    // Ver comentário do timeout maior no teste do botão "Mostrar mais" acima
    // — aqui também são 2 waits sequenciais dependentes de rede (carga
    // inicial + scroll).
    test.setTimeout(60_000);
    // Viewport baixo o bastante pra que o sentinela do IntersectionObserver
    // (logo após os 5 primeiros cards) NÃO esteja na viewport inicial — senão
    // o próprio carregamento da página já dispararia o auto-load (o
    // observer roda contra o viewport do browser, a coluna não tem scroll
    // interno próprio: ver `.kcol` em `src/styles/proto.css`, sem
    // `overflow-y`/`max-height`). Só assim o scroll abaixo é o que
    // efetivamente traz o sentinela pra dentro da tela.
    await page.setViewportSize({ width: 1280, height: 420 });
    await loginAs(page, vendedor9Leads.email, vendedor9Leads.senha);
    await page.goto("/venda/pipeline");

    const coluna = page.locator('.kcol[data-stage="novo"]');
    const cards = coluna.locator(".kcard");
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    await expect(cards).toHaveCount(5);

    // Confirma que o botão "Mostrar mais" (fora da viewport curta) não foi
    // clicado nem está sendo esperado — só o scroll abaixo deve mudar a
    // contagem de cards.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await expect(cards).toHaveCount(9, { timeout: 10_000 });
  });

  test("filtro de Estágio busca só a coluna escolhida: as outras somem da tela", async ({
    page,
  }) => {
    // Ver comentário do timeout maior no teste do botão "Mostrar mais"
    // acima — aqui são 4 waits sequenciais dependentes de rede (carga
    // inicial + 3 trocas de filtro).
    test.setTimeout(60_000);
    await loginAs(page, vendedorEstagios.email, vendedorEstagios.senha);
    await page.goto("/venda/pipeline");

    const colunaNovo = page.locator('.kcol[data-stage="novo"]');
    const colunaCotacao = page.locator('.kcol[data-stage="cotacao"]');
    const colunaNegociacao = page.locator('.kcol[data-stage="negociacao"]');

    // Default ("Estágio · todos"): as duas colunas com lead existem, cada
    // uma com o card certo.
    await expect(colunaNovo.locator(".kcard")).toHaveCount(1, { timeout: 20_000 });
    await expect(colunaCotacao.locator(".kcard")).toHaveCount(1);

    const filtroEstagio = page
      .locator("select")
      .filter({ has: page.locator('option[value="novo"]') });

    // Timeouts maiores nos `toHaveCount` abaixo pelo mesmo motivo do topo do
    // arquivo: cada troca de filtro refaz o fetch de todas as colunas
    // pedidas (`resetar()` em `use-pipeline-pagination.ts`), que sob
    // execução concorrente do Playwright pode passar dos 5000ms padrão.

    // Positivo: filtrar por "cotacao" mantém a coluna com o card certo...
    await filtroEstagio.selectOption("cotacao");
    await expect(colunaCotacao.locator(".kcard")).toHaveCount(1, { timeout: 10_000 });
    // ...e negativo: a coluna "novo" (que tinha lead) some da tela por
    // completo — não fica vazia, deixa de ser buscada/renderizada. Esse é o
    // comportamento novo desta frente (antes só escondia visualmente, a
    // coluna continuava lá e vazia).
    await expect(colunaNovo).toHaveCount(0);
    // Uma coluna sem lead nenhum (nem antes nem depois do filtro) também
    // não é buscada/renderizada com "cotacao" selecionado.
    await expect(colunaNegociacao).toHaveCount(0);

    // Voltar a "novo": inverte — "cotacao" some, "novo" reaparece com o card.
    await filtroEstagio.selectOption("novo");
    await expect(colunaNovo.locator(".kcard")).toHaveCount(1, { timeout: 10_000 });
    await expect(colunaCotacao).toHaveCount(0);

    // "todas" (default) mostra as duas de novo.
    await filtroEstagio.selectOption("todas");
    await expect(colunaNovo.locator(".kcard")).toHaveCount(1, { timeout: 10_000 });
    await expect(colunaCotacao.locator(".kcard")).toHaveCount(1, { timeout: 10_000 });
  });
});
