// Pipeline geral (gestão) — rolagem interna por coluna (Pipeline V12, T14,
// revisão pós-aprovação): `PipelineColuna` virou um casco genérico
// compartilhado entre o Pipeline do vendedor (`venda/pipeline.tsx`, paginado
// server-side) e o Pipeline geral (`operacao/pipeline-geral.tsx`, sem
// paginação — até 1000 leads carregados de uma vez, `hasMore` sempre
// `false`). O spec de paginação (`pipeline-paginacao.spec.ts`) já cobre o
// caminho com `hasMore`; este cobre o outro caminho do rodapé "mais N" — o
// só-rolagem, sem servidor, que é o único que o Pipeline geral usa.
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarPersona,
  distribuirLeadE2E,
  limparLeadE2E,
  limparPersona,
  type Persona,
} from "./provision";

test.describe("pipeline geral — rolagem interna por coluna sem paginação", () => {
  let master: Persona;
  let vendedor: Persona;
  let leadIds: string[];

  test.beforeAll(async () => {
    master = await criarPersona({ role: "master" });
    vendedor = await criarPersona({ role: "vendedor", superiorId: master.userId });
    // 12 leads no bucket "novo" (mesmo shape de `criarVendedorComVariosLeads`
    // em `venda/pipeline.tsx`) — o bastante pra estourar a altura fixa da
    // coluna no viewport padrão do Playwright (1280x720) e exercitar
    // scroll/rodapé de verdade.
    leadIds = [];
    for (let i = 0; i < 12; i += 1) {
      leadIds.push(await distribuirLeadE2E(vendedor.userId, vendedor.empresaId));
    }
  });

  test.afterAll(async () => {
    await Promise.all(leadIds.map((id) => limparLeadE2E(id)));
    await limparPersona(vendedor);
    await limparPersona(master);
  });

  test("coluna cheia rola por dentro; rodapé só rola a fila, sem disparar 'carregar mais'", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await loginAs(page, master.email, master.senha);
    await page.goto("/operacao/pipeline-geral");

    // Filtro Vendedor: restringe a coluna aos 12 leads desta fixture — sem
    // isso, dados de outros speces/seed rodando em paralelo entrariam na
    // mesma coluna "novo" e quebrariam a contagem exata abaixo.
    const filtroVendedor = page
      .locator(".filters-bar select")
      .filter({ has: page.locator("option", { hasText: /^Vendedor$/ }) });
    await expect(filtroVendedor.locator("option", { hasText: vendedor.nome })).toHaveCount(1, {
      timeout: 20_000,
    });
    await filtroVendedor.selectOption({ label: vendedor.nome });

    const coluna = page.locator('.kcol[data-stage="novo"]');
    const fila = coluna.locator(".kcol-fila");
    const cards = coluna.locator(".kcard");
    const rodape = coluna.locator(".kcol-restam button");

    // Sem paginação: os 12 já chegam de uma vez (nenhum "carregar mais" a
    // esperar) — negativo: não é 5 como no Pipeline do vendedor.
    await expect(cards).toHaveCount(12, { timeout: 20_000 });

    // A fila realmente estoura a altura fixa da coluna (senão o resto do
    // teste não testaria nada — mesmo espírito de "teste que passa sem
    // testar nada é pior que sem teste").
    const [scrollHeight, clientHeight] = await fila.evaluate((el) => [
      el.scrollHeight,
      el.clientHeight,
    ]);
    expect(scrollHeight).toBeGreaterThan(clientHeight);

    // Negativo: o último card existe mas está fora da vista (clipado pelo
    // `overflow-y: auto` da `.kcol-fila`) antes de rolar.
    const ultimoCard = cards.last();
    await expect(ultimoCard).not.toBeInViewport();

    // Positivo: o rodapé mostra "mais N" com N = exatamente quantos cards
    // carregados estão fora da vista agora — mesmo critério de
    // `contarForaDaVista` (`use-kcol-fila-scroll.ts`), calculado aqui de
    // novo a partir do DOM real, não copiado do código de produção.
    const esperado = await fila.evaluate((el) => {
      const limite = el.scrollTop + el.clientHeight;
      return Array.from(el.querySelectorAll<HTMLElement>(".kcard")).filter(
        (card) => card.offsetTop + card.offsetHeight > limite + 8,
      ).length;
    });
    expect(esperado).toBeGreaterThan(0);
    await expect(rodape).toHaveText(`mais ${esperado}`);

    // Nenhuma requisição de "carregar mais" é disparada pelo Pipeline geral
    // (ele não pagina — `hasMore` é sempre `false` aqui): captura as
    // chamadas REST a `/rest/v1/leads` depois da carga inicial já ter
    // assentado, clica no rodapé e confirma que nenhuma nova chamada
    // aconteceu.
    const chamadasLeadsAntes: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/rest/v1/leads")) chamadasLeadsAntes.push(req.url());
    });
    await page.waitForTimeout(300); // qualquer fetch tardio da carga inicial já teria disparado

    // Positivo: clicar no rodapé rola a fila (mesmo sem bater no servidor) —
    // sem depender de `isVisible()` (que não enxerga clipe por
    // `overflow`/scroll de ancestral, só `display`/`visibility`), o jeito
    // confiável de provar "rolou" é comparar o `scrollTop` antes/depois.
    const scrollTopAntes = await fila.evaluate((el) => el.scrollTop);
    await rodape.click();
    await page.waitForTimeout(400); // `behavior: "smooth"` do scroll não é instantâneo
    const scrollTopDepois = await fila.evaluate((el) => el.scrollTop);
    expect(scrollTopDepois).toBeGreaterThan(scrollTopAntes);

    // Positivo: o último card é alcançável — rolando a fila até o fim (o
    // mesmo gesto que o usuário faria com o mouse/trackpad, sem depender de
    // quantos cliques no rodapé isso levaria), ele fica visível de verdade
    // (não só presente no DOM).
    await fila.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(ultimoCard).toBeInViewport({ timeout: 10_000 });

    expect(chamadasLeadsAntes).toHaveLength(0);
  });
});
