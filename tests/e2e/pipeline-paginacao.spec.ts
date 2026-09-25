// Pipeline V12 (T10/T14): paginação server-side do Kanban (`use-pipeline-pagination.ts`
// + `pipeline-query.ts`, T4/T5) e rolagem interna por coluna (`pipeline-coluna.tsx`
// + `use-kcol-fila-scroll.ts`, T14) — cada coluna carrega 5 leads inicialmente e
// "carrega mais" de 4 em 4, mas agora o único gatilho é o rodapé "mais N" da
// própria coluna (`.kcol-restam`): não há mais sentinela de scroll infinito
// (`IntersectionObserver`) nem botão "Mostrar mais" fixo — cada `.kcol` rola por
// dentro (`.kcol-fila`), com título fixo (`.kcol-fixo`) e a página inteira não
// rola no Kanban. Spec dedicado (em vez de crescer `pipeline-lead-recebido.spec.ts`,
// que já tem ~290 linhas e cobre um assunto diferente — lead externo recebido):
// aqui o foco é o comportamento da paginação/rolagem em si, não a origem do lead.
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
  let vendedor13Leads: VendedorComVariosLeads;
  let vendedorEstagios: VendedorComLeadEmCotacao;

  test.beforeAll(async () => {
    [vendedor13Leads, vendedorEstagios] = await Promise.all([
      // 13 leads no bucket "novo": carga inicial (5) + 2 páginas de "carregar
      // mais" (4 + 4) esgota exatamente o total. Diferente do antigo cenário
      // de 9 (5+4 exato, que exigia um 2º clique "vazio" só pra descobrir que
      // acabou): o rodapé agora usa o total agregado do servidor
      // (`fetchPipelineResumoEtapas`) como fonte de N, então ele já sabe que
      // acabou assim que `leads.length === total` — sem precisar de uma
      // página extra que "volta vazia". Com 13, o "mais N" também passa por
      // um valor intermediário (4) depois do 1º clique, útil pra confirmar
      // que N realmente diminui (e não só zera de uma vez).
      criarVendedorComVariosLeads(13),
      criarVendedorComLeadEmCotacao(),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([
      limparVendedorComVariosLeads(vendedor13Leads),
      limparVendedorComLeadEmCotacao(vendedorEstagios),
    ]);
  });

  test("coluna Lead novo carrega 5 de início; rodapé mostra mais N e clicar carrega o restante", async ({
    page,
  }) => {
    // 3 waits sequenciais dependentes de rede (carga inicial + 2 cliques) —
    // sob execução concorrente (`--repeat-each`/vários workers), o timeout
    // padrão de 30s por teste pode ser insuficiente mesmo com cada `expect`
    // individual generoso (mesmo padrão de `filas-aprovacao.spec.ts`).
    test.setTimeout(60_000);
    await loginAs(page, vendedor13Leads.email, vendedor13Leads.senha);
    await page.goto("/venda/pipeline");

    const coluna = page.locator('.kcol[data-stage="novo"]');
    const cards = coluna.locator(".kcard");
    const rodape = coluna.locator(".kcol-restam button");

    // Ver comentário do timeout maior em pipeline-lead-recebido.spec.ts: a
    // carga inicial do Kanban paginado dispara várias requisições paralelas
    // (uma por coluna + resumo + opções de filtro), então sob execução
    // concorrente do Playwright pode passar dos 5000ms padrão.
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });

    // Negativo: carga inicial é 5, não os 13 leads criados.
    await expect(cards).toHaveCount(5);
    // Positivo: N = total do servidor (13) menos o carregado (5).
    await expect(rodape).toHaveText("mais 8");

    await rodape.click();
    await expect(cards).toHaveCount(9, { timeout: 10_000 });
    // N diminui (13 - 9 = 4) — não é um "carregando…" preso nem some de
    // uma vez; ainda sobra 1 página no servidor.
    await expect(rodape).toHaveText("mais 4");

    await rodape.click();
    await expect(cards).toHaveCount(13, { timeout: 10_000 });
    // Sem duplicar/perder cards na última página. Some quando não sobra
    // nada — sem precisar de um 3º clique "vazio" pra descobrir isso (o
    // total agregado já garante `restam === 0` assim que os 13 chegam).
    await expect(coluna.locator(".kcol-restam button")).toHaveCount(0);
  });

  test("rolar a fila da coluna até o fim não carrega sozinho; só o rodapé carrega", async ({
    page,
  }) => {
    // Ver comentário do timeout maior no teste acima — aqui também são 2
    // waits sequenciais dependentes de rede (carga inicial + clique).
    test.setTimeout(60_000);
    await loginAs(page, vendedor13Leads.email, vendedor13Leads.senha);
    await page.goto("/venda/pipeline");

    const coluna = page.locator('.kcol[data-stage="novo"]');
    const fila = coluna.locator(".kcol-fila");
    const cards = coluna.locator(".kcard");
    const rodape = coluna.locator(".kcol-restam button");

    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    await expect(cards).toHaveCount(5);

    // A fila (`.kcol-fila`) é a que rola, não a página — rolar ela até o
    // fim dispara o próprio `scroll` nativo do elemento, sem passar pelo
    // `window`/`document`.
    await fila.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    // Dá tempo de qualquer fetch indevido aparecer antes de checar a
    // contagem (negativo: nenhum request de "carregar mais" deveria disparar
    // só por rolar).
    await page.waitForTimeout(300);
    await expect(cards).toHaveCount(5);
    await expect(rodape).toBeVisible();

    // Só o clique no rodapé carrega mais — mesmo já tendo rolado até o fim.
    await rodape.click();
    await expect(cards).toHaveCount(9, { timeout: 10_000 });
  });

  test("página não rola no Kanban; quem rola é a coluna", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, vendedor13Leads.email, vendedor13Leads.senha);
    await page.goto("/venda/pipeline");

    const coluna = page.locator('.kcol[data-stage="novo"]');
    const fila = coluna.locator(".kcol-fila");
    await expect(coluna.locator(".kcard").first()).toBeVisible({ timeout: 20_000 });

    const box = await fila.boundingBox();
    if (!box) throw new Error("`.kcol-fila` sem bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(200);

    const [filaScrollTop, windowScrollY] = await Promise.all([
      fila.evaluate((el) => el.scrollTop),
      page.evaluate(() => window.scrollY),
    ]);
    // Positivo: a fila rolou com o mouse por cima dela.
    expect(filaScrollTop).toBeGreaterThan(0);
    // Negativo: a página (o `.kanban` como um todo) não rolou junto.
    expect(windowScrollY).toBe(0);
  });

  test("coluna com poucos leads (cabe na vista, sem mais no servidor) não mostra rodapé", async ({
    page,
  }) => {
    await loginAs(page, vendedorEstagios.email, vendedorEstagios.senha);
    await page.goto("/venda/pipeline");

    const colunaNovo = page.locator('.kcol[data-stage="novo"]');
    await expect(colunaNovo.locator(".kcard")).toHaveCount(1, { timeout: 20_000 });
    // Negativo: 1 lead só, nada mais no servidor e cabe inteiro na vista —
    // o rodapé "mais N" nem chega a aparecer.
    await expect(colunaNovo.locator(".kcol-restam button")).toHaveCount(0);
  });

  test("filtro de Estágio busca só a coluna escolhida: as outras somem da tela", async ({
    page,
  }) => {
    // Ver comentário do timeout maior no 1º teste do arquivo — aqui são 4
    // waits sequenciais dependentes de rede (carga inicial + 3 trocas de
    // filtro).
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
