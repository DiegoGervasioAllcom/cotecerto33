// Pipeline V12 (T11): reescrito para a tela nova (`pipeline.tsx`/`pipeline-card.tsx`,
// T9) — 5 buckets automáticos (`novo`/`cotacao`/`negociacao`/`finalizacao`/`fechamento`)
// derivados de `leadEtapaBucket` (`@/lib/lead-etapa`), sem coluna "Qualificando"
// separada e sem drag-and-drop (removido de propósito — não recriar aqui).
//
// Fixture `criarVendedorComLead({ statusPipeline: "qualificado" })`: o status
// "qualificado" cai em `NOVO_SEM_COTACAO_STATUSES` (nenhuma cotação ainda),
// então o bucket automático é "novo" ("Lead novo") — mesma fixture do spec
// antigo, resultado esperado diferente (antes: coluna "Qualificando").
import { expect, test } from "@playwright/test";
import { loginAs, preencherDadosComplementaresAteConfirmacao } from "./helpers";
import {
  criarCotacaoTransmissaoFixture,
  criarVendedorComLead,
  lerTransmissaoFaseCotacao,
  limparCotacaoTransmissaoFixture,
  limparVendedorComLead,
  QUIVER_WEBHOOK_HEADERS,
  type VendedorComLead,
} from "./provision";

test.describe("pipeline — lead externo recebido", () => {
  let vendedorTabela: VendedorComLead;
  let vendedorKanban: VendedorComLead;
  let vendedorFiltros: VendedorComLead;

  test.beforeAll(async () => {
    [vendedorTabela, vendedorKanban, vendedorFiltros] = await Promise.all([
      criarVendedorComLead({ statusPipeline: "qualificado" }),
      criarVendedorComLead({ statusPipeline: "qualificado" }),
      criarVendedorComLead({ statusPipeline: "qualificado" }),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([
      limparVendedorComLead(vendedorTabela),
      limparVendedorComLead(vendedorKanban),
      limparVendedorComLead(vendedorFiltros),
    ]);
  });

  test("tabela exibe chip Lead novo; clique na linha assume e abre wizard com id", async ({
    page,
  }) => {
    await loginAs(page, vendedorTabela.email, vendedorTabela.senha);
    await page.goto("/venda/pipeline");

    await page.getByRole("button", { name: "Tabela" }).click();
    const linha = page.locator("tbody tr", { hasText: "Cliente E2E" }).first();
    // Pipeline V12 (T10): a carga inicial agora dispara ~10 requisições
    // paralelas por coluna (paginação server-side + resumo + opções de
    // filtro) em vez de 1 fetch único — sob execução paralela do Playwright
    // (múltiplas páginas/testes concorrentes contra o Supabase local), isso
    // passa fácil dos 5000ms padrão do `expect`. Timeout maior só na
    // primeira visibilidade pós-`goto`; as demais reaproveitam esse estado
    // já carregado.
    await expect(linha).toBeVisible({ timeout: 15_000 });
    await expect(linha.getByText("Lead novo", { exact: true })).toBeVisible();
    await expect(linha.getByText("aguardando o primeiro contato")).toBeVisible();
    await linha.click();

    await expect(page).toHaveURL(/\/venda\/novo-lead\?id=[^&]+&step=0/);
    await expect(page.getByRole("heading", { name: "Dados do Segurado" })).toBeVisible();
    await expect(page.getByText(/não veio da Central/i)).toHaveCount(0);
  });

  test("card qualificado aparece na coluna Lead novo do kanban; clique assume e abre wizard com id", async ({
    page,
  }) => {
    await loginAs(page, vendedorKanban.email, vendedorKanban.senha);
    await page.goto("/venda/pipeline");

    const colunaLeadNovo = page.locator('.kcol[data-stage="novo"]');
    const card = colunaLeadNovo.getByText("Cliente E2E", { exact: false });
    // Ver comentário do timeout maior no teste da tabela acima.
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(colunaLeadNovo.getByText("aguardando o primeiro contato")).toBeVisible();

    // Não existe mais coluna "Qualificando" separada.
    await expect(page.locator('.kcol[data-stage="contato"]')).toHaveCount(0);

    await card.click();

    await expect(page).toHaveURL(/\/venda\/novo-lead\?id=[^&]+&step=0/);
    await expect(page.getByRole("heading", { name: "Dados do Segurado" })).toBeVisible();
    await expect(page.getByText(/não veio da Central/i)).toHaveCount(0);
  });

  test("filtro de Estágio esconde o lead novo em outro estágio e volta a mostrar em Lead novo", async ({
    page,
  }) => {
    await loginAs(page, vendedorFiltros.email, vendedorFiltros.senha);
    await page.goto("/venda/pipeline");

    const cardTexto = page.getByText("Cliente E2E", { exact: false });
    // Ver comentário do timeout maior no teste da tabela acima.
    await expect(cardTexto).toBeVisible({ timeout: 15_000 });

    const filtroEstagio = page
      .locator("select")
      .filter({ has: page.locator('option[value="novo"]') });

    // Negativo: lead está no bucket "novo" — filtrar por "cotacao" esconde o card.
    await filtroEstagio.selectOption("cotacao");
    await expect(cardTexto).toHaveCount(0);

    // Positivo: voltar ao próprio bucket do lead reexibe o card.
    await filtroEstagio.selectOption("novo");
    await expect(cardTexto).toBeVisible();

    // "todas" (default) também mostra o card.
    await filtroEstagio.selectOption("todas");
    await expect(cardTexto).toBeVisible();
  });

  test("filtro Status ativos/perdidos: Ativos esconde a coluna Perdido; Perdidos esconde o lead ativo", async ({
    page,
  }) => {
    await loginAs(page, vendedorFiltros.email, vendedorFiltros.senha);
    await page.goto("/venda/pipeline");

    const cardTexto = page.getByText("Cliente E2E", { exact: false });
    // Ver comentário do timeout maior no teste da tabela acima.
    await expect(cardTexto).toBeVisible({ timeout: 15_000 });

    const colunaPerdido = page.locator('.kcol[data-stage="perdido"]');
    // Default (Status · todos): coluna Perdido existe (vazia, sem lead perdido nesta fixture).
    await expect(colunaPerdido).toBeVisible();

    const filtroStatus = page
      .locator("select")
      .filter({ has: page.locator('option[value="ativos"]') });

    // Negativo: "Ativos" some com a coluna Perdido por completo.
    await filtroStatus.selectOption("ativos");
    await expect(colunaPerdido).toHaveCount(0);
    await expect(cardTexto).toBeVisible();

    // Negativo: "Perdidos" esconde o lead ativo (ele não é 'perdido').
    await filtroStatus.selectOption("perdidos");
    await expect(cardTexto).toHaveCount(0);

    await filtroStatus.selectOption("todos");
    await expect(cardTexto).toBeVisible();
  });

  test("botão Lead Manual continua sendo a entrada do modal manual", async ({ page }) => {
    await loginAs(page, vendedorTabela.email, vendedorTabela.senha);
    await page.goto("/venda/pipeline");
    await page.getByRole("main").getByRole("link", { name: "Lead Manual" }).click();

    await expect(page).toHaveURL(/\/venda\/novo-lead$/);
    await expect(page.getByText(/não veio da Central/i)).toBeVisible();
  });
});

// T14: ponta a ponta do gap fechado por esta frente — um lead que entrou na
// Etapa 7 (Transmissão) mas parou num sub-passo pré-envio (sem clicar em
// "Confirmar e transmitir"/"Efetivar proposta") precisa aparecer em "Em
// finalização" (bucket automático, `emEtapaTransmissao` de `lead-etapa.ts`,
// T3) com o ponto exato do sub-passo em que parou (`transmissao_fase`,
// T4/T5/T6). Cartão único (sem cartão de crédito) — a Confirmação já mostra
// "Confirmar e transmitir" direto, então não precisamos passar pelo
// sub-passo de Pagamento aqui.
const CARD_FINALIZACAO_E2E = {
  index: 10,
  seguradora: "Seguradora Finalização E2E",
  produto: "Auto Completo",
  nome: "Plano Padrão",
  opcoes: [
    {
      tipo: "Compreensiva",
      franquia: "Reduzida · R$ 2.000,00",
      avista: "R$ 1.999,90",
      parcelas: "10x de R$ 210,00",
    },
  ],
  formaPagamento: "Boleto",
  coberturasBasicas: { Casco: "100% FIPE" },
};

test.describe("pipeline — lead em finalização parado num sub-passo da Transmissão", () => {
  test("lead que parou na Confirmação (sem transmitir) aparece em Em finalização com 'transmissão · confirmação'", async ({
    page,
  }) => {
    const fixture = await criarCotacaoTransmissaoFixture();
    try {
      const resWebhook = await page.request.post("/api/webhooks/quiver", {
        headers: QUIVER_WEBHOOK_HEADERS,
        data: { cotacaoId: fixture.cotacaoId, temPremios: true, cards: [CARD_FINALIZACAO_E2E] },
      });
      expect(resWebhook.ok()).toBeTruthy();

      await loginAs(page, fixture.email, fixture.senha);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
      await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
      await expect(page.getByText(/seguradoras calculadas/i)).toBeVisible({ timeout: 10_000 });

      const card = page.locator(".calc-card").filter({ hasText: CARD_FINALIZACAO_E2E.seguradora });

      // O clique em "Gerar proposta" muda o `step` local pra 6 (Etapa 7), o
      // que dispara o autosave debounced (1500ms, `useCotacaoRascunho`) que
      // persiste `cotacoes.step_atual = 6` — é esse campo que faz
      // `emEtapaTransmissao` (`lead-etapa.ts`, T3) considerar o lead como "Em
      // finalização". Regista o listener ANTES do clique pra não perder a
      // resposta (pode chegar em qualquer ponto do preenchimento abaixo).
      const autosaveStepTransmissao = page.waitForResponse(
        (r) => r.url().includes("/rpc/salvar_cotacao_rascunho") && r.ok(),
        { timeout: 10_000 },
      );

      // Helper: aguarda uma resposta de rede do PATCH fire-and-forget em
      // `cotacoes.transmissao_fase` (`StepTransmissao.tsx`/`novo-lead.tsx`,
      // `onFaseChange`) especificamente PARA ESTA cotação e com o valor de
      // fase esperado — escopado pela query string `id=eq.<cotacaoId>` (não
      // só pelo corpo) porque em runs paralelos várias abas/testes diferentes
      // gravam o mesmo tipo de PATCH ao mesmo tempo, em cotações diferentes.
      function esperarPatchFase(fase: "dados" | "confirmacao") {
        return page.waitForResponse(
          (r) => {
            if (r.request().method() !== "PATCH" || !r.ok()) return false;
            if (!r.url().includes(`/rest/v1/cotacoes?id=eq.${fixture.cotacaoId}`)) return false;
            const corpo = r.request().postData() ?? "";
            return corpo.includes(`"transmissao_fase":"${fase}"`);
          },
          { timeout: 10_000 },
        );
      }

      // O app roda em dev sob `<StrictMode>` (entry padrão do TanStack Start,
      // `@tanstack/react-start/dist/plugin/default-entry/client.tsx`), que
      // dispara o efeito de montagem do `StepTransmissao` DUAS vezes de
      // propósito (mount→cleanup→mount, é assim que o React expõe efeitos não
      // -idempotentes) — então SEMPRE saem 2 PATCHes `transmissao_fase:
      // "dados"` fire-and-forget ao entrar em "Dados complementares", com
      // ordem de chegada não determinística entre si (confirmado via captura
      // de rede: às vezes o 2º "dados" só resolve DEPOIS do "confirmacao"
      // seguinte, sobrescrevendo-o de volta pra "dados" — a causa raiz real
      // da corrida vista pelo revisor, mais funda que só o `page.goto`
      // cancelando 1 fetch em voo). Registra os 2 listeners ANTES do clique
      // que entra na tela e espera os 2 ANTES de avançar pra Confirmação: só
      // depois que ambos os "dados" já pousaram no servidor é que não sobra
      // nenhum PATCH desta fase capaz de chegar tarde e pisar no
      // "confirmacao" que vem a seguir.
      const doisPatchesDados = Promise.all([esperarPatchFase("dados"), esperarPatchFase("dados")]);
      await card
        .getByRole("button", { name: `Gerar proposta (${CARD_FINALIZACAO_E2E.seguradora})` })
        .click();
      await expect(page.getByRole("heading", { name: "Dados complementares" })).toBeVisible();
      await doisPatchesDados;

      // Só agora registra o listener da "confirmacao": com os 2 "dados" já
      // confirmados como persistidos, o clique em "Efetivar" (dentro do
      // helper abaixo, que muda `fase` de "dados" pra "confirmacao") é a
      // ÚLTIMA escrita fire-and-forget desta tela até aqui — não tem mais
      // nenhum PATCH concorrente que possa sobrescrevê-la depois.
      const gravouFaseConfirmacao = esperarPatchFase("confirmacao");

      // Vai só até a Confirmação — nunca clica em "Confirmar e transmitir".
      await preencherDadosComplementaresAteConfirmacao(page);
      await expect(page.getByRole("heading", { name: "Confirmação" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirmar e transmitir" })).toBeVisible();

      // `page.goto` faz uma navegação de verdade (descarrega o documento) —
      // espera o autosave de `step_atual` (acima) e a escrita best-effort de
      // `transmissao_fase: "confirmacao"` (acima) terminarem antes de sair da
      // página, senão a navegação cancela o fetch em voo.
      await autosaveStepTransmissao;
      await gravouFaseConfirmacao;

      // Confirma o valor persistido direto no Postgres (via admin, T5/T6):
      // a resposta de rede acima só prova que ESTE PATCH terminou — ler a
      // linha é o que efetivamente comprova o que ficou gravado.
      expect(await lerTransmissaoFaseCotacao(fixture.cotacaoId)).toBe("confirmacao");

      await page.goto("/venda/pipeline");

      // O card mostra "Cliente Transmissão E2E" em vez do `fixture.leadNome`
      // original: o autosave acima (RPC `salvar_cotacao_rascunho`) sempre
      // reescreve `leads.nome` a partir de `payload.segurado.nome` (ver
      // migration 20260824000000, `update public.leads set nome = coalesce(
      // nullif(_nome,''), nome)`), e o wizard carregou `f.nome` do
      // `cotacao_segurado.nome` que `criarCotacaoTransmissaoFixture` grava —
      // comportamento pré-existente do RPC, não algo desta frente.
      const colunaFinalizacao = page.locator('.kcol[data-stage="finalizacao"]');
      const kcard = colunaFinalizacao
        .locator(".kcard")
        .filter({ hasText: "Cliente Transmissão E2E" });
      await expect(kcard).toBeVisible({ timeout: 10_000 });
      await expect(kcard.locator(".kcard-ponto")).toHaveText("transmissão · confirmação");
      await expect(kcard.locator(".next")).toHaveText("Completar os dados que a seguradora pede");
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });
});
