import { test, expect, type Page } from "@playwright/test";
import { confirmarDadosComplementaresTransmissao, loginAs } from "./helpers";
import {
  criarCotacaoTransmissaoFixture,
  limparCotacaoTransmissaoFixture,
  criarTentativaTransmissaoEnviada,
  lerCotacaoRetomadaEstado,
  QUIVER_WEBHOOK_HEADERS,
  QUIVER_TRANSMISSAO_WEBHOOK_HEADERS,
  type CotacaoQuiverFixture,
} from "./provision";

/**
 * E2E de "Transmissão reabre no ponto certo" (V12, PR #238):
 * `useRetomarTransmissao`/`useAplicarRetomadaTransmissao` (novo-lead.tsx) lêem
 * a última `cotacao_transmissoes` + `cotacoes.transmissao_oferta` pra decidir
 * em que sub-passo da Etapa 7 o wizard deve reabrir — em vez de sempre cair
 * de volta no Cálculo (comportamento antigo).
 *
 * Mesma técnica de `webhook-transmissao.spec.ts` pro robô real: a cotação
 * chega a "calculada" via fixture + webhook `/api/webhooks/quiver`, e
 * "gerar proposta" é interceptado via `page.route` (o robô de verdade nunca
 * roda num teste automatizado).
 */

const CARD_ALFA = {
  index: 10,
  seguradora: "Seguradora Alfa",
  produto: "Auto Completo",
  nome: "Plano Premium",
  opcoes: [
    {
      tipo: "Compreensiva",
      franquia: "Reduzida · R$ 2.450,00",
      avista: "R$ 2.345,67",
      parcelas: "10x de R$ 251,90",
    },
  ],
  formaPagamento: "Boleto",
  coberturasBasicas: { Casco: "100% FIPE" },
};

const CARD_BETA = {
  index: 20,
  seguradora: "Seguradora Beta",
  produto: "Auto Flex",
  nome: "Plano Flexível",
  opcoes: [
    {
      tipo: "Compreensiva Plus",
      franquia: "Majorada · R$ 4.000,00",
      avista: "R$ 3.010,05",
      parcelas: "12x de R$ 275,40",
    },
  ],
  formaPagamento: "Cartão",
  coberturasBasicas: { Casco: "110% FIPE" },
};

/** Cria a fixture já calculada (webhook de cotação) e abre o Passo 6 logado. */
async function prepararCotacaoCalculada(page: Page): Promise<CotacaoQuiverFixture> {
  const fixture = await criarCotacaoTransmissaoFixture();

  const res = await page.request.post("/api/webhooks/quiver", {
    headers: QUIVER_WEBHOOK_HEADERS,
    data: { cotacaoId: fixture.cotacaoId, temPremios: true, cards: [CARD_ALFA, CARD_BETA] },
  });
  expect(res.ok()).toBeTruthy();

  await loginAs(page, fixture.email, fixture.senha);
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
  await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
  await expect(page.getByText(/compare, personalize e escolha a seguradora/i)).toBeVisible({
    timeout: 10_000,
  });

  return fixture;
}

/** Escolhe a oferta da Alfa no Cálculo (sem confirmar a transmissão), parando em "Dados complementares". */
async function escolherOfertaAlfa(page: Page) {
  await expect(page.getByText(CARD_BETA.seguradora).first()).toBeVisible();
  await page.getByTitle(`Gerar proposta (${CARD_ALFA.seguradora})`).click();
  await expect(page.getByRole("heading", { name: "Dados complementares" })).toBeVisible();
}

/**
 * Espera o autosave debounced (`useCotacaoRascunho`, 1,5s) gravar
 * `step_atual` no banco — sem isso, o `page.reload()` a seguir dependeria só
 * da corrida entre o carregamento do rascunho (usa o `step` da própria URL,
 * que continua `&step=5` da navegação inicial) e `useRetomarTransmissao`
 * pra convergir no ponto certo.
 */
async function esperarStepAtualPersistido(cotacaoId: string, step: number) {
  await expect
    .poll(async () => (await lerCotacaoRetomadaEstado(cotacaoId))?.step_atual, { timeout: 5_000 })
    .toBe(step);
}

/**
 * `gravarTransmissaoOfertaSnapshot`/`limparTransmissaoOfertaSnapshot` são
 * best-effort (fire-and-forget, sem `await` no clique) — espera a gravação
 * chegar no banco antes de checar, em vez de ler uma vez só e arriscar pegar
 * o valor anterior por pura sorte de timing.
 */
async function esperarSnapshotSeguradora(cotacaoId: string, seguradora: string | null) {
  await expect
    .poll(
      async () => {
        const estado = await lerCotacaoRetomadaEstado(cotacaoId);
        return (estado?.transmissao_oferta as { seguradora?: string } | null)?.seguradora ?? null;
      },
      { timeout: 5_000 },
    )
    .toBe(seguradora);
}

/** Gera a proposta real (interceptando o robô) a partir de "Dados complementares" já visível. */
async function gerarPropostaComTentativaReal(page: Page, fixture: CotacaoQuiverFixture) {
  const tentativaId = await criarTentativaTransmissaoEnviada({
    cotacaoId: fixture.cotacaoId,
    seguradora: CARD_ALFA.seguradora,
    produto: CARD_ALFA.produto,
    formaPagamento: CARD_ALFA.formaPagamento,
    parcelas: CARD_ALFA.opcoes[0].parcelas,
    premio: 2345.67,
  });

  await page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData() ?? "";
    if (body.includes(fixture.cotacaoId) && body.includes("formaPagamento")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: { ok: true, numeroCotacao: "N-E2E-123", tentativaId },
        }),
      });
      return;
    }
    await route.continue();
  });

  await confirmarDadosComplementaresTransmissao(page);
  await expect(page.getByText("Aguardando confirmação da seguradora…")).toBeVisible();

  return tentativaId;
}

/** Confirma que o Cálculo nunca aparece nesse instante (carregando a retomada). */
async function assertCalculoNuncaVisivel(page: Page) {
  await expect(page.locator(".calc-lista")).toHaveCount(0);
  await expect(page.getByText(/compare, personalize e escolha a seguradora/i)).toHaveCount(0);
}

/** Confirma que a Etapa 7 (Transmissão) nunca aparece — a retomada não deveria ter agido. */
async function assertTransmissaoNuncaVisivel(page: Page) {
  await expect(page.getByRole("heading", { name: "Dados complementares" })).toHaveCount(0);
  await expect(page.getByText("Aguardando confirmação da seguradora…")).toHaveCount(0);
}

test.describe("Transmissão reabre no ponto certo (V12)", () => {
  test("só snapshot (antes de qualquer tentativa): reload reabre em Dados complementares com a mesma seguradora", async ({
    page,
  }) => {
    const fixture = await prepararCotacaoCalculada(page);
    try {
      await escolherOfertaAlfa(page);
      await esperarSnapshotSeguradora(fixture.cotacaoId, CARD_ALFA.seguradora);
      await esperarStepAtualPersistido(fixture.cotacaoId, 6);
      await page.reload();

      await assertCalculoNuncaVisivel(page);
      await expect(page.getByRole("heading", { name: "Dados complementares" })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText(CARD_ALFA.seguradora)).toBeVisible();
      await assertCalculoNuncaVisivel(page);
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });

  // Regressão coberta: com `page.reload()` o rascunho (`useCotacaoRascunho`)
  // e a retomada disputavam o passo — o rascunho, mais lento, voltava para o
  // Cálculo. Corrigido fazendo a retomada esperar o rascunho carregar e a URL
  // acompanhar o passo (`sincronizarStepNaUrl`, `replace`).
  test("tentativa enviada: reload reabre aguardando, e o webhook transmitido=true fecha em Transmitida sem recarregar", async ({
    page,
  }) => {
    const fixture = await prepararCotacaoCalculada(page);
    try {
      await escolherOfertaAlfa(page);
      await gerarPropostaComTentativaReal(page, fixture);
      await page.unroute("**/_serverFn/**");
      await esperarStepAtualPersistido(fixture.cotacaoId, 6);

      await page.reload();
      await assertCalculoNuncaVisivel(page);
      await expect(page.getByText("Aguardando confirmação da seguradora…")).toBeVisible({
        timeout: 10_000,
      });
      await assertCalculoNuncaVisivel(page);

      // Webhook chega enquanto a página está aberta (polling do front) — não
      // precisa de reload nenhum pra fechar em Transmitida.
      const res = await page.request.post("/api/webhooks/quiver-transmissao", {
        headers: QUIVER_TRANSMISSAO_WEBHOOK_HEADERS,
        data: { cotacaoId: fixture.cotacaoId, transmitido: true, numeroCotacao: "N-E2E-123" },
      });
      expect(res.ok()).toBeTruthy();

      const acoes = page.locator('[data-tour="transmitida-acoes"]');
      await expect(acoes).toBeVisible({ timeout: 15_000 });

      // Reload em cima da Transmitida: continua mostrando o mesmo card.
      await page.reload();
      await assertCalculoNuncaVisivel(page);
      await expect(page.locator('[data-tour="transmitida-acoes"]')).toBeVisible({
        timeout: 10_000,
      });
      await assertCalculoNuncaVisivel(page);
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });

  test("tentativa em falha: reload reabre o card de falha, e 'Tentar novamente' funciona", async ({
    page,
  }) => {
    const fixture = await prepararCotacaoCalculada(page);
    try {
      await escolherOfertaAlfa(page);
      await gerarPropostaComTentativaReal(page, fixture);
      await page.unroute("**/_serverFn/**");

      const res = await page.request.post("/api/webhooks/quiver-transmissao", {
        headers: QUIVER_TRANSMISSAO_WEBHOOK_HEADERS,
        data: {
          cotacaoId: fixture.cotacaoId,
          transmitido: false,
          motivo: "CAMPOS_PENDENTES",
          mensagem: "Preencha o campo Dia de Vencimento das Demais Parcelas",
        },
      });
      expect(res.ok()).toBeTruthy();
      await expect(
        page.getByText("Preencha o campo Dia de Vencimento das Demais Parcelas"),
      ).toBeVisible({ timeout: 15_000 });

      await page.reload();
      await assertCalculoNuncaVisivel(page);
      await expect(page.getByText("CAMPOS_PENDENTES")).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByText("Preencha o campo Dia de Vencimento das Demais Parcelas"),
      ).toBeVisible();
      await assertCalculoNuncaVisivel(page);

      await page.getByRole("button", { name: "Tentar novamente" }).click();
      await expect(page.getByRole("heading", { name: "Dados complementares" })).toBeVisible();
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });

  test("Em finalização: 'Consultar status' e 'Tentar novamente' abrem o wizard no ponto certo", async ({
    page,
  }) => {
    const fixture = await prepararCotacaoCalculada(page);
    try {
      await escolherOfertaAlfa(page);
      await gerarPropostaComTentativaReal(page, fixture);
      await page.unroute("**/_serverFn/**");

      await page.goto("/venda/em-finalizacao");
      const linha = page.getByRole("row", { name: /Cliente Transmissão E2E/ });
      await expect(linha.first()).toBeVisible({ timeout: 10_000 });
      await linha.first().getByRole("button", { name: "Consultar status" }).click();

      await expect(page).toHaveURL(/\/venda\/novo-lead\?.*step=6/);
      await assertCalculoNuncaVisivel(page);
      await expect(page.getByText("Aguardando confirmação da seguradora…")).toBeVisible({
        timeout: 10_000,
      });

      // Falha chega, volta pra Em finalização e clica em "Tentar novamente".
      const resFalha = await page.request.post("/api/webhooks/quiver-transmissao", {
        headers: QUIVER_TRANSMISSAO_WEBHOOK_HEADERS,
        data: {
          cotacaoId: fixture.cotacaoId,
          transmitido: false,
          motivo: "CAMPOS_PENDENTES",
          mensagem: "Preencha o campo Dia de Vencimento das Demais Parcelas",
        },
      });
      expect(resFalha.ok()).toBeTruthy();

      await page.goto("/venda/em-finalizacao");
      const linhaFalha = page.getByRole("row", { name: /Cliente Transmissão E2E/ });
      await expect(linhaFalha.first()).toBeVisible({ timeout: 10_000 });
      await linhaFalha.first().getByRole("button", { name: "Tentar novamente" }).click();

      await expect(page).toHaveURL(/\/venda\/novo-lead\?.*step=6/);
      await assertCalculoNuncaVisivel(page);
      await expect(page.getByText("CAMPOS_PENDENTES")).toBeVisible({ timeout: 10_000 });
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });

  test("voltar ao Cálculo e escolher outra oferta atualiza o snapshot", async ({ page }) => {
    const fixture = await prepararCotacaoCalculada(page);
    try {
      await escolherOfertaAlfa(page);
      await esperarSnapshotSeguradora(fixture.cotacaoId, CARD_ALFA.seguradora);

      await page.getByRole("button", { name: "Voltar ao cálculo" }).click();
      await expect(page.locator(".calc-lista")).toBeVisible();
      await esperarSnapshotSeguradora(fixture.cotacaoId, null);

      await page.getByTitle(`Gerar proposta (${CARD_BETA.seguradora})`).click();
      await expect(page.getByRole("heading", { name: "Dados complementares" })).toBeVisible();
      await expect(page.getByText(CARD_BETA.seguradora)).toBeVisible();
      await esperarSnapshotSeguradora(fixture.cotacaoId, CARD_BETA.seguradora);

      await esperarStepAtualPersistido(fixture.cotacaoId, 6);
      await page.reload();
      await assertCalculoNuncaVisivel(page);
      await expect(page.getByRole("heading", { name: "Dados complementares" })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText(CARD_BETA.seguradora)).toBeVisible();
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });

  // ACHADO em CI (run 36466932163, quiver-webhook.spec.ts:30): links que
  // mandam `step=5` explícito (ex.: "Abrir cálculo" — em-negociacao.tsx,
  // cotacao-finalizada-aviso.tsx) precisam abrir o Cálculo de verdade, mesmo
  // numa cotação que já tem oferta escolhida (snapshot) ou tentativa de
  // transmissão — a retomada só pode agir quando `step` é 6 ou está ausente
  // (com `step_atual=6` persistido). Ver `decidirAplicacaoRetomada`.
  test("URL pede step=5 explicitamente (ex.: 'Abrir cálculo'): abre o Cálculo mesmo com oferta escolhida pra retomar, sem mexer no snapshot", async ({
    page,
  }) => {
    const fixture = await prepararCotacaoCalculada(page);
    try {
      await escolherOfertaAlfa(page);
      await esperarSnapshotSeguradora(fixture.cotacaoId, CARD_ALFA.seguradora);

      // Simula "Abrir cálculo": uma navegação NOVA pra mesma cotação, mas
      // pedindo explicitamente o Passo 5 — não o reload da Transmissão.
      await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
      await expect(page.getByText(/compare, personalize e escolha a seguradora/i)).toBeVisible({
        timeout: 10_000,
      });
      await assertTransmissaoNuncaVisivel(page);

      // O snapshot continua intacto — "Abrir cálculo" não limpa nem mexe
      // na oferta escolhida, só respeita o passo pedido pela URL.
      await esperarSnapshotSeguradora(fixture.cotacaoId, CARD_ALFA.seguradora);
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });

  test("URL pede step=5 explicitamente com tentativa 'enviada': também abre o Cálculo, não a Transmissão", async ({
    page,
  }) => {
    const fixture = await prepararCotacaoCalculada(page);
    try {
      await escolherOfertaAlfa(page);
      await gerarPropostaComTentativaReal(page, fixture);
      await page.unroute("**/_serverFn/**");

      await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
      await expect(page.getByText(/compare, personalize e escolha a seguradora/i)).toBeVisible({
        timeout: 10_000,
      });
      await assertTransmissaoNuncaVisivel(page);
    } finally {
      await limparCotacaoTransmissaoFixture(fixture);
    }
  });
});
