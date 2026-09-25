// V12.3.4 — /venda/em-negociacao ganha duas listas ("Aguardando cotação" +
// "Cotação finalizada") e o aviso global "COTAÇÃO FINALIZADA" (poll de
// `COTACOES_NOVAS_POLL_MS`, hoje 25s) some ao agir. Mesma decisão de
// `quiver-webhook.spec.ts`: simula o robô da Quiver via o webhook real
// (`POST /api/webhooks/quiver`) em vez de depender do bot Playwright da
// Quiver estar no ar — o objeto deste teste é a reação da tela/RLS aos
// status, não o preenchimento do wizard.
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  criarCotacaoEnviadaQuiverExtra,
  criarCotacaoQuiverFixture,
  criarPersona,
  limparCotacaoEnviadaQuiverExtra,
  limparCotacaoQuiverFixture,
  limparPersonaSemEmpresa,
  QUIVER_WEBHOOK_HEADERS,
  type CotacaoQuiverFixture,
} from "./provision";

/** Card mínimo o bastante para `registrar_premios_quiver` gravar `status='calculada'`
 * com um prêmio de verdade (mesmo shape usado por `quiver-webhook.spec.ts`). */
const CARD_MINIMO = {
  seguradora: "Seguradora Alfa",
  produto: "Auto Completo",
  nome: "Plano Único",
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

async function marcarComoCalculada(page: import("@playwright/test").Page, cotacaoId: string) {
  const res = await page.request.post("/api/webhooks/quiver", {
    headers: QUIVER_WEBHOOK_HEADERS,
    data: { cotacaoId, temPremios: true, cards: [CARD_MINIMO] },
  });
  expect(res.ok()).toBeTruthy();
}

async function marcarComoErro(
  page: import("@playwright/test").Page,
  cotacaoId: string,
  mensagem: string,
) {
  const res = await page.request.post("/api/webhooks/quiver", {
    headers: QUIVER_WEBHOOK_HEADERS,
    data: { cotacaoId, temPremios: false, mensagem },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("Em negociação — duas listas + aviso de cotação finalizada (V12.3.4)", () => {
  test("aguardando cotação: enviada_quiver aparece sem 'Abrir cálculo'; erro_quiver mostra a mensagem e 'Reabrir e corrigir' leva à cotação", async ({
    page,
  }) => {
    const fixture = await criarCotacaoQuiverFixture();
    try {
      await loginAs(page, fixture.email, fixture.senha);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
      await page.goto("/venda/em-negociacao");

      const cardAguardando = page.locator('[data-tour="em-negociacao-aguardando"]');
      const cardFinalizada = page.locator('[data-tour="em-negociacao-finalizada"]');
      const linhasAguardando = cardAguardando.locator("tbody tr");

      // enviada_quiver: uma linha esperando, sem botão de ação nenhum (nem
      // "Abrir cálculo" nem "Reabrir e corrigir" — só o chip de tempo).
      await expect(linhasAguardando).toHaveCount(1);
      await expect(linhasAguardando.getByRole("button", { name: "Abrir cálculo" })).toHaveCount(0);
      await expect(
        linhasAguardando.getByRole("button", { name: "Reabrir e corrigir" }),
      ).toHaveCount(0);
      await expect(cardAguardando.getByText("Erro no cálculo")).toHaveCount(0);
      // Cotação finalizada continua vazia — ainda não há preço nenhum.
      await expect(
        cardFinalizada.getByText(
          "Assim que as seguradoras responderem, a cotação desce para cá sozinha.",
        ),
      ).toBeVisible();

      // O robô volta com erro: o mesmo card de "Aguardando cotação" passa a
      // mostrar o chip de erro + a mensagem + "Reabrir e corrigir".
      await marcarComoErro(
        page,
        fixture.cotacaoId,
        "Portal indisponível para o produto solicitado.",
      );
      await page.reload();
      await expect(linhasAguardando).toHaveCount(1);
      await expect(cardAguardando.getByText("Erro no cálculo")).toBeVisible();
      await expect(
        cardAguardando.getByText("Portal indisponível para o produto solicitado."),
      ).toBeVisible();
      const botaoReabrir = linhasAguardando.getByRole("button", { name: "Reabrir e corrigir" });
      await expect(botaoReabrir).toBeVisible();
      await expect(linhasAguardando.getByRole("button", { name: "Abrir cálculo" })).toHaveCount(0);

      await botaoReabrir.click();
      await expect(page).toHaveURL(new RegExp(`/venda/novo-lead\\?id=${fixture.cotacaoId}&step=5`));
      await expect(page.getByText("Portal indisponível para o produto solicitado.")).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await limparCotacaoQuiverFixture(fixture);
    }
  });

  test("aviso 'COTAÇÃO FINALIZADA' aparece em outra tela após o poll, com badge no menu, e 'Depois' dispensa sem navegar", async ({
    page,
  }) => {
    const fixture = await criarCotacaoQuiverFixture();
    try {
      await loginAs(page, fixture.email, fixture.senha);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
      await page.goto("/inicio");

      const badgeNovo = page.locator('[data-tour="nav-em-negociacao"] .badge.novo');
      const avisoCard = page.locator(".aviso-host .aviso-card");
      await expect(avisoCard).toHaveCount(0);
      await expect(badgeNovo).toHaveCount(0);

      await marcarComoCalculada(page, fixture.cotacaoId);

      // O poll de `useCotacoesNovas` é a única fonte — nenhum realtime aqui,
      // por isso a espera longa (decisão do usuário registrada em
      // `src/lib/cotacao-novas.ts`: até ~25s é aceitável).
      await expect(avisoCard).toBeVisible({ timeout: 35_000 });
      await expect(avisoCard.getByText("COTAÇÃO FINALIZADA")).toBeVisible();
      await expect(badgeNovo).toBeVisible();

      await avisoCard.getByRole("button", { name: "Depois" }).click();
      await expect(avisoCard).toHaveCount(0);
      await expect(badgeNovo).toHaveCount(0);
      // "Depois" só marca como visto — não navega.
      await expect(page).toHaveURL(/\/inicio/);
    } finally {
      await limparCotacaoQuiverFixture(fixture);
    }
  });

  test("'Abrir cálculo' no aviso global navega para o cálculo e limpa o aviso/badge", async ({
    page,
  }) => {
    const fixture = await criarCotacaoQuiverFixture();
    try {
      await loginAs(page, fixture.email, fixture.senha);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
      await page.goto("/inicio");

      const badgeNovo = page.locator('[data-tour="nav-em-negociacao"] .badge.novo');
      const avisoCard = page.locator(".aviso-host .aviso-card");

      await marcarComoCalculada(page, fixture.cotacaoId);
      await expect(avisoCard).toBeVisible({ timeout: 35_000 });

      await avisoCard.getByRole("button", { name: "Abrir cálculo" }).click();
      await expect(page).toHaveURL(new RegExp(`/venda/novo-lead\\?id=${fixture.cotacaoId}&step=5`));
      await expect(avisoCard).toHaveCount(0);
      await expect(badgeNovo).toHaveCount(0);
    } finally {
      await limparCotacaoQuiverFixture(fixture);
    }
  });

  test("abrir /venda/em-negociacao marca as cotações como vistas — o chip 'nova' só aparece na primeira renderização", async ({
    page,
  }) => {
    const fixture = await criarCotacaoQuiverFixture();
    try {
      await marcarComoCalculada(page, fixture.cotacaoId);
      await loginAs(page, fixture.email, fixture.senha);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });

      // O componente dispara, em paralelo no mount: (a) o SELECT inicial de
      // `useCotacaoFinalizadaRows` (1 round-trip) e (b) o efeito que chama
      // `marcarCotacoesVistas` → invalida → `refetchFinalizada` (2 round-trips
      // em sequência). (a) tende a resolver primeiro, então a 1ª renderização
      // mostra o chip "nova" (`calculo_visto_em` ainda null); assim que (b)
      // termina, o refetch traz `calculo_visto_em` preenchido e o chip some —
      // sem essa marcação de novo aparecer, mesmo recarregando a tela depois.
      // Atrasamos aqui só o PATCH (o `update` de `calculo_visto_em`) para dar
      // tempo determinístico de observar a fase transitória em vez de torcer
      // pela ordem natural das duas requisições.
      await page.route("**/rest/v1/cotacoes*", async (route) => {
        if (route.request().method() === "PATCH") {
          await new Promise((r) => setTimeout(r, 1_200));
        }
        await route.continue();
      });

      await page.goto("/venda/em-negociacao");
      const linhaFinalizada = page
        .locator('[data-tour="em-negociacao-finalizada"] tbody tr')
        .first();
      await expect(linhaFinalizada).toBeVisible();
      await expect(linhaFinalizada.getByText("nova", { exact: true })).toBeVisible();

      // Depois que o PATCH (atrasado de propósito) e o refetch terminam, o
      // chip "nova" desaparece sozinho — sem precisar recarregar a página.
      await expect(linhaFinalizada.getByText("nova", { exact: true })).toHaveCount(0, {
        timeout: 10_000,
      });
      await page.unroute("**/rest/v1/cotacoes*");

      // Confirma no banco que a marcação realmente aconteceu (não é só efeito
      // visual do cache do react-query).
      await page.reload();
      const linhaFinalizadaDepois = page
        .locator('[data-tour="em-negociacao-finalizada"] tbody tr')
        .first();
      await expect(linhaFinalizadaDepois).toBeVisible();
      await expect(linhaFinalizadaDepois.getByText("nova", { exact: true })).toHaveCount(0);
    } finally {
      await limparCotacaoQuiverFixture(fixture);
    }
  });

  test("colega da mesma empresa não vê as cotações do outro nas duas listas, nem recebe o aviso", async ({
    page,
  }) => {
    const fixture = await criarCotacaoQuiverFixture();
    let extra: { leadId: string; cotacaoId: string } | undefined;
    let colega: Awaited<ReturnType<typeof criarPersona>> | undefined;
    try {
      // Dono: uma cotação calculada (Cotação finalizada) e uma enviada_quiver
      // (Aguardando cotação) — as duas listas populadas de verdade.
      await marcarComoCalculada(page, fixture.cotacaoId);
      extra = await criarCotacaoEnviadaQuiverExtra(fixture.empresaId, fixture.userId);
      colega = await criarPersona({ role: "vendedor", empresaId: fixture.empresaId });

      await loginAs(page, colega.email, colega.senha);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
      await page.goto("/venda/em-negociacao");

      const cardAguardando = page.locator('[data-tour="em-negociacao-aguardando"]');
      const cardFinalizada = page.locator('[data-tour="em-negociacao-finalizada"]');
      await expect(cardAguardando.locator("tbody tr")).toHaveCount(0);
      await expect(cardFinalizada.locator("tbody tr")).toHaveCount(0);
      await expect(
        cardAguardando.getByText("Nenhuma cotação esperando retorno de seguradora."),
      ).toBeVisible();
      await expect(
        cardFinalizada.getByText(
          "Assim que as seguradoras responderem, a cotação desce para cá sozinha.",
        ),
      ).toBeVisible();

      await expect(page.locator(".aviso-host .aviso-card")).toHaveCount(0);
      await expect(page.locator('[data-tour="nav-em-negociacao"] .badge.novo')).toHaveCount(0);
    } finally {
      if (colega) await limparPersonaSemEmpresa(colega);
      if (extra) await limparCotacaoEnviadaQuiverExtra(extra);
      await limparCotacaoQuiverFixture(fixture);
    }
  });

  test("Pipeline: lead com cotação enviada_quiver aparece em 'Em negociação', não em 'Lead novo'", async ({
    page,
  }) => {
    const fixture: CotacaoQuiverFixture = await criarCotacaoQuiverFixture();
    try {
      await loginAs(page, fixture.email, fixture.senha);
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
      await page.goto("/venda/pipeline");

      const colunaNegociacao = page.locator('.kcol[data-stage="negociacao"]');
      const colunaNovo = page.locator('.kcol[data-stage="novo"]');
      await expect(colunaNegociacao.getByText(fixture.leadNome, { exact: true })).toBeVisible({
        timeout: 10_000,
      });
      await expect(colunaNovo.getByText(fixture.leadNome, { exact: true })).toHaveCount(0);
    } finally {
      await limparCotacaoQuiverFixture(fixture);
    }
  });
});
